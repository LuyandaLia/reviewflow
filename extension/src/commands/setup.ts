import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BackendError, type BackendClient } from '../api/backendClient';
import { GitLabClient } from '../gitlab/gitlabClient';
import type { SecretStorageService } from '../gitlab/secretStorageService';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

// Extend this array when adding GitHub, Bitbucket, Azure DevOps support
const PROVIDERS = [
  {
    label: '$(server) GitLab',
    description: 'GitLab.com or self-hosted',
    id: 'gitlab' as const,
    supported: true,
  },
  {
    label: '$(github) GitHub',
    description: 'Coming soon',
    id: 'github' as const,
    supported: false,
  },
];

interface GitRemote {
  name: string;
  url: string;
}

interface DetectedRepo {
  localPath: string;
  label: string;
  remotes: GitRemote[];
}

async function detectGitRepositories(): Promise<DetectedRepo[]> {
  try {
    const gitExt = vscode.extensions.getExtension('vscode.git');
    if (gitExt) {
      if (!gitExt.isActive) await gitExt.activate();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (gitExt.exports as any).getAPI(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repos: any[] = api?.repositories ?? [];
      if (repos.length > 0) {
        return repos.map((r) => ({
          localPath: r.rootUri.fsPath as string,
          label: path.basename(r.rootUri.fsPath as string),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          remotes: ((r.state?.remotes ?? []) as any[]).map((rem) => ({
            name: rem.name as string,
            url: ((rem.fetchUrl ?? rem.pushUrl ?? '') as string),
          })),
        }));
      }
    }
  } catch {
    // fall through to workspace folder check
  }

  return (vscode.workspace.workspaceFolders ?? [])
    .filter((f) => fs.existsSync(path.join(f.uri.fsPath, '.git')))
    .map((f) => ({ localPath: f.uri.fsPath, label: f.name, remotes: [] }));
}

function inferProjectPath(remotes: GitRemote[], instanceHostname: string): string | undefined {
  for (const remote of remotes) {
    const url = remote.url.trim();
    // SSH: git@gitlab.com:group/project.git
    const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch && sshMatch[1].toLowerCase() === instanceHostname.toLowerCase()) {
      return sshMatch[2];
    }
    // HTTPS: https://gitlab.com/group/project.git
    try {
      const parsed = new URL(url);
      if (parsed.hostname.toLowerCase() === instanceHostname.toLowerCase()) {
        const p = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '');
        if (p.includes('/')) return p;
      }
    } catch {
      // not a valid URL
    }
  }
  return undefined;
}

function deriveInstanceName(baseUrl: string): string {
  try {
    const hostname = new URL(baseUrl).hostname;
    if (hostname === 'gitlab.com') return 'GitLab.com';
    const parts = hostname.split('.');
    if (parts[0].toLowerCase() === 'gitlab' && parts.length > 2) {
      return `GitLab (${parts.slice(1).join('.')})`;
    }
    return hostname;
  } catch {
    return 'GitLab';
  }
}

function extractProjectPath(input: string): string {
  const trimmed = input.trim();
  try {
    return new URL(trimmed).pathname.replace(/^\//, '').replace(/\.git$/, '');
  } catch {
    return trimmed.replace(/\.git$/, '');
  }
}

function isProjectBot(username: string): boolean {
  return /^project_\d+_bot/.test(username);
}

/**
 * Runs the guided ReviewFlow setup wizard.
 * Returns true if setup completed successfully (at least one instance created/found),
 * false if the user cancelled or an unrecoverable error occurred.
 */
export async function runSetupWizard(
  client: BackendClient,
  secrets: SecretStorageService,
  treeProvider: RepositoryTreeProvider,
): Promise<boolean> {
  // ── Step 1: Provider ──────────────────────────────────────────────────────
  const providerPick = await vscode.window.showQuickPick(PROVIDERS, {
    title: 'ReviewFlow Setup (1/4) — Provider',
    placeHolder: 'Select your Git hosting provider',
    ignoreFocusOut: true,
  });
  if (!providerPick) return false;

  if (!providerPick.supported) {
    vscode.window.showInformationMessage(
      `ReviewFlow: ${providerPick.id === 'github' ? 'GitHub' : 'This provider'} support is coming soon. Only GitLab is supported right now.`,
    );
    return false;
  }

  // ── Step 2: Provider URL ──────────────────────────────────────────────────
  const urlInput = await vscode.window.showInputBox({
    title: 'ReviewFlow Setup (2/4) — GitLab URL',
    prompt: 'Base URL of your GitLab instance',
    placeHolder: 'https://gitlab.com',
    value: 'https://gitlab.com',
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (!v.trim()) return 'URL is required.';
      try {
        new URL(v.trim());
        return undefined;
      } catch {
        return 'Enter a valid URL (e.g. https://gitlab.com or https://gitlab.example.com).';
      }
    },
  });
  if (urlInput === undefined) return false;
  const baseUrl = urlInput.trim().replace(/\/$/, '');

  // ── Step 3: PAT + validation ──────────────────────────────────────────────
  const patInput = await vscode.window.showInputBox({
    title: 'ReviewFlow Setup (3/4) — Personal Access Token',
    prompt: `Token for ${baseUrl} — requires "api" scope`,
    placeHolder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? undefined : 'Token is required.'),
  });
  if (patInput === undefined) return false;
  const pat = patInput.trim();

  // Validate PAT against the GitLab API
  let currentUser: Awaited<ReturnType<GitLabClient['getCurrentUser']>>;
  try {
    currentUser = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ReviewFlow: Verifying token…',
        cancellable: false,
      },
      async () => {
        const gl = new GitLabClient(baseUrl, '/api/v4', pat, null);
        return gl.getCurrentUser();
      },
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `ReviewFlow: Authentication failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }

  const identity = isProjectBot(currentUser.username)
    ? currentUser.name
    : `@${currentUser.username}`;

  // ── Step 4: Repository discovery + selection ──────────────────────────────
  const detected = await detectGitRepositories();
  const instanceHostname = new URL(baseUrl).hostname;

  type RepoItem = vscode.QuickPickItem & {
    localPath: string;
    inferredProjectPath: string | undefined;
  };

  const repoItems: RepoItem[] = detected.map((r) => {
    const inferred = inferProjectPath(r.remotes, instanceHostname);
    return {
      label: r.label,
      description: r.localPath,
      detail: inferred
        ? `$(check) ${inferred}`
        : '$(warning) Project path unknown — you will be prompted to enter it',
      picked: !!inferred,
      localPath: r.localPath,
      inferredProjectPath: inferred,
    };
  });

  let selectedRepos: RepoItem[] = [];

  if (repoItems.length === 0) {
    vscode.window.showWarningMessage(
      'ReviewFlow: No Git repositories found in the workspace. You can add them later from the sidebar.',
    );
  } else {
    const picks = await vscode.window.showQuickPick(repoItems, {
      canPickMany: true,
      title: 'ReviewFlow Setup (4/4) — Repositories',
      placeHolder:
        'Select repositories to add (pre-selected where project path was inferred from remote)',
      ignoreFocusOut: true,
    });
    if (picks === undefined) return false;
    selectedRepos = picks;
  }

  // ── Persist: create instance ──────────────────────────────────────────────
  let instance: Awaited<ReturnType<BackendClient['createGitLabInstance']>>;
  try {
    instance = await client.createGitLabInstance({
      displayName: deriveInstanceName(baseUrl),
      baseUrl,
      caBundlePath: null,
    });
  } catch (err) {
    if (err instanceof BackendError && err.code === 'DUPLICATE_INSTANCE_URL') {
      const existing = await client.listGitLabInstances().catch(() => []);
      const found = existing.find((i) => i.baseUrl === baseUrl);
      if (!found) {
        vscode.window.showErrorMessage(
          'ReviewFlow: A GitLab instance with this URL already exists.',
        );
        return false;
      }
      instance = found;
    } else {
      vscode.window.showErrorMessage(
        `ReviewFlow: Failed to register GitLab instance — ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  // Store PAT and user profile
  await secrets.storePat(instance.id, pat);
  try {
    await client.upsertInstanceUser(instance.id, {
      gitlabUserId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.name,
      email: currentUser.email,
      avatarUrl: currentUser.avatar_url,
    });
  } catch {
    // Non-fatal — comment attribution is best-effort
  }

  // ── Persist: create repositories ─────────────────────────────────────────
  // For repos where the project path couldn't be inferred, prompt now
  const reposToCreate: Array<{ localPath: string; projectPath: string; displayName: string }> = [];

  for (const repo of selectedRepos) {
    let projectPath = repo.inferredProjectPath;
    if (!projectPath) {
      const input = await vscode.window.showInputBox({
        title: `GitLab project path — ${repo.label}`,
        prompt: `GitLab project path or full URL for "${repo.label}"`,
        placeHolder: 'group/my-project  or  https://gitlab.example.com/group/my-project',
        ignoreFocusOut: true,
        validateInput: (v) => {
          const p = extractProjectPath(v);
          return p.includes('/') ? undefined : 'Enter a path like group/project or a full GitLab URL.';
        },
      });
      if (input === undefined) continue; // user skipped this repo
      projectPath = extractProjectPath(input);
    }
    reposToCreate.push({
      localPath: repo.localPath,
      projectPath,
      displayName: path.basename(projectPath),
    });
  }

  let createdCount = 0;
  for (const r of reposToCreate) {
    try {
      await client.createRepository({
        localPath: r.localPath,
        gitlabInstanceId: instance.id,
        gitlabProjectPath: r.projectPath,
        displayName: r.displayName,
      });
      createdCount++;
    } catch (err) {
      if (
        err instanceof BackendError &&
        (err.code === 'DUPLICATE_LOCAL_PATH' || err.code === 'DUPLICATE_PROJECT')
      ) {
        createdCount++; // already registered — still a success
      } else {
        vscode.window.showWarningMessage(
          `ReviewFlow: Could not add "${r.displayName}" — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  treeProvider.refresh();

  const repoSuffix =
    createdCount > 0
      ? ` ${createdCount} ${createdCount === 1 ? 'repository' : 'repositories'} added.`
      : '';
  vscode.window.showInformationMessage(
    `ReviewFlow: ✓ Connected as ${identity}.${repoSuffix} Ready to review!`,
  );

  return true;
}
