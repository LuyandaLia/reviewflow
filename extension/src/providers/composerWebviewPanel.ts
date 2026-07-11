import * as path from 'path';
import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DraftComment, Repository } from '../models/types';
import { publishCommentToGitLab } from '../gitlab/publishComment';
import type { SecretStorageService } from '../gitlab/secretStorageService';
import { selectionToAnchor } from './commentThreadView';
import { resolveEditorContext } from './editorContext';
import type { DraftCommentController } from './draftCommentController';
import type { RepositoryTreeProvider } from './repositoryTreeProvider';
import { ReviewComment } from './reviewComment';
import { cycleSeverity, severityGlyph, severityLabel, type Severity } from './severity';

interface ComposerNew {
  type: 'new';
  relativePath: string;
  fileName: string;
  lineNumber: number;
  endLineNumber: number | null;
  reviewSessionId: string;
  repositoryId: string;
  repoLocalPath: string;
  severity: Severity;
  initialText?: string;
}

interface ComposerEdit {
  type: 'edit';
  commentId: string;
  existingText: string;
  relativePath: string;
  fileName: string;
  lineNumber: number;
  endLineNumber: number | null;
  reviewSessionId: string;
  repositoryId: string;
  repoLocalPath: string;
  severity: Severity;
}

type ComposerContext = ComposerNew | ComposerEdit;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class ComposerWebviewPanel implements vscode.Disposable {
  private _panel: vscode.WebviewPanel | undefined;
  private _ctx: ComposerContext | undefined;
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _client: BackendClient,
    private readonly _secrets: SecretStorageService,
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _commentController: DraftCommentController,
    private readonly _treeProvider: RepositoryTreeProvider,
  ) {}

  async openForNew(editor: vscode.TextEditor): Promise<void> {
    await this._openForNewWithOptions(editor);
  }

  async openForNewWithText(
    editor: vscode.TextEditor,
    initialText: string,
    severity: Severity,
  ): Promise<void> {
    await this._openForNewWithOptions(editor, initialText, severity);
  }

  private async _openForNewWithOptions(
    editor: vscode.TextEditor,
    initialText?: string,
    severity?: Severity,
  ): Promise<void> {
    const editorCtx = await resolveEditorContext(editor, this._client);
    if (!editorCtx) return;

    const anchor = selectionToAnchor(editor.selection);
    const fileName = path.basename(editorCtx.relativePath);

    const ctx: ComposerNew = {
      type: 'new',
      relativePath: editorCtx.relativePath,
      fileName,
      lineNumber: anchor.lineNumber,
      endLineNumber: anchor.endLineNumber,
      reviewSessionId: editorCtx.activeSession.id,
      repositoryId: editorCtx.repo.id,
      repoLocalPath: editorCtx.repo.localPath,
      severity: severity ?? 'info',
      initialText,
    };

    this._openPanel(ctx);
  }

  async openForEdit(comment: DraftComment, repo: Repository): Promise<void> {
    const fileName = path.basename(comment.filePath);
    const ctx: ComposerEdit = {
      type: 'edit',
      commentId: comment.id,
      existingText: comment.commentText,
      relativePath: comment.filePath,
      fileName,
      lineNumber: comment.lineNumber,
      endLineNumber: comment.endLineNumber,
      reviewSessionId: comment.reviewSessionId,
      repositoryId: repo.id,
      repoLocalPath: repo.localPath,
      severity: comment.severity as Severity,
    };
    this._openPanel(ctx);
  }

  async openForEditInline(comment: ReviewComment): Promise<void> {
    if (!comment.parent || !comment.draftCommentId) return;
    const meta = this._commentController.getThreadMeta(comment.parent);
    if (!meta) return;
    const fileName = path.basename(meta.relativePath);
    const ctx: ComposerEdit = {
      type: 'edit',
      commentId: comment.draftCommentId,
      existingText: comment.savedBody,
      relativePath: meta.relativePath,
      fileName,
      lineNumber: meta.lineNumber,
      endLineNumber: meta.endLineNumber,
      reviewSessionId: meta.reviewSessionId,
      repositoryId: meta.repositoryId,
      repoLocalPath: meta.repoLocalPath,
      severity: comment.severity,
    };
    this._openPanel(ctx);
  }

  dispose(): void {
    this._panel?.dispose();
    for (const d of this._disposables) d.dispose();
  }

  private _lineLabel(ctx: ComposerContext): string {
    return ctx.endLineNumber && ctx.endLineNumber !== ctx.lineNumber
      ? String(ctx.lineNumber) + '–' + String(ctx.endLineNumber)
      : String(ctx.lineNumber);
  }

  private _severityLabel(severity: Severity): string {
    return severityGlyph(severity) + ' ' + severityLabel(severity);
  }

  private _openPanel(ctx: ComposerContext): void {
    this._ctx = ctx;
    const lineLabel = this._lineLabel(ctx);
    const title = '💬 ' + ctx.fileName + ':' + lineLabel;

    if (this._panel) {
      this._panel.title = title;
      this._panel.reveal(vscode.ViewColumn.Beside, true);
      this._panel.webview.postMessage({
        type: 'init',
        text: ctx.type === 'edit' ? ctx.existingText : (ctx.initialText ?? ''),
        severity: ctx.severity,
        severityLabel: this._severityLabel(ctx.severity),
        fileName: ctx.fileName,
        lineLabel,
        isEdit: ctx.type === 'edit',
      });
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'reviewflow.composer',
      title,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
        retainContextWhenHidden: true,
      },
    );

    this._panel.webview.html = this._buildHtml(ctx);

    this._panel.webview.onDidReceiveMessage(
      (msg) => void this._handleMessage(msg),
      undefined,
      this._disposables,
    );

    this._panel.onDidDispose(
      () => { this._panel = undefined; },
      undefined,
      this._disposables,
    );
  }

  private async _handleMessage(msg: unknown): Promise<void> {
    const message = msg as { type: string; text?: string };
    const ctx = this._ctx;
    if (!ctx) return;

    switch (message.type) {
      case 'ready':
        this._panel?.webview.postMessage({
          type: 'init',
          text: ctx.type === 'edit' ? ctx.existingText : (ctx.initialText ?? ''),
          severity: ctx.severity,
          severityLabel: this._severityLabel(ctx.severity),
          fileName: ctx.fileName,
          lineLabel: this._lineLabel(ctx),
          isEdit: ctx.type === 'edit',
        });
        break;

      case 'cycleSeverity': {
        ctx.severity = cycleSeverity(ctx.severity);
        this._panel?.webview.postMessage({
          type: 'severity',
          severity: ctx.severity,
          severityLabel: this._severityLabel(ctx.severity),
        });
        break;
      }

      case 'save': {
        const text = (message.text ?? '').trim();
        if (!text) return;
        await this._save(ctx, text);
        break;
      }

      case 'publish': {
        const text = (message.text ?? '').trim();
        if (!text) return;
        const draft = await this._save(ctx, text);
        if (draft) {
          await this._publish(draft, ctx);
        }
        break;
      }

      case 'cancel':
        this._panel?.dispose();
        break;
    }
  }

  private async _save(ctx: ComposerContext, text: string): Promise<DraftComment | undefined> {
    try {
      let draft: DraftComment;
      if (ctx.type === 'edit') {
        draft = await this._client.updateDraftComment(ctx.commentId, text, ctx.severity);
      } else {
        draft = await this._client.createDraftComment({
          reviewSessionId: ctx.reviewSessionId,
          filePath: ctx.relativePath,
          lineNumber: ctx.lineNumber,
          endLineNumber: ctx.endLineNumber,
          commentText: text,
          severity: ctx.severity,
          origin: 'manual',
        });
      }
      await this._commentController.refresh();
      this._treeProvider.refresh();
      this._panel?.dispose();
      return draft;
    } catch {
      vscode.window.showErrorMessage('ReviewFlow: Failed to save comment.');
      return undefined;
    }
  }

  private async _publish(draft: DraftComment, ctx: ComposerContext): Promise<void> {
    let repos: Repository[];
    try {
      repos = await this._client.listRepositories();
    } catch {
      return;
    }
    const repo = repos.find((r) => r.id === ctx.repositoryId);
    if (!repo) return;
    const success = await publishCommentToGitLab(draft, repo, this._client, this._secrets, this._extensionContext);
    if (success) {
      await this._commentController.refresh();
      this._treeProvider.refresh();
    }
  }

  private _buildHtml(ctx: ComposerContext): string {
    const webview = this._panel!.webview;
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'composer', 'composer.css'),
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'composer', 'composer.js'),
    );
    const csp = webview.cspSource;
    const lineLabel = this._lineLabel(ctx);
    const initialText =
      ctx.type === 'edit'
        ? escapeHtml(ctx.existingText)
        : escapeHtml(ctx.initialText ?? '');
    const initialSeverityLabel = this._severityLabel(ctx.severity);
    const actionLabel = ctx.type === 'edit' ? 'Edit comment' : 'New comment';
    const hasText =
      ctx.type === 'edit'
        ? ctx.existingText.trim().length > 0
        : (ctx.initialText ?? '').trim().length > 0;
    const disabledAttr = hasText ? '' : ' disabled';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp}; script-src ${csp};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${cssUri}">
  <title>ReviewFlow Comment</title>
</head>
<body>
  <div class="composer-card">
    <div class="composer-header">
      <span class="header-icon">💬</span>
      <span class="header-path">${escapeHtml(ctx.fileName)}</span>
      <span class="header-line">:${lineLabel}</span>
      <span class="header-action">${actionLabel}</span>
    </div>
    <div class="composer-body">
      <textarea
        id="composer-input"
        class="composer-input"
        placeholder="Leave a review comment…&#10;&#10;Markdown is supported."
        spellcheck="true"
      >${initialText}</textarea>
      <div class="markdown-hint">Markdown supported &middot; <kbd>&#8984;&#8629;</kbd> to save &middot; <kbd>&#9099;</kbd> to cancel</div>
    </div>
    <div class="composer-footer">
      <button id="severity-button" class="severity-badge" data-severity="${ctx.severity}" type="button">${initialSeverityLabel}</button>
      <div class="composer-actions">
        <button id="cancel-button" class="btn btn-ghost" type="button">Cancel</button>
        <button id="save-button" class="btn btn-secondary" type="button"${disabledAttr}>Save Draft</button>
        <button id="publish-button" class="btn btn-primary" type="button"${disabledAttr}>Publish</button>
      </div>
    </div>
  </div>
  <script src="${jsUri}"></script>
</body>
</html>`;
  }
}
