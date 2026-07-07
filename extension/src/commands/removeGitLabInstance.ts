import * as vscode from 'vscode';
import { BackendError, type BackendClient } from '../api/backendClient';
import type { InstanceTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function removeGitLabInstance(
  item: InstanceTreeItem,
  client: BackendClient,
  provider: RepositoryTreeProvider,
): Promise<void> {
  const confirmed = await vscode.window.showWarningMessage(
    `Remove GitLab instance "${item.instance.displayName}"?`,
    { modal: true },
    'Remove',
  );
  if (confirmed !== 'Remove') return;

  try {
    await client.deleteGitLabInstance(item.instance.id);
    provider.refresh();
  } catch (err) {
    if (err instanceof BackendError && err.code === 'INSTANCE_HAS_REPOSITORIES') {
      vscode.window.showErrorMessage(
        `Cannot remove instance: ${err.message} Remove all repositories under it first.`,
      );
    } else {
      vscode.window.showErrorMessage(
        `Failed to remove instance: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
