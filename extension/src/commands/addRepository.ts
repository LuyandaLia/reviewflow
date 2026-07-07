import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BackendError, type BackendClient } from '../api/backendClient';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

interface DetectedRepo {
  localPath: string;
  label: string;
}

async function detectGitRepositories(): Promise<DetectedRepo[]> {
  try {
    const gitExt = vscode.extensions.getExtension('vscode.git');
    if (gitExt) {
      if (!gitExt.isActive) {
        await gitExt.activate();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (gitExt.exports as any).getAPI(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repos: any[] = api?.repositories ?? [];
      if (repos.length > 0) {
        return repos.map((r) => ({
          localPath: r.rootUri.fsPath as string,
          label: path.basename(r.rootUri.fsPath as string),
        }));
      }
    }
  } catch {
    // fall through to filesystem check
  }

  return (vscode.workspace.workspaceFolders ?? [])
    .filter((f) => fs.existsSync(path.join(f.uri.fsPath, '.git')))
    .map((f) => ({ localPath: f.uri.fsPath, label: f.name }));
}

function extractProjectPath(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    return url.pathname.replace(/^\//, '').replace(/\.git$/, '');
  } catch {
    return trimmed.replace(/\.git$/, '');
  }
}

export async function addRepository(
  client: BackendClient,
  provider: RepositoryTreeProvider,
): Promise<void> {
  const instances = await client.listGitLabInstances().catch(() => []);
  if (instances.length === 0) {
    vscode.window.showErrorMessage(
      'No GitLab instances registered. Add a GitLab instance first.',
    );
    return;
  }

  const detected = await detectGitRepositories();
  const autoDetected = detected.length === 1;
  const total = autoDetected ? 3 : 4;

  const instancePick = await vscode.window.showQuickPick(
    instances.map((i) => ({ label: i.displayName, description: i.baseUrl, id: i.id })),
    { title: `Add Repository (1/${total})`, placeHolder: 'Select a GitLab instance' },
  );
  if (!instancePick) return;

  let localPath: string;

  if (autoDetected) {
    localPath = detected[0].localPath;
  } else if (detected.length > 1) {
    const pick = await vscode.window.showQuickPick(
      detected.map((r) => ({ label: r.label, description: r.localPath, localPath: r.localPath })),
      { title: `Add Repository (2/${total})`, placeHolder: 'Select the local repository' },
    );
    if (!pick) return;
    localPath = pick.localPath;
  } else {
    const uris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select Repository',
      title: `Add Repository (2/${total}) — Select repository folder`,
    });
    if (!uris || uris.length === 0) return;
    localPath = uris[0].fsPath;
  }

  const projectStep = autoDetected ? 2 : 3;
  const projectInput = await vscode.window.showInputBox({
    title: `Add Repository (${projectStep}/${total})`,
    prompt: 'GitLab project path or full URL',
    placeHolder: 'group/my-project  or  https://gitlab.example.com/group/my-project',
    validateInput: (v) => {
      const extracted = extractProjectPath(v);
      return extracted.includes('/')
        ? undefined
        : 'Enter a path like group/project or a full GitLab URL.';
    },
  });
  if (projectInput === undefined) return;

  const projectPath = extractProjectPath(projectInput);
  const defaultName = path.basename(projectPath);

  const nameStep = autoDetected ? 3 : 4;
  const displayName = await vscode.window.showInputBox({
    title: `Add Repository (${nameStep}/${total})`,
    prompt: 'Display name for this repository',
    value: defaultName,
    validateInput: (v) => (v.trim() ? undefined : 'Display name is required.'),
  });
  if (displayName === undefined) return;

  try {
    await client.createRepository({
      localPath,
      gitlabInstanceId: instancePick.id,
      gitlabProjectPath: projectPath,
      displayName: displayName.trim(),
    });
    provider.refresh();
  } catch (err) {
    if (err instanceof BackendError) {
      switch (err.code) {
        case 'DUPLICATE_LOCAL_PATH':
          vscode.window.showErrorMessage('This local path is already registered.');
          break;
        case 'DUPLICATE_PROJECT':
          vscode.window.showErrorMessage(
            'This GitLab project is already registered for that instance.',
          );
          break;
        case 'PATH_NOT_FOUND':
          vscode.window.showErrorMessage(`Path not found: ${localPath}`);
          break;
        case 'PATH_NOT_A_DIRECTORY':
          vscode.window.showErrorMessage(`Path is not a directory: ${localPath}`);
          break;
        default:
          vscode.window.showErrorMessage(`Failed to add repository: ${err.message}`);
      }
    } else {
      vscode.window.showErrorMessage(
        `Failed to add repository: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
