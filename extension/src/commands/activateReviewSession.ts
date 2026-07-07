import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';
import type { ReviewSessionTreeItem } from '../providers/repositoryTreeProvider';

export async function activateReviewSession(
  item: ReviewSessionTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
): Promise<void> {
  try {
    await client.activateReviewSession(item.session.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`ReviewFlow: Failed to activate session — ${msg}`);
    return;
  }

  treeProvider.refresh();
}
