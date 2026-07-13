import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DraftComment, GitLabInstance, Repository } from '../models/types';
import { GitLabApiError, GitLabClient } from './gitlabClient';
import type { SecretStorageService } from './secretStorageService';

export async function getOrPromptPat(
  secrets: SecretStorageService,
  instance: GitLabInstance,
  client: BackendClient,
): Promise<string | undefined> {
  const stored = await secrets.getPat(instance.id);
  if (stored) {
    // Backfill user profile if it was lost (e.g. silent upsert failure on a prior auth cycle)
    const existingUser = await client.getInstanceUser(instance.id);
    if (!existingUser) {
      try {
        const glClient = new GitLabClient(instance.baseUrl, instance.apiPath, stored, instance.caBundlePath);
        const user = await glClient.getCurrentUser();
        await client.upsertInstanceUser(instance.id, {
          gitlabUserId: user.id,
          username: user.username,
          displayName: user.name,
          email: user.email,
          avatarUrl: user.avatar_url,
        });
      } catch {
        // Non-fatal — comment attribution is best-effort
      }
    }
    return stored;
  }

  const pat = await vscode.window.showInputBox({
    prompt: `Personal Access Token for ${instance.displayName} (${instance.baseUrl})`,
    placeHolder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? null : 'Token cannot be empty'),
  });

  if (!pat) return undefined;
  const trimmed = pat.trim();

  // Validate immediately before storing
  const glClient = new GitLabClient(instance.baseUrl, instance.apiPath, trimmed, instance.caBundlePath);
  let user;
  try {
    user = await glClient.getCurrentUser();
  } catch (err) {
    vscode.window.showErrorMessage(
      `ReviewFlow: GitLab authentication failed — ${formatGitLabError(err)}`,
    );
    return undefined;
  }

  await secrets.storePat(instance.id, trimmed);

  try {
    await client.upsertInstanceUser(instance.id, {
      gitlabUserId: user.id,
      username: user.username,
      displayName: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
    });
  } catch {
    // Non-fatal — PAT is valid, user profile storage is best-effort
  }

  const identity = _isProjectBot(user.username) ? user.name : `@${user.username}`;
  vscode.window.showInformationMessage(`ReviewFlow: ✓ Connected as ${identity}`);
  return trimmed;
}

export async function promptMrIid(repo: Repository): Promise<number | undefined> {
  const input = await vscode.window.showInputBox({
    prompt: `MR IID or full URL for repository "${repo.gitlabProjectPath}"`,
    placeHolder: '42  or  https://gitlab.example.com/group/project/-/merge_requests/42',
    ignoreFocusOut: true,
  });

  if (!input) return undefined;
  const trimmed = input.trim();

  // Plain IID: digits only
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    if (n > 0) return n;
  }

  // Full MR URL: extract project path and IID, then validate project path
  const urlMatch = trimmed.match(/^https?:\/\/[^/]+\/(.+?)\/-\/merge_requests\/(\d+)/);
  if (urlMatch) {
    const urlProjectPath = urlMatch[1];
    const iid = parseInt(urlMatch[2], 10);

    if (urlProjectPath !== repo.gitlabProjectPath) {
      vscode.window.showErrorMessage(
        `MR URL project path "${urlProjectPath}" does not match registered repository "${repo.gitlabProjectPath}".`,
      );
      return undefined;
    }

    return iid;
  }

  vscode.window.showErrorMessage(
    'Invalid input — enter a plain MR IID (e.g. 42) or a full MR URL ending in /-/merge_requests/{iid}.',
  );
  return undefined;
}

export async function getOrPromptMrIid(
  repo: Repository,
  extensionContext: vscode.ExtensionContext,
): Promise<number | undefined> {
  const key = `reviewflow.lastMrIid.${repo.id}`;
  const cached = extensionContext.globalState.get<number>(key);
  if (cached && cached > 0) {
    return cached;
  }

  const iid = await promptMrIid(repo);
  if (iid) {
    await extensionContext.globalState.update(key, iid);
  }
  return iid;
}

export interface PublishResult {
  noteId: number;
  discussionId: string;
  isInline: boolean;
}

export interface ReviewerIdentity {
  username: string;
  email?: string | null;
}

export async function publishSingleComment(
  comment: DraftComment,
  glClient: GitLabClient,
  projectId: number,
  mrIid: number,
  diffRefs: { base_sha: string; head_sha: string; start_sha: string } | null,
  reviewer?: ReviewerIdentity,
): Promise<PublishResult> {
  const body = _buildCommentBody(comment, reviewer);

  const position = diffRefs
    ? {
        baseSha: diffRefs.base_sha,
        headSha: diffRefs.head_sha,
        startSha: diffRefs.start_sha,
        newPath: comment.filePath,
        newLine: comment.lineNumber,
      }
    : null;

  const result = await glClient.publishDiscussion(projectId, mrIid, body, position);
  return {
    ...result,
    isInline: result.discussionId !== '',
  };
}

function _buildCommentBody(comment: DraftComment, reviewer?: ReviewerIdentity): string {
  const text =
    comment.severity !== 'info'
      ? `**[${comment.severity.toUpperCase()}]** ${comment.commentText}`
      : comment.commentText;

  const footer = _buildFooter(reviewer);
  return `${text}\n\n---\n${footer}`;
}

function _buildFooter(reviewer?: ReviewerIdentity): string {
  if (!reviewer || _isProjectBot(reviewer.username)) {
    return '*ReviewFlow*';
  }
  // Use \n\n between each element — single \n renders as a space in GitLab Markdown
  let footer = '**ReviewFlow**\n\n';
  if (reviewer.email) footer += `${reviewer.email}\n\n`;
  footer += `@${reviewer.username}`;
  return footer;
}

function _isProjectBot(username: string): boolean {
  return /^project_\d+_bot/.test(username);
}

export function formatGitLabError(err: unknown): string {
  if (err instanceof GitLabApiError) {
    const parts: string[] = [`HTTP ${err.status}`, err.message];
    if (err.endpoint) parts.push(`[${err.endpoint}]`);
    return parts.join(' — ');
  }
  return err instanceof Error ? err.message : String(err);
}

export async function handleAuthError(
  err: unknown,
  secrets: SecretStorageService,
  instance: GitLabInstance,
  client?: BackendClient,
): Promise<boolean> {
  if (!(err instanceof GitLabApiError && (err.status === 401 || err.status === 403))) {
    return false;
  }

  const detail =
    err.status === 403
      ? 'Token lacks required API scope or access to this project.'
      : 'Token is invalid or expired.';

  const action = await vscode.window.showErrorMessage(
    `ReviewFlow: GitLab authentication failed for ${instance.displayName}. ${detail}`,
    'Update Token',
    'Cancel',
  );

  if (action === 'Update Token') {
    await secrets.deletePat(instance.id);
    if (client) {
      await getOrPromptPat(secrets, instance, client);
    } else {
      vscode.window.showInformationMessage(
        'ReviewFlow: Token cleared — run Publish again to enter a new token.',
      );
    }
  }

  return true;
}
