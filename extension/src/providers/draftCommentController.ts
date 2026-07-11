import * as path from 'path';
import * as vscode from 'vscode';
import type { BackendClient } from '../api/backendClient';
import type { DraftComment, Repository } from '../models/types';
import { applyThreadDecoration, buildPendingThreadLabel, buildThreadLabel } from './commentDecorationProvider';
import {
  aggregateThreadStatus,
  anchorKey,
  groupCommentsByAnchor,
  rangeFromDraftComment,
  selectionToAnchor,
  type ThreadMeta,
  toReviewComment,
  threadMetaFromDraft,
} from './commentThreadView';
import { resolveEditorContext } from './editorContext';
import { ReviewComment } from './reviewComment';
import { cycleSeverity, normalizeSeverity, type Severity } from './severity';

export const REVIEWFLOW_CONTROLLER_ID = 'reviewflow';

interface LoadedComment extends DraftComment {
  repoLocalPath: string;
}

export interface DraftSaveInput {
  thread: vscode.CommentThread;
  text: string;
}

export class DraftCommentController implements vscode.Disposable {
  private readonly _controller: vscode.CommentController;
  private readonly _threadMeta = new WeakMap<vscode.CommentThread, ThreadMeta>();
  private readonly _threadsByAnchor = new Map<string, vscode.CommentThread>();
  private readonly _pendingAnchors = new Set<string>();
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(
    readonly client: BackendClient,
    private readonly _notifyRefresh: () => void,
  ) {
    this._controller = vscode.comments.createCommentController(
      REVIEWFLOW_CONTROLLER_ID,
      'ReviewFlow',
    );
    this._controller.options = {
      prompt: '💬 ReviewFlow Draft',
      placeHolder: 'Write your review comment…',
    };
    this._controller.commentingRangeProvider = {
      provideCommentingRanges: (document, _token) => {
        if (document.uri.scheme !== 'file') {
          return [];
        }
        const lineCount = document.lineCount;
        return [new vscode.Range(0, 0, lineCount - 1, 0)];
      },
    };
  }

  get controller(): vscode.CommentController {
    return this._controller;
  }

  async refresh(): Promise<void> {
    const pendingThreads = new Map<string, vscode.CommentThread>();
    for (const [key, thread] of this._threadsByAnchor) {
      if (this._pendingAnchors.has(key)) {
        pendingThreads.set(key, thread);
      } else {
        thread.dispose();
      }
    }

    this._threadsByAnchor.clear();
    for (const [key, thread] of pendingThreads) {
      this._threadsByAnchor.set(key, thread);
    }

    let repos;
    try {
      repos = await this.client.listRepositories();
    } catch {
      return;
    }

    const visibleComments: LoadedComment[] = [];

    await Promise.all(
      repos.map(async (repo) => {
        let sessions;
        try {
          sessions = await this.client.listReviewSessions(repo.id);
        } catch {
          return;
        }

        const activeSession = sessions.find((s) => s.isActive);
        if (!activeSession) {
          return;
        }

        let comments;
        try {
          comments = await this.client.listDraftComments(repo.id);
        } catch {
          return;
        }

        for (const comment of comments) {
          const isPublished = comment.status === 'published';
          const isActiveSession = comment.reviewSessionId === activeSession.id;
          if (isPublished || isActiveSession) {
            visibleComments.push({ ...comment, repoLocalPath: repo.localPath });
          }
        }
      }),
    );

    const grouped = groupCommentsByAnchor(visibleComments);

    for (const [key, comments] of grouped) {
      if (this._pendingAnchors.has(key)) {
        continue;
      }
      const first = comments[0];
      const uri = vscode.Uri.file(path.join(first.repoLocalPath, first.filePath));
      this._createOrUpdateThread(uri, key, comments, first.repoLocalPath);
    }
  }

  async openPendingComposer(
    uri: vscode.Uri,
    range: vscode.Range,
    ctx: {
      repo: Repository;
      activeSession: { id: string };
      relativePath: string;
      lineNumber: number;
      endLineNumber: number | null;
    },
  ): Promise<void> {
    const key = anchorKey(ctx.relativePath, ctx.lineNumber, ctx.endLineNumber);
    const existing = this._threadsByAnchor.get(key);

    if (existing) {
      this._pendingAnchors.add(key);
      const meta = this._threadMeta.get(existing);
      if (meta) {
        const alreadyEditing = existing.comments.find(
          (c) => c.mode === vscode.CommentMode.Editing,
        ) as ReviewComment | undefined;
        if (alreadyEditing) {
          this._openInlineComposer(existing, meta);
        } else {
          const editable = [...existing.comments]
            .reverse()
            .find((c) => {
              const rc = c as ReviewComment;
              return rc.status !== 'published' && rc.contextValue === 'editable';
            }) as ReviewComment | undefined;
          this._openInlineComposer(existing, meta, editable);
        }
      }
      return;
    }

    const severity: Severity = 'info';
    const meta: ThreadMeta = {
      anchorKey: key,
      relativePath: ctx.relativePath,
      lineNumber: ctx.lineNumber,
      endLineNumber: ctx.endLineNumber,
      reviewSessionId: ctx.activeSession.id,
      repositoryId: ctx.repo.id,
      repoLocalPath: ctx.repo.localPath,
      severity,
    };

    const placeholder = this._createEditingPlaceholder(meta.severity);
    const thread = this._controller.createCommentThread(uri, range, [placeholder]);
    placeholder.parent = thread;

    this._threadMeta.set(thread, meta);
    this._threadsByAnchor.set(key, thread);
    this._pendingAnchors.add(key);
    this._openInlineComposer(thread, meta);
  }

  async openComposerAtSelection(editor: vscode.TextEditor): Promise<void> {
    const ctx = await resolveEditorContext(editor, this.client);
    if (!ctx) {
      return;
    }

    const anchor = selectionToAnchor(editor.selection);
    await this.openPendingComposer(editor.document.uri, anchor.range, {
      repo: ctx.repo,
      activeSession: ctx.activeSession,
      relativePath: ctx.relativePath,
      lineNumber: anchor.lineNumber,
      endLineNumber: anchor.endLineNumber,
    });
  }

  async focusComment(comment: DraftComment, repo: Repository): Promise<void> {
    const uri = vscode.Uri.file(path.join(repo.localPath, comment.filePath));
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    const range = rangeFromDraftComment(comment);
    editor.selection = new vscode.Selection(range.start, range.start);
    editor.revealRange(range, vscode.TextEditorRevealType.Default);

    await this.refresh();

    const key = anchorKey(comment.filePath, comment.lineNumber, comment.endLineNumber);
    const thread = this._threadsByAnchor.get(key);
    if (thread) {
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    }
  }

  async startEdit(comment: ReviewComment): Promise<void> {
    if (!comment.parent || comment.status === 'published') {
      return;
    }

    const thread = comment.parent;
    const meta = this._threadMeta.get(thread);
    if (!meta) {
      return;
    }

    meta.severity = comment.severity;
    this._pendingAnchors.add(meta.anchorKey);
    this._openInlineComposer(thread, meta, comment);
  }

  cycleSeverity(thread: vscode.CommentThread): void {
    const meta = this._threadMeta.get(thread);
    if (!meta) {
      return;
    }
    meta.severity = cycleSeverity(meta.severity);
    const displayStatus = this._pendingAnchors.has(meta.anchorKey)
      ? 'pending'
      : aggregateThreadStatus(
          (thread.comments as ReviewComment[]).map((c) => ({
            status: c.status,
            origin: c.origin,
          })) as DraftComment[],
        );
    thread.label =
      displayStatus === 'pending'
        ? buildPendingThreadLabel(meta.severity)
        : buildThreadLabel(meta, thread.comments.length, displayStatus);
  }

  async saveDraft(input: DraftSaveInput | vscode.CommentReply): Promise<DraftComment | undefined> {
    const thread = input.thread;
    const meta = this._threadMeta.get(thread);
    if (!meta) {
      return undefined;
    }

    const text = input.text.trim();
    if (!text) {
      vscode.window.showWarningMessage('ReviewFlow: Comment cannot be empty.');
      return undefined;
    }

    const editing = thread.comments.find(
      (c) => c.mode === vscode.CommentMode.Editing,
    ) as ReviewComment | undefined;

    try {
      if (editing?.draftCommentId) {
        const updated = await this.client.updateDraftComment(
          editing.draftCommentId,
          text,
          meta.severity,
        );
        editing.body = updated.commentText;
        editing.savedBody = updated.commentText;
        editing.severity = normalizeSeverity(updated.severity);
        editing.mode = vscode.CommentMode.Preview;
        this._pendingAnchors.delete(meta.anchorKey);
        this._applyThreadStyle(thread);
        this._notifyRefresh();
        return updated;
      }

      const created = await this.client.createDraftComment({
        reviewSessionId: meta.reviewSessionId,
        filePath: meta.relativePath,
        lineNumber: meta.lineNumber,
        endLineNumber: meta.endLineNumber,
        commentText: text,
        severity: meta.severity,
        origin: 'manual',
      });

      const reviewComment = toReviewComment(created, thread);
      reviewComment.parent = thread;
      const withoutEditing = thread.comments.filter(
        (c) => c.mode !== vscode.CommentMode.Editing,
      );
      thread.comments = [...withoutEditing, reviewComment];
      thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
      this._pendingAnchors.delete(meta.anchorKey);
      this._applyThreadStyle(thread);
      this._notifyRefresh();
      await this.refresh();
      return created;
    } catch {
      vscode.window.showErrorMessage('ReviewFlow: Failed to save comment.');
      return undefined;
    }
  }

  cancel(thread: vscode.CommentThread): void {
    const meta = this._threadMeta.get(thread);
    if (!meta) {
      thread.dispose();
      return;
    }

    const editing = thread.comments.filter(
      (c) => c.mode === vscode.CommentMode.Editing,
    ) as ReviewComment[];

    for (const rc of editing) {
      if (rc.draftCommentId) {
        rc.body = rc.savedBody;
        rc.mode = vscode.CommentMode.Preview;
      }
    }

    thread.comments = thread.comments.filter((c) => {
      const rc = c as ReviewComment;
      return !(rc.mode === vscode.CommentMode.Editing && !rc.draftCommentId);
    });

    if (thread.comments.length === 0) {
      this._disposeThread(thread, meta.anchorKey);
      return;
    }

    this._pendingAnchors.delete(meta.anchorKey);
    this._applyThreadStyle(thread);
  }

  async deleteComment(comment: ReviewComment): Promise<void> {
    if (!comment.parent || !comment.draftCommentId) {
      return;
    }

    const thread = comment.parent;
    const meta = this._threadMeta.get(thread);

    try {
      await this.client.deleteDraftComment(comment.draftCommentId);
    } catch {
      vscode.window.showErrorMessage('ReviewFlow: Failed to delete comment.');
      return;
    }

    thread.comments = thread.comments.filter(
      (c) => (c as ReviewComment).draftCommentId !== comment.draftCommentId,
    );

    if (thread.comments.length === 0 && meta) {
      this._disposeThread(thread, meta.anchorKey);
    } else {
      this._applyThreadStyle(thread);
    }

    this._notifyRefresh();
    await this.refresh();
  }

  async acceptAiComment(comment: ReviewComment): Promise<void> {
    if (!comment.draftCommentId || !comment.parent) {
      return;
    }

    try {
      const updated = await this.client.acceptAiSuggestion(comment.draftCommentId);
      const refreshed = toReviewComment(updated, comment.parent);
      comment.parent.comments = comment.parent.comments.map((c) =>
        (c as ReviewComment).draftCommentId === comment.draftCommentId ? refreshed : c,
      );
      this._applyThreadStyle(comment.parent);
      this._notifyRefresh();
      await this.refresh();
    } catch {
      vscode.window.showErrorMessage('ReviewFlow: Failed to accept AI suggestion.');
    }
  }

  async dismissAiComment(comment: ReviewComment): Promise<void> {
    await this.deleteComment(comment);
  }

  copyComment(comment: ReviewComment): void {
    const body =
      typeof comment.body === 'string'
        ? comment.body
        : (comment.body as vscode.MarkdownString).value;
    void vscode.env.clipboard.writeText(body);
    vscode.window.showInformationMessage('ReviewFlow: Comment copied to clipboard.');
  }

  findCommentById(draftCommentId: string): ReviewComment | undefined {
    for (const thread of this._threadsByAnchor.values()) {
      for (const c of thread.comments) {
        const rc = c as ReviewComment;
        if (rc.draftCommentId === draftCommentId) {
          return rc;
        }
      }
    }
    return undefined;
  }

  getThreadMeta(thread: vscode.CommentThread): ThreadMeta | undefined {
    return this._threadMeta.get(thread);
  }

  findActivePendingThread(): vscode.CommentThread | undefined {
    for (const key of this._pendingAnchors) {
      const thread = this._threadsByAnchor.get(key);
      if (thread) {
        return thread;
      }
    }
    return undefined;
  }

  dispose(): void {
    this._controller.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
  }

  private _createEditingPlaceholder(severity: Severity, initialText = ''): ReviewComment {
    return new ReviewComment(
      initialText,
      vscode.CommentMode.Editing,
      { name: 'You' },
      null,
      severity,
      'manual',
      'pending',
      undefined,
      'editable',
      'Draft',
    );
  }

  private _openInlineComposer(
    thread: vscode.CommentThread,
    meta: ThreadMeta,
    editingComment?: ReviewComment,
  ): void {
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.canReply = false;
    applyThreadDecoration(thread, 'pending');
    thread.label = buildPendingThreadLabel(meta.severity);

    if (editingComment) {
      editingComment.body = editingComment.savedBody;
      editingComment.mode = vscode.CommentMode.Editing;
      return;
    }

    const existingEditing = thread.comments.find(
      (c) => c.mode === vscode.CommentMode.Editing,
    ) as ReviewComment | undefined;
    if (existingEditing) {
      return;
    }

    const placeholder = this._createEditingPlaceholder(meta.severity);
    placeholder.parent = thread;
    thread.comments = [
      ...thread.comments.filter((c) => c.mode !== vscode.CommentMode.Editing),
      placeholder,
    ];
  }

  private _createOrUpdateThread(
    uri: vscode.Uri,
    key: string,
    comments: LoadedComment[],
    repoLocalPath: string,
  ): void {
    const range = rangeFromDraftComment(comments[0]);

    let thread = this._threadsByAnchor.get(key);
    if (!thread) {
      thread = this._controller.createCommentThread(uri, range, []);
      this._threadsByAnchor.set(key, thread);
    }

    thread.range = range;
    const reviewComments = comments.map((c) => toReviewComment(c, thread!));
    thread.comments = reviewComments;
    for (const rc of reviewComments) {
      rc.parent = thread;
    }

    const primarySeverity = normalizeSeverity(comments[comments.length - 1].severity);
    const meta = threadMetaFromDraft(comments[0], repoLocalPath, primarySeverity);
    this._threadMeta.set(thread, meta);

    thread.canReply = comments.some((c) => c.status !== 'published');
    thread.collapsibleState =
      comments.length === 1
        ? vscode.CommentThreadCollapsibleState.Expanded
        : vscode.CommentThreadCollapsibleState.Collapsed;

    this._applyThreadStyle(thread);
  }

  private _applyThreadStyle(thread: vscode.CommentThread): void {
    const meta = this._threadMeta.get(thread);
    const reviewComments = thread.comments as ReviewComment[];

    const displayStatus = this._pendingAnchors.has(meta?.anchorKey ?? '')
      ? 'pending'
      : aggregateThreadStatus(
          reviewComments.map(
            (c) =>
              ({
                status: c.status,
                origin: c.origin,
              }) as DraftComment,
          ),
        );

    applyThreadDecoration(thread, displayStatus);
    thread.label = buildThreadLabel(meta, thread.comments.length, displayStatus);
  }

  private _disposeThread(thread: vscode.CommentThread, anchorKeyValue: string): void {
    this._pendingAnchors.delete(anchorKeyValue);
    this._threadsByAnchor.delete(anchorKeyValue);
    this._threadMeta.delete(thread);
    thread.dispose();
  }
}
