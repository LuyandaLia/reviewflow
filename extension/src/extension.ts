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
import {
  cancelInlineComposer,
  changeCachedMrIid,
  publishInlineComment,
  publishReviewComment,
  saveInlineDraft,
} from './commands/inlineCommentActions';
import { DraftCommentController } from './providers/draftCommentController';
import { InlineCommentComposer } from './providers/inlineCommentComposer';
import { ComposerWebviewPanel } from './providers/composerWebviewPanel';
import { ReviewComment } from './providers/reviewComment';
import { SecretStorageService } from './gitlab/secretStorageService';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new BackendManager();
  const client = new BackendClient(manager);
  const treeProvider = new RepositoryTreeProvider(client);
  const secretsService = new SecretStorageService(context.secrets);

  const refreshCommentUi = async (): Promise<void> => {
    await commentController.refresh();
  };

  const commentController = new DraftCommentController(client, () => {
    treeProvider.refresh();
  });
  const composerPanel = new ComposerWebviewPanel(
    context.extensionUri,
    client,
    secretsService,
    context,
    commentController,
    treeProvider,
  );
  const composer = new InlineCommentComposer(commentController, composerPanel);

  let notificationActive = false;

  context.subscriptions.push(
    manager,
    commentController,
    composerPanel,

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
      void refreshCommentUi();
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
      addDraftComment(composer),
    ),

    vscode.commands.registerCommand(
      'reviewflow.editDraftComment',
      (item: DraftCommentTreeItem) => editDraftComment(item, composer),
    ),

    vscode.commands.registerCommand(
      'reviewflow.removeDraftComment',
      (item: DraftCommentTreeItem) =>
        removeDraftComment(item, client, treeProvider, commentController),
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
      (item: ReviewSessionTreeItem) =>
        deleteReviewSession(item, client, treeProvider, commentController),
    ),

    vscode.commands.registerCommand(
      'reviewflow.activateReviewSession',
      (item: ReviewSessionTreeItem) =>
        activateReviewSession(item, client, treeProvider, commentController),
    ),

    vscode.commands.registerCommand(
      'reviewflow.publishDraftComment',
      (item: DraftCommentTreeItem) =>
        publishDraftComment(
          item,
          client,
          treeProvider,
          commentController,
          secretsService,
          context,
        ),
    ),

    vscode.commands.registerCommand(
      'reviewflow.publishReviewSession',
      (item: ReviewSessionTreeItem) =>
        publishReviewSession(
          item,
          client,
          treeProvider,
          commentController,
          secretsService,
          context,
        ),
    ),

    vscode.commands.registerCommand(
      'reviewflow.syncReviewSession',
      (item: ReviewSessionTreeItem) =>
        syncReviewSession(item, client, treeProvider, commentController, secretsService),
    ),

    vscode.commands.registerCommand(
      'reviewflow.suggestAiComments',
      (item: ReviewSessionTreeItem) =>
        suggestAiComments(item, client, treeProvider, commentController, secretsService),
    ),

    vscode.commands.registerCommand(
      'reviewflow.acceptAiSuggestion',
      (item: DraftCommentTreeItem) =>
        acceptAiSuggestion(item, client, treeProvider, commentController),
    ),

    vscode.commands.registerCommand(
      'reviewflow.dismissAiSuggestion',
      (item: DraftCommentTreeItem) =>
        dismissAiSuggestion(item, client, treeProvider, commentController),
    ),

    vscode.commands.registerCommand(
      'reviewflow.openDraftComment',
      async (item: DraftCommentTreeItem) => {
        await composer.openExisting(item.comment, item.repo);
      },
    ),

    vscode.commands.registerCommand('reviewflow.saveInlineDraft', (reply: vscode.CommentReply) =>
      saveInlineDraft(reply, commentController, treeProvider, commentController),
    ),

    vscode.commands.registerCommand('reviewflow.publishInlineComment', (reply: vscode.CommentReply) =>
      publishInlineComment(
        reply,
        commentController,
        client,
        secretsService,
        context,
        treeProvider,
        commentController,
      ),
    ),

    vscode.commands.registerCommand(
      'reviewflow.cancelInlineComposer',
      (arg?: vscode.CommentThread | vscode.CommentReply) =>
        cancelInlineComposer(arg, commentController),
    ),

    vscode.commands.registerCommand('reviewflow.cycleSeverity', (thread: vscode.CommentThread) =>
      commentController.cycleSeverity(thread),
    ),

    vscode.commands.registerCommand('reviewflow.editInlineComment', async (comment: ReviewComment) =>
      composerPanel.openForEditInline(comment),
    ),

    vscode.commands.registerCommand('reviewflow.deleteInlineComment', async (comment: ReviewComment) => {
      await commentController.deleteComment(comment);
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('reviewflow.publishReviewComment', (comment: ReviewComment) =>
      publishReviewComment(
        comment,
        commentController,
        client,
        secretsService,
        context,
        treeProvider,
        commentController,
      ),
    ),

    vscode.commands.registerCommand('reviewflow.copyInlineComment', (comment: ReviewComment) =>
      commentController.copyComment(comment),
    ),

    vscode.commands.registerCommand('reviewflow.acceptInlineAiSuggestion', async (comment: ReviewComment) => {
      await commentController.acceptAiComment(comment);
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('reviewflow.dismissInlineAiSuggestion', async (comment: ReviewComment) => {
      await commentController.dismissAiComment(comment);
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('reviewflow.changeMrIid', () =>
      changeCachedMrIid(client, context),
    ),
  );

  vscode.commands.executeCommand('setContext', 'reviewflow.hasInstances', false);
  vscode.commands.executeCommand('setContext', 'reviewflow.backendAvailable', false);

  manager
    .ensureRunning(context.extensionPath)
    .then(() => {
      treeProvider.setReady();
      treeProvider.refresh();
      void refreshCommentUi();
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
