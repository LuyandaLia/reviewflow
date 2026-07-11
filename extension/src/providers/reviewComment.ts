import * as vscode from 'vscode';
import type { Severity } from './severity';

export class ReviewComment implements vscode.Comment {
  public savedBody: string;

  constructor(
    public body: string,
    public mode: vscode.CommentMode,
    public author: vscode.CommentAuthorInformation,
    public readonly draftCommentId: string | null,
    public severity: Severity,
    public origin: string,
    public status: string,
    public parent?: vscode.CommentThread,
    public contextValue?: string,
    public label?: string,
    public timestamp?: Date,
  ) {
    this.savedBody = body;
  }
}
