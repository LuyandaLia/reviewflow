import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import { publishCommentToGitLab } from '../gitlab/publishComment';
import type { SecretStorageService } from '../gitlab/secretStorageService';
import type { CommentUiSync } from './inlineCommentActions';
import type { DraftCommentTreeItem, RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function publishDraftComment(
  item: DraftCommentTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  commentUi: CommentUiSync,
  secrets: SecretStorageService,
  extensionContext: vscode.ExtensionContext,
): Promise<void> {
  const success = await publishCommentToGitLab(
    item.comment,
    item.repo,
    client,
    secrets,
    extensionContext,
  );

  if (success) {
    treeProvider.refresh();
  }
  await commentUi.refresh();
}
