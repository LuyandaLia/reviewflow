import * as path from 'path';
import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DraftComment } from '../models/types';

export class DecorationManager implements vscode.Disposable {
  private readonly _draftDecoration: vscode.TextEditorDecorationType;
  private readonly _publishedDecoration: vscode.TextEditorDecorationType;
  private readonly _aiDecoration: vscode.TextEditorDecorationType;
  private _commentsByPath = new Map<string, DraftComment[]>();
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly client: BackendClient,
    extensionUri: vscode.Uri,
  ) {
    const draftIconPath = vscode.Uri.joinPath(extensionUri, 'resources', 'comment-gutter.svg');
    const publishedIconPath = vscode.Uri.joinPath(
      extensionUri,
      'resources',
      'comment-gutter-published.svg',
    );
    const aiIconPath = vscode.Uri.joinPath(extensionUri, 'resources', 'comment-gutter-ai.svg');

    this._draftDecoration = vscode.window.createTextEditorDecorationType({
      gutterIconPath: draftIconPath,
      gutterIconSize: 'contain',
    });

    this._publishedDecoration = vscode.window.createTextEditorDecorationType({
      gutterIconPath: publishedIconPath,
      gutterIconSize: 'contain',
    });

    this._aiDecoration = vscode.window.createTextEditorDecorationType({
      gutterIconPath: aiIconPath,
      gutterIconSize: 'contain',
    });

    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this._applyToEditor(editor);
      }),
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        for (const editor of editors) this._applyToEditor(editor);
      }),
    );
  }

  async refresh(): Promise<void> {
    let repos;
    try {
      repos = await this.client.listRepositories();
    } catch {
      return;
    }

    const newMap = new Map<string, DraftComment[]>();

    await Promise.all(
      repos.map(async (repo) => {
        try {
          const comments = await this.client.listDraftComments(repo.id);
          for (const comment of comments) {
            const absPath = path.join(repo.localPath, comment.filePath);
            const list = newMap.get(absPath) ?? [];
            list.push(comment);
            newMap.set(absPath, list);
          }
        } catch {
          // skip repo on error
        }
      }),
    );

    this._commentsByPath = newMap;

    for (const editor of vscode.window.visibleTextEditors) {
      this._applyToEditor(editor);
    }
  }

  private _applyToEditor(editor: vscode.TextEditor): void {
    if (editor.document.uri.scheme !== 'file') return;
    const comments = this._commentsByPath.get(editor.document.uri.fsPath) ?? [];

    const draft = comments.filter((c) => c.status !== 'published' && c.origin !== 'ai');
    const published = comments.filter((c) => c.status === 'published');
    const ai = comments.filter((c) => c.status !== 'published' && c.origin === 'ai');

    editor.setDecorations(this._draftDecoration, draft.map(_buildDecoration));
    editor.setDecorations(this._publishedDecoration, published.map(_buildDecoration));
    editor.setDecorations(this._aiDecoration, ai.map(_buildDecoration));
  }

  dispose(): void {
    this._draftDecoration.dispose();
    this._publishedDecoration.dispose();
    this._aiDecoration.dispose();
    for (const d of this._disposables) d.dispose();
  }
}

function _buildDecoration(comment: DraftComment): vscode.DecorationOptions {
  const line = comment.lineNumber - 1;
  const hover = new vscode.MarkdownString('', true);

  let badge: string;
  if (comment.status === 'published') {
    badge = `$(pass) **Published to GitLab**`;
  } else if (comment.status === 'failed') {
    badge = `$(warning) **Publish failed** — right-click to retry`;
  } else if (comment.origin === 'ai') {
    badge = `$(hubot) **AI Suggestion** — right-click to accept or dismiss`;
  } else {
    badge = `$(comment) **${_capitalize(comment.severity)}**`;
  }

  hover.appendMarkdown(`${badge}\n\n---\n\n`);
  hover.appendText(comment.commentText);
  hover.appendMarkdown(`\n\n---\n\n*${_formatDate(comment.createdAt)}*`);

  return {
    range: new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
    hoverMessage: hover,
  };
}

function _capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function _formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
