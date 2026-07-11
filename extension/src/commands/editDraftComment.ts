import * as vscode from 'vscode';
import type { InlineCommentComposer } from '../providers/inlineCommentComposer';
import type { DraftCommentTreeItem } from '../providers/repositoryTreeProvider';

export async function editDraftComment(
  item: DraftCommentTreeItem,
  composer: InlineCommentComposer,
): Promise<void> {
  if (item.comment.status === 'published') {
    vscode.window.showInformationMessage(
      'Published comments are read-only. Delete and recreate if changes are needed.',
    );
    return;
  }

  await composer.openExisting(item.comment, item.repo);
}
