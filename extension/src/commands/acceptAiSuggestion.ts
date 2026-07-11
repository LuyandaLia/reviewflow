import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { CommentUiSync } from './inlineCommentActions';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function acceptAiSuggestion(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
): Promise<void> {
  try {
    await client.acceptAiSuggestion(item.comment.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Failed to accept AI suggestion.');
    return;
  }

  treeProvider.refresh();
  await commentUi.refresh();
}
