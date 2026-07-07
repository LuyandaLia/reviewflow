import * as path from 'path';
import * as vscode from 'vscode';
import { BackendManager } from './backend/backendManager';
import { BackendClient } from './api/backendClient';
import { RepositoryTreeProvider } from './providers/repositoryTreeProvider';
import type {
  DraftCommentTreeItem,
  InstanceTreeItem,
  RepoTreeItem,
  ReviewSessionTreeItem,
} from './providers/repositoryTreeProvider';
import { addGitLabInstance } from './commands/addGitLabInstance';
import { removeGitLabInstance } from './commands/removeGitLabInstance';
import { addRepository } from './commands/addRepository';
import { removeRepository } from './commands/removeRepository';
import { addDraftComment } from './commands/addDraftComment';
import { editDraftComment } from './commands/editDraftComment';
import { removeDraftComment } from './commands/removeDraftComment';
import { createReviewSession } from './commands/createReviewSession';
import { renameReviewSession } from './commands/renameReviewSession';
import { deleteReviewSession } from './commands/deleteReviewSession';
import { activateReviewSession } from './commands/activateReviewSession';
import { publishDraftComment } from './commands/publishDraftComment';
import { publishReviewSession } from './commands/publishReviewSession';
import { syncReviewSession } from './commands/syncReviewSession';
import { suggestAiComments } from './commands/suggestAiComments';
import { acceptAiSuggestion } from './commands/acceptAiSuggestion';
import { dismissAiSuggestion } from './commands/dismissAiSuggestion';
import { DecorationManager } from './decorations/decorationManager';
import { SecretStorageService } from './gitlab/secretStorageService';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new BackendManager();
  const client = new BackendClient(manager);
  const treeProvider = new RepositoryTreeProvider(client);
  const decorationManager = new DecorationManager(client, context.extensionUri);
  const secretsService = new SecretStorageService(context.secrets);

  let notificationActive = false;

  context.subscriptions.push(
    manager,
    decorationManager,

    treeProvider.onStatusChanged((status) => {
      if (status === 'unavailable' && !notificationActive) {
        notificationActive = true;
        vscode.window
          .showErrorMessage(
            'ReviewFlow: Cannot connect to the backend.',
            'Retry',
          )
          .then((choice) => {
            notificationActive = false;
            if (choice === 'Retry') {
              treeProvider.refresh();
            }
          });
      } else if (status === 'available') {
        notificationActive = false;
      }
    }),

    vscode.window.createTreeView('reviewflow.repositories', {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    }),

    vscode.commands.registerCommand('reviewflow.refreshRepositories', () => {
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('reviewflow.retryConnection', () => {
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('reviewflow.addGitLabInstance', () =>
      addGitLabInstance(client, treeProvider),
    ),

    vscode.commands.registerCommand(
      'reviewflow.removeGitLabInstance',
      (item: InstanceTreeItem) => removeGitLabInstance(item, client, treeProvider),
    ),

    vscode.commands.registerCommand('reviewflow.addRepository', () =>
      addRepository(client, treeProvider),
    ),

    vscode.commands.registerCommand(
      'reviewflow.removeRepository',
      (item: RepoTreeItem) => removeRepository(item, client, treeProvider),
    ),

    vscode.commands.registerCommand('reviewflow.addDraftComment', () =>
      addDraftComment(client, treeProvider, decorationManager),
    ),

    vscode.commands.registerCommand(
      'reviewflow.editDraftComment',
      (item: DraftCommentTreeItem) => editDraftComment(item, client, treeProvider, decorationManager),
    ),

    vscode.commands.registerCommand(
      'reviewflow.removeDraftComment',
      (item: DraftCommentTreeItem) => removeDraftComment(item, client, treeProvider, decorationManager),
    ),

    vscode.commands.registerCommand(
      'reviewflow.createReviewSession',
      (item: RepoTreeItem) => createReviewSession(item, client, treeProvider),
    ),

    vscode.commands.registerCommand(
      'reviewflow.renameReviewSession',
      (item: ReviewSessionTreeItem) => renameReviewSession(item, client, treeProvider),
    ),

    vscode.commands.registerCommand(
      'reviewflow.deleteReviewSession',
      (item: ReviewSessionTreeItem) => deleteReviewSession(item, client, treeProvider, decorationManager),
    ),

    vscode.commands.registerCommand(
      'reviewflow.activateReviewSession',
      (item: ReviewSessionTreeItem) => activateReviewSession(item, client, treeProvider),
    ),

    vscode.commands.registerCommand(
      'reviewflow.publishDraftComment',
      (item: DraftCommentTreeItem) =>
        publishDraftComment(item, client, treeProvider, decorationManager, secretsService),
    ),

    vscode.commands.registerCommand(
      'reviewflow.publishReviewSession',
      (item: ReviewSessionTreeItem) =>
        publishReviewSession(item, client, treeProvider, decorationManager, secretsService),
    ),

    vscode.commands.registerCommand(
      'reviewflow.syncReviewSession',
      (item: ReviewSessionTreeItem) =>
        syncReviewSession(item, client, treeProvider, decorationManager, secretsService),
    ),

    vscode.commands.registerCommand(
      'reviewflow.suggestAiComments',
      (item: ReviewSessionTreeItem) =>
        suggestAiComments(item, client, treeProvider, decorationManager, secretsService),
    ),

    vscode.commands.registerCommand(
      'reviewflow.acceptAiSuggestion',
      (item: DraftCommentTreeItem) =>
        acceptAiSuggestion(item, client, treeProvider, decorationManager),
    ),

    vscode.commands.registerCommand(
      'reviewflow.dismissAiSuggestion',
      (item: DraftCommentTreeItem) =>
        dismissAiSuggestion(item, client, treeProvider, decorationManager),
    ),

    vscode.commands.registerCommand(
      'reviewflow.openDraftComment',
      async (item: DraftCommentTreeItem) => {
        const uri = vscode.Uri.file(path.join(item.repo.localPath, item.comment.filePath));
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        const line = item.comment.lineNumber - 1;
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      },
    ),
  );

  vscode.commands.executeCommand('setContext', 'reviewflow.hasInstances', false);
  vscode.commands.executeCommand('setContext', 'reviewflow.backendAvailable', false);

  manager
    .ensureRunning(context.extensionPath)
    .then(() => {
      treeProvider.setReady();
      treeProvider.refresh();
      decorationManager.refresh();
    })
    .catch((err: Error) => {
      treeProvider.setReady();
      vscode.commands.executeCommand('setContext', 'reviewflow.backendAvailable', false);
      vscode.window.showErrorMessage(
        `ReviewFlow: Failed to start backend — ${err.message}`,
      );
    });
}

export function deactivate(): void {}
