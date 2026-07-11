import * as path from 'path';
import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { Repository, ReviewSession } from '../models/types';

export interface EditorReviewContext {
  repo: Repository;
  activeSession: ReviewSession;
  relativePath: string;
}

export async function resolveEditorContext(
  editor: vscode.TextEditor,
  client: BackendClient,
): Promise<EditorReviewContext | undefined> {
  const fileUri = editor.document.uri;
  if (fileUri.scheme !== 'file') {
    vscode.window.showErrorMessage('ReviewFlow: Cannot comment on non-file documents.');
    return undefined;
  }

  let repos;
  try {
    repos = await client.listRepositories();
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return undefined;
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
    return undefined;
  }

  let sessions;
  try {
    sessions = await client.listReviewSessions(repo.id);
  } catch {
    vscode.window.showErrorMessage('ReviewFlow: Cannot reach backend.');
    return undefined;
  }

  if (sessions.length === 0) {
    vscode.window.showErrorMessage(
      'ReviewFlow: No review sessions. Create one in the ReviewFlow panel first.',
    );
    return undefined;
  }

  const activeSession = sessions.find((s) => s.isActive);
  if (!activeSession) {
    vscode.window.showErrorMessage(
      'ReviewFlow: No active review session. Activate one in the ReviewFlow panel first.',
    );
    return undefined;
  }

  return {
    repo,
    activeSession,
    relativePath: path.relative(repo.localPath, filePath),
  };
}
