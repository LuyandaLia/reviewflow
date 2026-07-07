import * as path from 'path';
import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DecorationManager } from '../decorations/decorationManager';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function addDraftComment(
  client: BackendClient,
  treeProvider: RepositoryTreeProvider,
  decorationManager: DecorationManager,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('ReviewFlow: No active editor.');
    return;
  }

  const fileUri = editor.document.uri;
  if (fileUri.scheme !== 'file') {
    vscode.window.showErrorMessage('ReviewFlow: Cannot comment on non-file documents.');
    return;
  }

  const lineNumber = editor.selection.active.line + 1;

  let repos;
  try {
    repos = await client.listRepositories();
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return;
  }

  const filePath = fileUri.fsPath;
  const repo = repos.find((r) => {
    const repoPath = r.localPath.endsWith(path.sep) ? r.localPath : r.localPath + path.sep;
    return filePath.startsWith(repoPath) || filePath === r.localPath;
  });

  if (!repo) {
    const msg =
      repos.length === 0
        ? 'ReviewFlow: No repositories registered. Add one via the ReviewFlow panel first.'
        : 'ReviewFlow: This file does not belong to any registered repository.';
    vscode.window.showErrorMessage(msg);
    return;
  }

  let sessions;
  try {
    sessions = await client.listReviewSessions(repo.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return;
  }

  if (sessions.length === 0) {
    vscode.window.showErrorMessage(
      'ReviewFlow: No review sessions. Create one in the ReviewFlow panel first.',
    );
    return;
  }

  const activeSession = sessions.find((s) => s.isActive);
  if (!activeSession) {
    vscode.window.showErrorMessage(
      'ReviewFlow: No active review session. Activate one in the ReviewFlow panel first.',
    );
    return;
  }

  const relativePath = path.relative(repo.localPath, filePath);

  const text = await vscode.window.showInputBox({
    prompt: `Add draft comment on ${path.basename(filePath)}:${lineNumber} (session: ${activeSession.name})`,
    placeHolder: 'Enter your comment…',
    validateInput: (v) => (v.trim() ? null : 'Comment cannot be empty'),
  });

  if (!text) return;

  try {
    await client.createDraftComment({
      reviewSessionId: activeSession.id,
      filePath: relativePath,
      lineNumber,
      commentText: text.trim(),
    });
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Failed to save comment.');
    return;
  }

  treeProvider.refresh();
  decorationManager.refresh();
}
