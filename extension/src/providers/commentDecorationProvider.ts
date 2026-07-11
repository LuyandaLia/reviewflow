import * as vscode from 'vscode';
import type { ThreadMeta } from './commentThreadView';
import { type ThreadDisplayStatus } from './commentThreadView';
import { severityGlyph, severityLabel, type Severity } from './severity';

export function buildThreadLabel(
  meta: ThreadMeta | undefined,
  commentCount: number,
  displayStatus: ThreadDisplayStatus,
): string {
  if (commentCount > 1) {
    return `💬 ${commentCount} comments`;
  }

  const severity = meta?.severity ?? 'info';
  const severityText = `${severityGlyph(severity)} ${severityLabel(severity)}`;

  if (displayStatus === 'ai') {
    return `🤖 AI · ${severityText}`;
  }
  if (displayStatus === 'published') {
    return `✅ Published · ${severityText}`;
  }
  if (displayStatus === 'failed') {
    return `❌ Failed · ${severityText}`;
  }
  if (displayStatus === 'resolved') {
    return `⭕ Resolved · ${severityText}`;
  }

  return `💬 ReviewFlow · ${severityText}`;
}

export function applyThreadDecoration(
  thread: vscode.CommentThread,
  displayStatus: ThreadDisplayStatus,
): void {
  switch (displayStatus) {
    case 'published':
      thread.contextValue = 'published';
      thread.state = vscode.CommentThreadState.Unresolved;
      break;
    case 'failed':
      thread.contextValue = 'failed';
      thread.state = vscode.CommentThreadState.Unresolved;
      break;
    case 'ai':
      thread.contextValue = 'aiSuggestion';
      thread.state = vscode.CommentThreadState.Unresolved;
      break;
    case 'resolved':
      thread.contextValue = 'resolved';
      thread.state = vscode.CommentThreadState.Resolved;
      break;
    case 'pending':
      thread.contextValue = 'pendingComposer';
      thread.state = vscode.CommentThreadState.Unresolved;
      break;
    case 'draft':
    default:
      thread.contextValue = 'draft';
      thread.state = vscode.CommentThreadState.Unresolved;
      break;
  }
}

export function buildPendingThreadLabel(severity: Severity): string {
  return `💬 ReviewFlow Draft · ${severityGlyph(severity)} ${severityLabel(severity)}`;
}
