import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { CommentUiSync } from './inlineCommentActions';
import type { RepositoryTreeProvider, ReviewSessionTreeItem } from '../providers/repositoryTreeProvider';
import { GitLabClient } from '../gitlab/gitlabClient';
import { SecretStorageService } from '../gitlab/secretStorageService';
import { getOrPromptPat, handleAuthError } from '../gitlab/publishUtils';

export async function syncReviewSession(
  item: ReviewSessionTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
  secrets: SecretStorageService,
): Promise<void> {
  let comments;
  try {
    comments = await client.listSessionComments(item.session.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return;
  }

  // Only sync comments that were published and have GitLab tracking info.
  const syncable = comments.filter(
    (c) => c.status === 'published' && c.gitlabNoteId !== null && c.gitlabMrIid !== null,
  );

  const skipped = comments.filter(
    (c) => c.status === 'published' && (c.gitlabNoteId === null || c.gitlabMrIid === null),
  ).length;

  if (syncable.length === 0) {
    if (skipped > 0) {
      vscode.window.showInformationMessage(
        `${skipped} published comment(s) lack GitLab tracking info and cannot be synced.` +
          ' Re-publish them to enable sync.',
      );
    } else {
      vscode.window.showInformationMessage('No published comments to sync in this session.');
    }
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

  const glClient = new GitLabClient(instance.baseUrl, instance.apiPath, pat, instance.caBundlePath);

  let verifiedCount = 0;
  let revertedCount = 0;
  let errorCount = 0;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Syncing ${syncable.length} published comment(s) with GitLab…`,
      cancellable: false,
    },
    async (progress) => {
      let projectId: number;
      try {
        const project = await glClient.getProject(item.repo.gitlabProjectPath);
        projectId = project.id;
      } catch (err) {
        const wasAuth = await handleAuthError(err, secrets, instance);
        if (!wasAuth) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`ReviewFlow: Cannot connect to GitLab — ${msg}`);
        }
        return;
      }

      for (let i = 0; i < syncable.length; i++) {
        const comment = syncable[i];
        progress.report({
          increment: (1 / syncable.length) * 100,
          message: `${i + 1}/${syncable.length}`,
        });

        try {
          const exists = await glClient.noteExists(
            projectId,
            comment.gitlabMrIid!,
            Number(comment.gitlabNoteId!),
          );

          if (exists) {
            verifiedCount++;
          } else {
            // Note was deleted from GitLab — reset to draft so it can be republished.
            await client.updateCommentPublishStatus(comment.id, 'draft');
            revertedCount++;
          }
        } catch (err) {
          const wasAuth = await handleAuthError(err, secrets, instance);
          if (wasAuth) {
            // Mark remaining as errors but don't loop further.
            errorCount += syncable.length - i;
            break;
          }
          errorCount++;
        }
      }
    },
  );

  const parts: string[] = [];
  if (verifiedCount > 0) parts.push(`${verifiedCount} still on GitLab`);
  if (revertedCount > 0) parts.push(`${revertedCount} deleted from GitLab (reset to draft)`);
  if (errorCount > 0) parts.push(`${errorCount} could not be checked`);
  if (skipped > 0) parts.push(`${skipped} skipped (no tracking info)`);

  if (revertedCount > 0 || errorCount > 0) {
    vscode.window.showWarningMessage(`Sync complete — ${parts.join(', ')}.`);
  } else {
    vscode.window.showInformationMessage(`Sync complete — ${parts.join(', ')}.`);
  }

  treeProvider.refresh();
  await commentUi.refresh();
}
