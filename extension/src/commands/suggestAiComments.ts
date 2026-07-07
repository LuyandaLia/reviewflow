import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import { AnthropicProvider } from '../ai/anthropicProvider';
import type { DecorationManager } from '../decorations/decorationManager';
import type { SecretStorageService } from '../gitlab/secretStorageService';
import type { RepositoryTreeProvider, ReviewSessionTreeItem } from '../providers/repositoryTreeProvider';

export async function suggestAiComments(
  item: ReviewSessionTreeItem,
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
  secrets: SecretStorageService,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    vscode.window.showErrorMessage(
      'ReviewFlow: Open a file in the editor before requesting AI suggestions.',
    );
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const repoPath = item.repo.localPath;

  if (!filePath.startsWith(repoPath)) {
    vscode.window.showErrorMessage(
      'ReviewFlow: The active file is not inside the selected repository.',
    );
    return;
  }

  const relPath = path.relative(repoPath, filePath);

  let apiKey = await secrets.getAnthropicKey();
  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Anthropic API key (stored securely in OS keychain)',
      password: true,
      placeHolder: 'sk-ant-...',
      ignoreFocusOut: true,
    });
    if (!apiKey) return;
    await secrets.storeAnthropicKey(apiKey);
  }

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot read the active file.');
    return;
  }

  const selection = editor.selection;
  const hasSelection = !selection.isEmpty;
  const startLine = hasSelection ? selection.start.line + 1 : undefined;
  const endLine = hasSelection ? selection.end.line + 1 : undefined;

  const provider = new AnthropicProvider(apiKey);

  let suggestions;
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ReviewFlow: Requesting AI review suggestions…',
        cancellable: false,
      },
      async () => {
        suggestions = await provider.suggestReview({
          filePath: relPath,
          fileContent,
          startLine,
          endLine,
        });
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('403')) {
      await secrets.deleteAnthropicKey();
      vscode.window.showErrorMessage(
        'ReviewFlow: Anthropic API key is invalid — it has been removed. Please try again.',
      );
    } else {
      vscode.window.showErrorMessage(`ReviewFlow: AI review failed — ${msg}`);
    }
    return;
  }

  if (!suggestions || (suggestions as unknown[]).length === 0) {
    vscode.window.showInformationMessage('ReviewFlow: AI found no suggestions for this file.');
    return;
  }

  let created = 0;
  for (const s of suggestions as Awaited<ReturnType<typeof provider.suggestReview>>) {
    try {
      await client.createDraftComment({
        reviewSessionId: item.session.id,
        filePath: s.filePath,
        lineNumber: s.lineNumber,
        endLineNumber: s.endLineNumber ?? null,
        commentText: s.commentText,
        severity: s.severity,
        origin: 'ai',
      });
      created++;
    } catch {
      // skip individual failures silently
    }
  }

  if (created === 0) {
    vscode.window.showWarningMessage('ReviewFlow: AI suggestions could not be saved.');
    return;
  }

  vscode.window.showInformationMessage(
    `ReviewFlow: ${created} AI suggestion(s) added to the session. Review and accept or dismiss each one.`,
  );

  treeProvider.refresh();
  decorationManager.refresh();
}
