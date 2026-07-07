import * as path from 'path';
import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DecorationManager } from '../decorations/decorationManager';
import type { RepositoryTreeProvider, ReviewSessionTreeItem } from '../providers/repositoryTreeProvider';
import { GitLabClient } from '../gitlab/gitlabClient';
import { SecretStorageService } from '../gitlab/secretStorageService';
import {
  formatGitLabError,
  getOrPromptPat,
  handleAuthError,
  promptMrIid,
  publishSingleComment,
} from '../gitlab/publishUtils';

export async function publishReviewSession(
  item: ReviewSessionTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
  secrets: SecretStorageService,
): Promise<void> {
  let comments;
  try {
    comments = await client.listSessionComments(item.session.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return;
  }

  const toPublish = comments.filter((c) => c.status !== 'published');
  if (toPublish.length === 0) {
    vscode.window.showInformationMessage(
      'All comments in this session are already published.',
    );
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

  let successCount = 0;
  let failCount = 0;
  let authFailed = false;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Publishing ${toPublish.length} comment(s) to MR !${mrIid}…`,
      cancellable: false,
    },
    async (progress) => {
      let project: { id: number };
      let mr: { diff_refs: { base_sha: string; head_sha: string; start_sha: string } | null };

      try {
        project = await glClient.getProject(item.repo.gitlabProjectPath);
        mr = await glClient.getMR(project.id, mrIid);
      } catch (err) {
        authFailed = await handleAuthError(err, secrets, instance);
        if (!authFailed) {
          vscode.window.showErrorMessage(`ReviewFlow: Cannot connect to GitLab — ${formatGitLabError(err)}`);
        }
        return;
      }

      for (let i = 0; i < toPublish.length; i++) {
        const comment = toPublish[i];
        progress.report({
          increment: (1 / toPublish.length) * 100,
          message: `${i + 1}/${toPublish.length} — ${path.basename(comment.filePath)}:${comment.lineNumber}`,
        });

        try {
          const { noteId, discussionId } = await publishSingleComment(
            comment,
            glClient,
            project.id,
            mrIid,
            mr.diff_refs,
          );
          await client.updateCommentPublishStatus(
            comment.id,
            'published',
            String(noteId),
            discussionId || undefined,
            mrIid,
          );
          successCount++;
        } catch (err) {
          const wasAuth = await handleAuthError(err, secrets, instance);
          if (wasAuth) {
            authFailed = true;
            // Mark remaining as failed
            for (let j = i; j < toPublish.length; j++) {
              await client.updateCommentPublishStatus(toPublish[j].id, 'failed').catch(() => {});
              failCount++;
            }
            break;
          }
          await client.updateCommentPublishStatus(comment.id, 'failed').catch(() => {});
          failCount++;
        }
      }
    },
  );

  if (!authFailed) {
    if (failCount === 0) {
      vscode.window.showInformationMessage(
        `Published ${successCount} comment(s) to MR !${mrIid} on ${instance.displayName}.`,
      );
    } else {
      vscode.window.showWarningMessage(
        `Published ${successCount} comment(s); ${failCount} failed — right-click failed items to retry.`,
      );
    }
  }

  treeProvider.refresh();
  decorationManager.refresh();
}
