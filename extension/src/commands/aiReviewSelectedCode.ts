import * as vscode from 'vscode';
import type { InlineCommentComposer } from '../providers/inlineCommentComposer';
import type { SecretStorageService } from '../gitlab/secretStorageService';
import { pickModel, reviewWithSelectedModel } from '../ai/cursorLmService';

const CONTEXT_LINES = 15;

export async function aiReviewSelectedCode(
  composer: InlineCommentComposer,
  secrets: SecretStorageService,
): Promise<void> {
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

  // 1. Pick model (QuickPick on first use, cached thereafter)
  const modelId = await pickModel();
  if (!modelId) return;

  // 2. Get or prompt for Anthropic API key (stored in OS keychain)
  let apiKey = await secrets.getAnthropicKey();
  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      title: 'ReviewFlow: Anthropic API key',
      prompt:
        "Cursor's built-in AI is not accessible to extensions. Enter your Anthropic API key -- it will be stored securely in the OS keychain and used for all AI reviews.",
      password: true,
      placeHolder: 'sk-ant-...',
      ignoreFocusOut: true,
    });
    if (!apiKey) return;
    await secrets.storeAnthropicKey(apiKey);
  }

  // 3. Collect context
  const selectedCode = document.getText(selection);
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;
  const language = document.languageId;
  const fileName = document.fileName.split(/[/\\]/).pop() ?? document.fileName;
  const surroundingContext = _buildSurroundingContext(document, selection);

  // 4. Call the AI
  const cts = new vscode.CancellationTokenSource();
  let review: Awaited<ReturnType<typeof reviewWithSelectedModel>> | undefined;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ReviewFlow: Reviewing with ${modelId}…`,
        cancellable: true,
      },
      async (_progress, progressToken) => {
        progressToken.onCancellationRequested(() => cts.cancel());
        review = await reviewWithSelectedModel(
          { language, fileName, selectedCode, startLine, endLine, surroundingContext },
          apiKey!,
          modelId,
          cts.token,
        );
      },
    );
  } catch (err) {
    if (err instanceof vscode.CancellationError) return;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('403')) {
      await secrets.deleteAnthropicKey();
      vscode.window.showErrorMessage(
        'ReviewFlow: Anthropic API key is invalid — it has been removed. Please run the command again.',
      );
    } else {
      vscode.window.showErrorMessage(`ReviewFlow: AI review failed — ${msg}`);
    }
    return;
  } finally {
    cts.dispose();
  }

  if (!review) return;

  // 5. Pre-populate the draft comment composer
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
