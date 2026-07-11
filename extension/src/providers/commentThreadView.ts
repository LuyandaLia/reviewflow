import * as vscode from 'vscode';
import type { DraftComment } from '../models/types';
import { ReviewComment } from './reviewComment';
import { normalizeSeverity, type Severity } from './severity';

export interface ThreadMeta {
  anchorKey: string;
  relativePath: string;
  lineNumber: number;
  endLineNumber: number | null;
  reviewSessionId: string;
  repositoryId: string;
  repoLocalPath: string;
  severity: Severity;
}

export type ThreadDisplayStatus = 'draft' | 'published' | 'failed' | 'ai' | 'pending' | 'resolved';

export function anchorKey(
  filePath: string,
  lineNumber: number,
  endLineNumber: number | null,
): string {
  return `${filePath}:${lineNumber}:${endLineNumber ?? ''}`;
}

export function rangeFromDraftComment(comment: DraftComment): vscode.Range {
  const startLine = comment.lineNumber - 1;
  const endLine = (comment.endLineNumber ?? comment.lineNumber) - 1;
  return new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
}

export function selectionToAnchor(
  selection: vscode.Selection,
): { range: vscode.Range; lineNumber: number; endLineNumber: number | null } {
  if (selection.isEmpty) {
    const line = selection.active.line;
    return {
      range: new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
      lineNumber: line + 1,
      endLineNumber: null,
    };
  }

  const startLine = selection.start.line;
  const endLine = selection.end.line;
  return {
    range: new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER),
    lineNumber: startLine + 1,
    endLineNumber: endLine + 1,
  };
}

export function groupCommentsByAnchor<T extends DraftComment>(
  comments: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const comment of comments) {
    const key = anchorKey(comment.filePath, comment.lineNumber, comment.endLineNumber);
    const list = groups.get(key) ?? [];
    list.push(comment);
    groups.set(key, list);
  }
  return groups;
}

export function aggregateThreadStatus(comments: DraftComment[]): ThreadDisplayStatus {
  if (comments.some((c) => c.status === 'failed')) {
    return 'failed';
  }
  if (comments.some((c) => c.origin === 'ai' && c.status !== 'published')) {
    return 'ai';
  }
  if (comments.some((c) => c.status === 'draft')) {
    return 'draft';
  }
  if (comments.every((c) => c.status === 'published')) {
    return 'published';
  }
  return 'draft';
}

export function toReviewComment(
  draft: DraftComment,
  thread: vscode.CommentThread,
): ReviewComment {
  const severity = normalizeSeverity(draft.severity);
  const isAi = draft.origin === 'ai' && draft.status !== 'published';
  const isPublished = draft.status === 'published';
  const isFailed = draft.status === 'failed';

  let authorName: string;
  if (isAi) {
    authorName = 'AI';
  } else if (isPublished && draft.publishedByUsername) {
    authorName = draft.publishedByUsername;
  } else {
    authorName = 'You';
  }

  let contextValue: string;
  if (isPublished) {
    contextValue = 'published';
  } else if (isFailed) {
    contextValue = 'failed';
  } else if (isAi) {
    contextValue = 'aiSuggestion';
  } else {
    contextValue = 'editable';
  }

  let label: string | undefined;
  if (isAi) {
    label = 'AI Suggestion';
  } else if (isFailed) {
    label = 'Publish failed';
  } else if (isPublished) {
    label = 'Published';
  } else {
    label = 'Draft';
  }

  return new ReviewComment(
    draft.commentText,
    vscode.CommentMode.Preview,
    { name: authorName },
    draft.id,
    severity,
    draft.origin,
    draft.status,
    thread,
    contextValue,
    label,
    new Date(draft.createdAt),
  );
}

export function threadMetaFromDraft(
  draft: DraftComment,
  repoLocalPath: string,
  severity: Severity,
): ThreadMeta {
  return {
    anchorKey: anchorKey(draft.filePath, draft.lineNumber, draft.endLineNumber),
    relativePath: draft.filePath,
    lineNumber: draft.lineNumber,
    endLineNumber: draft.endLineNumber,
    reviewSessionId: draft.reviewSessionId,
    repositoryId: draft.repositoryId,
    repoLocalPath,
    severity,
  };
}
