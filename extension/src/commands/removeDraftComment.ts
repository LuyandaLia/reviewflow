import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { CommentUiSync } from './inlineCommentActions';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function removeDraftComment(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    `Delete comment on ${item.label as string}?`,
    { modal: true },
    'Delete',
  );

  if (confirm !== 'Delete') return;

  try {
    await client.deleteDraftComment(item.comment.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Failed to delete comment.');
    return;
  }

  treeProvider.refresh();
  await commentUi.refresh();
}
