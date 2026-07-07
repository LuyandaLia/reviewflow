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
  if (stored) return stored;

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
      avatarUrl: user.avatar_url,
    });
  } catch {
    // Non-fatal — PAT is valid, user profile storage is best-effort
  }

  vscode.window.showInformationMessage(`ReviewFlow: ✓ Connected as @${user.username}`);
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

export interface PublishResult {
  noteId: number;
  discussionId: string;
}

export async function publishSingleComment(
  comment: DraftComment,
  glClient: GitLabClient,
  projectId: number,
  mrIid: number,
  diffRefs: { base_sha: string; head_sha: string; start_sha: string } | null,
  username?: string,
): Promise<PublishResult> {
  const body = _buildCommentBody(comment, username);

  const position = diffRefs
    ? {
        baseSha: diffRefs.base_sha,
        headSha: diffRefs.head_sha,
        startSha: diffRefs.start_sha,
        newPath: comment.filePath,
        newLine: comment.lineNumber,
      }
    : null;

  return glClient.publishDiscussion(projectId, mrIid, body, position);
}

function _buildCommentBody(comment: DraftComment, username?: string): string {
  const text =
    comment.severity !== 'info'
      ? `**[${comment.severity.toUpperCase()}]** ${comment.commentText}`
      : comment.commentText;

  const attribution = username ? `ReviewFlow • @${username}` : 'ReviewFlow';
  return `${text}\n\n---\n*${attribution}*`;
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
): Promise<boolean> {
  if (err instanceof GitLabApiError && (err.status === 401 || err.status === 403)) {
    const action = await vscode.window.showErrorMessage(
      `ReviewFlow: GitLab authentication failed for ${instance.displayName}. Token may have expired.`,
      'Update Token',
      'Cancel',
    );
    if (action === 'Update Token') {
      await secrets.deletePat(instance.id);
      vscode.window.showInformationMessage(
        'ReviewFlow: Token cleared — run Publish again to enter a new token.',
      );
    }
    return true;
  }
  return false;
}
