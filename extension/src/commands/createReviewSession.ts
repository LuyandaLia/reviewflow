import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';
import type { RepoTreeItem } from '../providers/repositoryTreeProvider';

export async function createReviewSession(
  item: RepoTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: `New review session in "${item.repo.displayName}"`,
    placeHolder: 'Session name…',
    validateInput: (v) => (v.trim() ? null : 'Name cannot be empty'),
  });

  if (!name) return;

  try {
    await client.createReviewSession(item.repo.id, name.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`ReviewFlow: Failed to create session — ${msg}`);
    return;
  }

  treeProvider.refresh();
}
