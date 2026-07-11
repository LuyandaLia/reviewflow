import * as vscode from 'vscode';
import type { InlineCommentComposer } from '../providers/inlineCommentComposer';
import { reviewWithCursorLm } from '../ai/cursorLmService';

const CONTEXT_LINES = 15;

export async function aiReviewSelectedCode(composer: InlineCommentComposer): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('ReviewFlow: No active editor.');
    return;
  }

  const { selection, document } = editor;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('ReviewFlow: Select the code you want to review first.');
    return;
  }

  const selectedCode = document.getText(selection);
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;
  const language = document.languageId;
  const fileName = document.fileName.split(/[/\\]/).pop() ?? document.fileName;
  const surroundingContext = _buildSurroundingContext(document, selection);

  const cts = new vscode.CancellationTokenSource();
  let review: Awaited<ReturnType<typeof reviewWithCursorLm>> | undefined;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ReviewFlow: Generating AI review…',
        cancellable: true,
      },
      async (_progress, progressToken) => {
        progressToken.onCancellationRequested(() => cts.cancel());
        review = await reviewWithCursorLm(
          { language, fileName, selectedCode, startLine, endLine, surroundingContext },
          cts.token,
        );
      },
    );
  } catch (err) {
    if (err instanceof vscode.CancellationError) return;
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`ReviewFlow: AI review failed — ${msg}`);
    return;
  } finally {
    cts.dispose();
  }

  if (!review) return;

  const initialText = `**${review.title}**\n\n${review.body}`;
  await composer.openNewWithText(editor, initialText, review.severity);
}

function _buildSurroundingContext(
  document: vscode.TextDocument,
  selection: vscode.Selection,
): string {
  const beforeStart = Math.max(0, selection.start.line - CONTEXT_LINES);
  const afterEnd = Math.min(document.lineCount - 1, selection.end.line + CONTEXT_LINES);

  const before: string[] = [];
  for (let i = beforeStart; i < selection.start.line; i++) {
    before.push(document.lineAt(i).text);
  }

  const after: string[] = [];
  for (let i = selection.end.line + 1; i <= afterEnd; i++) {
    after.push(document.lineAt(i).text);
  }

  return [...before, '// [selected code]', ...after].join('\n');
}
