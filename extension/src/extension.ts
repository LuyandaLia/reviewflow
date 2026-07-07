import * as vscode from 'vscode';
import { BackendManager } from './backend/backendManager';
import { BackendClient } from './api/backendClient';
import { RepositoryTreeProvider } from './providers/repositoryTreeProvider';
import type { InstanceTreeItem, RepoTreeItem } from './providers/repositoryTreeProvider';
import { addGitLabInstance } from './commands/addGitLabInstance';
import { removeGitLabInstance } from './commands/removeGitLabInstance';
import { addRepository } from './commands/addRepository';
import { removeRepository } from './commands/removeRepository';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new BackendManager();
  const client = new BackendClient(manager);
  const treeProvider = new RepositoryTreeProvider(client);

  let notificationActive = false;

  context.subscriptions.push(
    manager,

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

    vscode.window.registerTreeDataProvider('reviewflow.repositories', treeProvider),

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
  );

  vscode.commands.executeCommand('setContext', 'reviewflow.hasInstances', false);

  manager
    .ensureRunning(context.extensionPath)
    .then(() => {
      treeProvider.setReady();
      treeProvider.refresh();
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
