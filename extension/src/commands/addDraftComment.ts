import * as vscode from 'vscode';
import type { InlineCommentComposer } from '../providers/inlineCommentComposer';

export async function addDraftComment(composer: InlineCommentComposer): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('ReviewFlow: No active editor.');
    return;
  }

  await composer.openNew(editor);
}
