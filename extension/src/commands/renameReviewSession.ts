import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';
import type { ReviewSessionTreeItem } from '../providers/repositoryTreeProvider';

export async function renameReviewSession(
  item: ReviewSessionTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: `Rename review session "${item.session.name}"`,
    value: item.session.name,
    validateInput: (v) => (v.trim() ? null : 'Name cannot be empty'),
  });

  if (!name || name.trim() === item.session.name) return;

  try {
    await client.renameReviewSession(item.session.id, name.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`ReviewFlow: Failed to rename session — ${msg}`);
    return;
  }

  treeProvider.refresh();
}
