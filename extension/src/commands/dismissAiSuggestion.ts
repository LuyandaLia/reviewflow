import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DecorationManager } from '../decorations/decorationManager';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function dismissAiSuggestion(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
): Promise<void> {
  try {
    await client.deleteDraftComment(item.comment.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Failed to dismiss AI suggestion.');
    return;
  }

  treeProvider.refresh();
  decorationManager.refresh();
}
