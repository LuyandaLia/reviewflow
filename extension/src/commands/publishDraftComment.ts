import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DecorationManager } from '../decorations/decorationManager';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';
import { GitLabClient } from '../gitlab/gitlabClient';
import { SecretStorageService } from '../gitlab/secretStorageService';
import {
  formatGitLabError,
  getOrPromptPat,
  handleAuthError,
  promptMrIid,
  publishSingleComment,
  type ReviewerIdentity,
} from '../gitlab/publishUtils';

export async function publishDraftComment(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
  secrets: SecretStorageService,
): Promise<void> {
  if (item.comment.status === 'published') {
    vscode.window.showInformationMessage('ReviewFlow: This comment is already published to GitLab.');
    return;
  }

  let instances;
  try {
    instances = await client.listGitLabInstances();
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return;
  }

  const instance = instances.find((i) => i.id === item.repo.gitlabInstanceId);
  if (!instance) {
    vscode.window.showErrorMessage('ReviewFlow: GitLab instance not found for this repository.');
    return;
  }

  const pat = await getOrPromptPat(secrets, instance, client);
  if (!pat) return;

  const mrIid = await promptMrIid(item.repo);
  if (!mrIid) return;

  const glClient = new GitLabClient(instance.baseUrl, instance.apiPath, pat, instance.caBundlePath);

  // Look up stored reviewer profile for comment attribution (best-effort)
  const storedUser = await client.getInstanceUser(instance.id);
  const reviewer: ReviewerIdentity | undefined =
    storedUser ? { username: storedUser.username, email: storedUser.email } : undefined;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'ReviewFlow: Publishing comment to GitLab…',
      cancellable: false,
    },
    async () => {
      try {
        const project = await glClient.resolveProject(item.repo.gitlabProjectPath);
        const mr = await glClient.getMR(project.id, mrIid);

        const { noteId, discussionId, isInline } = await publishSingleComment(
          item.comment,
          glClient,
          project.id,
          mrIid,
          mr.diff_refs,
          reviewer,
        );

        await client.updateCommentPublishStatus(
          item.comment.id,
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
      } catch (err) {
        const wasAuthError = await handleAuthError(err, secrets, instance);
        if (!wasAuthError) {
          await client.updateCommentPublishStatus(item.comment.id, 'failed');
          vscode.window.showErrorMessage(`ReviewFlow: Publish failed — ${formatGitLabError(err)}`);
        }
      }
    },
  );

  treeProvider.refresh();
  decorationManager.refresh();
}
