import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { CommentUiSync } from './inlineCommentActions';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function dismissAiSuggestion(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
): Promise<void> {
  try {
    await client.deleteDraftComment(item.comment.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Failed to dismiss AI suggestion.');
    return;
  }

  treeProvider.refresh();
  await commentUi.refresh();
}
