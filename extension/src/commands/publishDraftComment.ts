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
} from '../gitlab/publishUtils';

export async function publishDraftComment(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
  secrets: SecretStorageService,
): Promise<void> {
  if (item.comment.status === 'published') {
    vscode.window.showInformationMessage('This comment is already published to GitLab.');
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

  const pat = await getOrPromptPat(secrets, instance);
  if (!pat) return;

  const mrIid = await promptMrIid(item.repo);
  if (!mrIid) return;

  const glClient = new GitLabClient(instance.baseUrl, instance.apiPath, pat, instance.caBundlePath);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Publishing comment to GitLab…',
      cancellable: false,
    },
    async () => {
      try {
        const project = await glClient.getProject(item.repo.gitlabProjectPath);
        const mr = await glClient.getMR(project.id, mrIid);

        const { noteId, discussionId } = await publishSingleComment(
          item.comment,
          glClient,
          project.id,
          mrIid,
          mr.diff_refs,
        );

        await client.updateCommentPublishStatus(
          item.comment.id,
          'published',
          String(noteId),
          discussionId || undefined,
          mrIid,
        );

        vscode.window.showInformationMessage(
          `Comment published to MR !${mrIid} on ${instance.displayName}.`,
        );
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
