import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DecorationManager } from '../decorations/decorationManager';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function acceptAiSuggestion(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
): Promise<void> {
  try {
    await client.acceptAiSuggestion(item.comment.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Failed to accept AI suggestion.');
    return;
  }

  treeProvider.refresh();
  decorationManager.refresh();
}
