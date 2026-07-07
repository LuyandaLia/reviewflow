import * as vscode from 'vscode';
import type { GitLabInstance, Repository } from '../models/types';
import type { BackendClient } from '../api/backendClient';

export type RepositoryTreeItem = InstanceTreeItem | RepoTreeItem;

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
    super(repo.displayName, vscode.TreeItemCollapsibleState.None);
    this.description = repo.gitlabProjectPath;
    this.iconPath = new vscode.ThemeIcon('repo');
    this.tooltip = `${repo.displayName}\n${repo.localPath}\n${repo.gitlabProjectPath}`;
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

    if (!this._ready) return;

    await vscode.commands.executeCommand(
      'setContext',
      'reviewflow.backendAvailable',
      status === 'available',
    );

    if (status === 'unavailable' && previous !== 'unavailable') {
      this._onStatusChanged.fire('unavailable');
    } else if (status === 'available' && previous !== 'available') {
      this._onStatusChanged.fire('available');
    }
  }
}
