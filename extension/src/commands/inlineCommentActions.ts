import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import { publishCommentToGitLab } from '../gitlab/publishComment';
import { promptMrIid } from '../gitlab/publishUtils';
import type { SecretStorageService } from '../gitlab/secretStorageService';
import type { DraftComment, Repository } from '../models/types';
import type { DraftCommentController } from '../providers/draftCommentController';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';
import { ReviewComment } from '../providers/reviewComment';

export interface CommentUiSync {
  refresh(): Promise<void>;
}

async function resolveRepo(
  client: BackendClient,
  repositoryId: string,
): Promise<Repository | undefined> {
  try {
    const repos = await client.listRepositories();
    return repos.find((r) => r.id === repositoryId);
  } catch {
    return undefined;
  }
}

export async function saveInlineDraft(
  reply: vscode.CommentReply,
  controller: DraftCommentController,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
): Promise<void> {
  const saved = await controller.saveDraft(reply);
  if (saved) {
    treeProvider.refresh();
    await commentUi.refresh();
  }
}

export async function publishInlineComment(
  reply: vscode.CommentReply,
  controller: DraftCommentController,
  client: BackendClient,
  secrets: SecretStorageService,
  extensionContext: vscode.ExtensionContext,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
): Promise<void> {
  let draft = await controller.saveDraft(reply);

  if (!draft) {
    const thread = reply.thread;
    const target = [...thread.comments]
      .reverse()
      .find((c) => {
        const rc = c as ReviewComment;
        return rc.draftCommentId && rc.status !== 'published';
      }) as ReviewComment | undefined;

    if (!target?.draftCommentId) {
      vscode.window.showWarningMessage('ReviewFlow: Nothing to publish.');
      return;
    }

    const meta = controller.getThreadMeta(thread);
    if (!meta) {
      return;
    }

    draft = {
      id: target.draftCommentId,
      repositoryId: meta.repositoryId,
      reviewSessionId: meta.reviewSessionId,
      filePath: meta.relativePath,
      lineNumber: meta.lineNumber,
      endLineNumber: meta.endLineNumber,
      commentText: target.savedBody,
      severity: target.severity,
      status: target.status,
      origin: target.origin,
      gitlabNoteId: null,
      gitlabDiscussionId: null,
      gitlabMrIid: null,
      publishedByUserId: null,
      publishedByUsername: null,
      publishedAt: null,
      createdAt: '',
      updatedAt: '',
    };
  }

  const repo = await resolveRepo(client, draft.repositoryId);
  if (!repo) {
    vscode.window.showErrorMessage('ReviewFlow: Repository not found.');
    return;
  }

  const success = await publishCommentToGitLab(
    draft,
    repo,
    client,
    secrets,
    extensionContext,
  );

  if (success) {
    treeProvider.refresh();
    await commentUi.refresh();
  } else {
    await commentUi.refresh();
  }
}

export async function publishReviewComment(
  comment: ReviewComment,
  controller: DraftCommentController,
  client: BackendClient,
  secrets: SecretStorageService,
  extensionContext: vscode.ExtensionContext,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
): Promise<void> {
  if (!comment.draftCommentId || !comment.parent) {
    return;
  }

  const meta = controller.getThreadMeta(comment.parent);
  if (!meta) {
    return;
  }

  const draft: DraftComment = {
    id: comment.draftCommentId,
    repositoryId: meta.repositoryId,
    reviewSessionId: meta.reviewSessionId,
    filePath: meta.relativePath,
    lineNumber: meta.lineNumber,
    endLineNumber: meta.endLineNumber,
    commentText: comment.savedBody,
    severity: comment.severity,
    status: comment.status,
    origin: comment.origin,
    gitlabNoteId: null,
    gitlabDiscussionId: null,
    gitlabMrIid: null,
    publishedByUserId: null,
    publishedByUsername: null,
    publishedAt: null,
    createdAt: '',
    updatedAt: '',
  };

  const repo = await resolveRepo(client, draft.repositoryId);
  if (!repo) {
    return;
  }

  const success = await publishCommentToGitLab(
    draft,
    repo,
    client,
    secrets,
    extensionContext,
  );

  if (success) {
    treeProvider.refresh();
  }
  await commentUi.refresh();
}

export function cancelInlineComposer(
  threadOrReply: vscode.CommentThread | vscode.CommentReply | undefined,
  controller: DraftCommentController,
): void {
  const thread =
    threadOrReply && 'thread' in threadOrReply
      ? threadOrReply.thread
      : (threadOrReply ?? controller.findActivePendingThread());
  if (thread) {
    controller.cancel(thread);
  }
}

export async function changeCachedMrIid(
  client: BackendClient,
  extensionContext: vscode.ExtensionContext,
): Promise<void> {
  let repos;
  try {
    repos = await client.listRepositories();
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return;
  }

  if (repos.length === 0) {
    vscode.window.showErrorMessage('ReviewFlow: No repositories registered.');
    return;
  }

  const pick = await vscode.window.showQuickPick(
    repos.map((r) => ({ label: r.displayName, repo: r })),
    { placeHolder: 'Select repository to set MR IID for' },
  );
  if (!pick) {
    return;
  }

  const iid = await promptMrIid(pick.repo);
  if (iid) {
    await extensionContext.globalState.update(`reviewflow.lastMrIid.${pick.repo.id}`, iid);
    vscode.window.showInformationMessage(`ReviewFlow: MR IID set to !${iid} for ${pick.repo.displayName}.`);
  }
}
