import type {
  CreateGitLabInstanceInput,
  CreateRepositoryInput,
  GitLabInstance,
  Repository,
} from '../models/types';
import type { BackendManager } from '../backend/backendManager';

export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

interface RawGitLabInstance {
  id: string;
  display_name: string;
  base_url: string;
  api_path: string;
  ca_bundle_path: string | null;
  created_at: string;
  updated_at: string;
}

interface RawRepository {
  id: string;
  local_path: string;
  gitlab_instance_id: string;
  gitlab_project_path: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

function toInstance(raw: RawGitLabInstance): GitLabInstance {
  return {
    id: raw.id,
    displayName: raw.display_name,
    baseUrl: raw.base_url,
    apiPath: raw.api_path,
    caBundlePath: raw.ca_bundle_path,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function toRepository(raw: RawRepository): Repository {
  return {
    id: raw.id,
    localPath: raw.local_path,
    gitlabInstanceId: raw.gitlab_instance_id,
    gitlabProjectPath: raw.gitlab_project_path,
    displayName: raw.display_name,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export class BackendClient {
  constructor(private readonly manager: BackendManager) {}

  private get baseUrl(): string {
    return `http://127.0.0.1:${this.manager.port}/api/v1`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const json = await response.json();

    if (!response.ok) {
      throw new BackendError(
        (json as { error?: string }).error ?? 'UNKNOWN',
        (json as { message?: string }).message ?? response.statusText,
        response.status,
      );
    }

    return json as T;
  }

  async listGitLabInstances(): Promise<GitLabInstance[]> {
    const raw = await this.request<RawGitLabInstance[]>('GET', '/gitlab-instances');
    return raw.map(toInstance);
  }

  async createGitLabInstance(input: CreateGitLabInstanceInput): Promise<GitLabInstance> {
    const raw = await this.request<RawGitLabInstance>('POST', '/gitlab-instances', {
      display_name: input.displayName,
      base_url: input.baseUrl,
      api_path: input.apiPath ?? '/api/v4',
      ca_bundle_path: input.caBundlePath ?? null,
    });
    return toInstance(raw);
  }

  async deleteGitLabInstance(id: string): Promise<void> {
    await this.request<void>('DELETE', `/gitlab-instances/${id}`);
  }

  async listRepositories(): Promise<Repository[]> {
    const raw = await this.request<RawRepository[]>('GET', '/repositories');
    return raw.map(toRepository);
  }

  async createRepository(input: CreateRepositoryInput): Promise<Repository> {
    const raw = await this.request<RawRepository>('POST', '/repositories', {
      local_path: input.localPath,
      gitlab_instance_id: input.gitlabInstanceId,
      gitlab_project_path: input.gitlabProjectPath,
      display_name: input.displayName,
    });
    return toRepository(raw);
  }

  async deleteRepository(id: string): Promise<void> {
    await this.request<void>('DELETE', `/repositories/${id}`);
  }
}
