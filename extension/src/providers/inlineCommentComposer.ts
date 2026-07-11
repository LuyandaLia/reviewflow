import * as vscode from 'vscode';
import type { DraftComment, Repository } from '../models/types';
import type { DraftCommentController } from './draftCommentController';
import type { ComposerWebviewPanel } from './composerWebviewPanel';

export class InlineCommentComposer {
  constructor(
    private readonly _controller: DraftCommentController,
    private readonly _composerPanel: ComposerWebviewPanel,
  ) {}

  async openNew(editor: vscode.TextEditor): Promise<void> {
    await this._composerPanel.openForNew(editor);
  }

  async openExisting(comment: DraftComment, repo: Repository): Promise<void> {
    await this._controller.focusComment(comment, repo);
    if (comment.status !== 'published') {
      await this._composerPanel.openForEdit(comment, repo);
    }
  }
}
