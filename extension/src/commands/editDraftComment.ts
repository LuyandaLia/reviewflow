import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DecorationManager } from '../decorations/decorationManager';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function editDraftComment(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
): Promise<void> {
  if (item.comment.status === 'published') {
    vscode.window.showInformationMessage(
      'Published comments are read-only. Delete and recreate if changes are needed.',
    );
    return;
  }

  const newText = await vscode.window.showInputBox({
    title: 'Edit Draft Comment',
    prompt: 'Update comment text',
    value: item.comment.commentText,
    validateInput: (v) => (v.trim() ? null : 'Comment cannot be empty'),
  });

  if (newText === undefined || newText.trim() === item.comment.commentText) return;

  try {
    await client.updateDraftComment(item.comment.id, newText.trim());
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Failed to update comment.');
    return;
  }

  treeProvider.refresh();
  decorationManager.refresh();
}
