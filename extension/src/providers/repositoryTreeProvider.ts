import * as path from 'path';
import * as vscode from 'vscode';
import type { DraftComment, GitLabInstance, Repository, ReviewSession } from '../models/types';
import type { BackendClient } from '../api/backendClient';

export type RepositoryTreeItem =
  | InstanceTreeItem
  | RepoTreeItem
  | ReviewSessionTreeItem
  | EmptySessionsItem
  | DraftCommentTreeItem
  | EmptyDraftCommentsItem;

export class InstanceTreeItem extends vscode.TreeItem {
  readonly contextValue = 'gitlabInstance';

  constructor(readonly instance: GitLabInstance) {
    super(instance.displayName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = instance.baseUrl;
    this.iconPath = new vscode.ThemeIcon('server');
    this.tooltip = `${instance.displayName}\n${instance.baseUrl}${instance.apiPath}`;
  }
}

export class RepoTreeItem extends vscode.TreeItem {
  readonly contextValue = 'repository';

  constructor(readonly repo: Repository) {
    super(repo.displayName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = repo.gitlabProjectPath;
    this.iconPath = new vscode.ThemeIcon('repo');
    this.tooltip = `${repo.displayName}\n${repo.localPath}\n${repo.gitlabProjectPath}`;
  }
}

export class ReviewSessionTreeItem extends vscode.TreeItem {
  readonly contextValue: string;

  constructor(
    readonly session: ReviewSession,
    readonly repo: Repository,
  ) {
    super(session.name, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = session.isActive ? 'reviewSessionActive' : 'reviewSession';
    this.description = session.isActive ? '(active)' : undefined;
    this.iconPath = new vscode.ThemeIcon(session.isActive ? 'circle-filled' : 'circle-outline');
    this.tooltip = `${session.name}${session.isActive ? ' — active' : ''}`;
  }
}

export class EmptySessionsItem extends vscode.TreeItem {
  readonly contextValue = 'emptySessions';

  constructor() {
    super('No review sessions', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export class EmptyDraftCommentsItem extends vscode.TreeItem {
  readonly contextValue = 'emptyDraftComments';

  constructor() {
    super('No draft comments', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export class DraftCommentTreeItem extends vscode.TreeItem {
  readonly contextValue: string;

  constructor(
    readonly comment: DraftComment,
    readonly repo: Repository,
  ) {
    const basename = path.basename(comment.filePath);
    super(`${basename}:${comment.lineNumber}`, vscode.TreeItemCollapsibleState.None);
    this.description = comment.commentText.split('\n')[0];

    const statusLabel =
      comment.status === 'published'
        ? 'Published to GitLab'
        : comment.status === 'failed'
          ? 'Publish failed — right-click to retry'
          : comment.origin === 'ai'
            ? 'AI Suggestion'
            : 'Draft';
    this.tooltip = `[${statusLabel}] ${comment.filePath}:${comment.lineNumber}\n\n${comment.commentText}`;

    if (comment.status === 'published') {
      this.contextValue = 'draftCommentPublished';
      this.iconPath = new vscode.ThemeIcon('pass');
    } else if (comment.status === 'failed') {
      this.contextValue = 'draftCommentFailed';
      this.iconPath = new vscode.ThemeIcon('warning');
    } else if (comment.origin === 'ai') {
      this.contextValue = 'draftCommentAi';
      this.iconPath = new vscode.ThemeIcon('hubot');
    } else {
      this.contextValue = 'draftComment';
      this.iconPath = new vscode.ThemeIcon('comment');
    }

    this.command = {
      command: 'reviewflow.openDraftComment',
      title: 'Open Comment',
      arguments: [this],
    };
  }
}

export type BackendStatus = 'available' | 'unavailable';

export class RepositoryTreeProvider
  implements vscode.TreeDataProvider<RepositoryTreeItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<RepositoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly _onStatusChanged = new vscode.EventEmitter<BackendStatus>();
  readonly onStatusChanged: vscode.Event<BackendStatus> = this._onStatusChanged.event;

  private _reposByInstance = new Map<string, Repository[]>();
  private _backendStatus: BackendStatus | undefined;
  private _ready = false;

  constructor(private readonly client: BackendClient) {}

  setReady(): void {
    this._ready = true;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: RepositoryTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: RepositoryTreeItem): Promise<RepositoryTreeItem[]> {
    if (element instanceof InstanceTreeItem) {
      return (this._reposByInstance.get(element.instance.id) ?? []).map(
        (r) => new RepoTreeItem(r),
      );
    }

    if (element instanceof RepoTreeItem) {
      try {
        const sessions = await this.client.listReviewSessions(element.repo.id);
        if (sessions.length === 0) return [new EmptySessionsItem()];
        return sessions.map((s) => new ReviewSessionTreeItem(s, element.repo));
      } catch {
        return [new EmptySessionsItem()];
      }
    }

    if (element instanceof ReviewSessionTreeItem) {
      try {
        const comments = await this.client.listSessionComments(element.session.id);
        if (comments.length === 0) return [new EmptyDraftCommentsItem()];
        return comments.map((c) => new DraftCommentTreeItem(c, element.repo));
      } catch {
        return [new EmptyDraftCommentsItem()];
      }
    }

    // Root: fetch all instances and repos
    try {
      const [instances, repos] = await Promise.all([
        this.client.listGitLabInstances(),
        this.client.listRepositories(),
      ]);

      this._reposByInstance = new Map(instances.map((i) => [i.id, []]));
      for (const repo of repos) {
        this._reposByInstance.get(repo.gitlabInstanceId)?.push(repo);
      }

      await this._applyStatus('available');
      await vscode.commands.executeCommand(
        'setContext',
        'reviewflow.hasInstances',
        instances.length > 0,
      );

      return instances.map((i) => new InstanceTreeItem(i));
    } catch {
      await this._applyStatus('unavailable');
      return [];
    }
  }

  private async _applyStatus(status: BackendStatus): Promise<void> {
    const previous = this._backendStatus;
    this._backendStatus = status;

    await vscode.commands.executeCommand(
      'setContext',
      'reviewflow.backendAvailable',
      status === 'available',
    );

    if (!this._ready) return;

    if (status === 'unavailable' && previous !== 'unavailable') {
      this._onStatusChanged.fire('unavailable');
    } else if (status === 'available' && previous !== 'available') {
      this._onStatusChanged.fire('available');
    }
  }
}
