import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { RepoTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function removeRepository(
  item: RepoTreeItem,
  client: BackendClient,
  provider: RepositoryTreeProvider,
): Promise<void> {
  const confirmed = await vscode.window.showWarningMessage(
    `Remove repository "${item.repo.displayName}"?`,
    { modal: true },
    'Remove',
  );
  if (confirmed !== 'Remove') return;

  try {
    await client.deleteRepository(item.repo.id);
    provider.refresh();
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to remove repository: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
