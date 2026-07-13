import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DraftComment, Repository } from '../models/types';
import { GitLabClient } from './gitlabClient';
import type { SecretStorageService } from './secretStorageService';
import {
  formatGitLabError,
  getOrPromptPat,
  getOrPromptMrIid,
  handleAuthError,
  publishSingleComment,
  type ReviewerIdentity,
} from './publishUtils';

export async function publishCommentToGitLab(
  comment: DraftComment,
  repo: Repository,
  client: BackendClient,
  secrets: SecretStorageService,
  extensionContext: vscode.ExtensionContext,
): Promise<boolean> {
  if (comment.status === 'published') {
    vscode.window.showInformationMessage('ReviewFlow: This comment is already published to GitLab.');
    return false;
  }

  let instances;
  try {
    instances = await client.listGitLabInstances();
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return false;
  }

  const instance = instances.find((i) => i.id === repo.gitlabInstanceId);
  if (!instance) {
    vscode.window.showErrorMessage('ReviewFlow: GitLab instance not found for this repository.');
    return false;
  }

  const pat = await getOrPromptPat(secrets, instance, client);
  if (!pat) {
    return false;
  }

  const mrIid = await getOrPromptMrIid(repo, extensionContext);
  if (!mrIid) {
    return false;
  }

  const glClient = new GitLabClient(instance.baseUrl, instance.apiPath, pat, instance.caBundlePath);
  const storedUser = await client.getInstanceUser(instance.id);
  const reviewer: ReviewerIdentity | undefined = storedUser
    ? { username: storedUser.username, email: storedUser.email }
    : undefined;

  let success = false;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'ReviewFlow: Publishing comment to GitLab…',
      cancellable: false,
    },
    async () => {
      try {
        const project = await glClient.resolveProject(repo.gitlabProjectPath);
        const mr = await glClient.getMR(project.id, mrIid);

        const { noteId, discussionId, isInline } = await publishSingleComment(
          comment,
          glClient,
          project.id,
          mrIid,
          mr.diff_refs,
          reviewer,
        );

        await client.updateCommentPublishStatus(
          comment.id,
          'published',
          String(noteId),
          discussionId || undefined,
          mrIid,
          storedUser?.gitlabUserId,
          storedUser?.username,
          new Date().toISOString(),
        );

        if (!isInline) {
          vscode.window.showWarningMessage(
            `ReviewFlow: Comment published to MR !${mrIid} as a general note — the line is no longer in the diff.`,
          );
        } else {
          vscode.window.showInformationMessage(
            `ReviewFlow: Comment published to MR !${mrIid} on ${instance.displayName}.`,
          );
        }
        success = true;
      } catch (err) {
        const wasAuthError = await handleAuthError(err, secrets, instance, client);
        if (!wasAuthError) {
          await client.updateCommentPublishStatus(comment.id, 'failed');
          vscode.window.showErrorMessage(`ReviewFlow: Publish failed — ${formatGitLabError(err)}`);
        }
      }
    },
  );

  return success;
}
