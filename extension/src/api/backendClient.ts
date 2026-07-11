import type {
  CreateDraftCommentInput,
  CreateGitLabInstanceInput,
  CreateRepositoryInput,
  DraftComment,
  GitLabInstance,
  GitLabUser,
  Repository,
  ReviewSession,
  UpsertGitLabUserInput,
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

interface RawDraftComment {
  id: string;
  repository_id: string;
  review_session_id: string;
  file_path: string;
  line_number: number;
  end_line_number: number | null;
  comment_text: string;
  severity: string;
  status: string;
  origin: string;
  gitlab_note_id: string | null;
  gitlab_discussion_id: string | null;
  gitlab_mr_iid: number | null;
  published_by_user_id: number | null;
  published_by_username: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RawGitLabUser {
  gitlab_instance_id: string;
  gitlab_user_id: number;
  username: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  last_verified: string;
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

interface RawReviewSession {
  id: string;
  repository_id: string;
  name: string;
  is_active: boolean;
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

function toDraftComment(raw: RawDraftComment): DraftComment {
  return {
    id: raw.id,
    repositoryId: raw.repository_id,
    reviewSessionId: raw.review_session_id,
    filePath: raw.file_path,
    lineNumber: raw.line_number,
    endLineNumber: raw.end_line_number,
    commentText: raw.comment_text,
    severity: raw.severity,
    status: raw.status ?? 'draft',
    origin: raw.origin ?? 'manual',
    gitlabNoteId: raw.gitlab_note_id,
    gitlabDiscussionId: raw.gitlab_discussion_id,
    gitlabMrIid: raw.gitlab_mr_iid,
    publishedByUserId: raw.published_by_user_id,
    publishedByUsername: raw.published_by_username,
    publishedAt: raw.published_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function toGitLabUser(raw: RawGitLabUser): GitLabUser {
  return {
    gitlabInstanceId: raw.gitlab_instance_id,
    gitlabUserId: raw.gitlab_user_id,
    username: raw.username,
    displayName: raw.display_name,
    email: raw.email,
    avatarUrl: raw.avatar_url,
    lastVerified: raw.last_verified,
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

function toReviewSession(raw: RawReviewSession): ReviewSession {
  return {
    id: raw.id,
    repositoryId: raw.repository_id,
    name: raw.name,
    isActive: raw.is_active,
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

  async listReviewSessions(repositoryId: string): Promise<ReviewSession[]> {
    const raw = await this.request<RawReviewSession[]>(
      'GET',
      `/repositories/${repositoryId}/review-sessions`,
    );
    return raw.map(toReviewSession);
  }

  async createReviewSession(repositoryId: string, name: string): Promise<ReviewSession> {
    const raw = await this.request<RawReviewSession>(
      'POST',
      `/repositories/${repositoryId}/review-sessions`,
      { name },
    );
    return toReviewSession(raw);
  }

  async renameReviewSession(sessionId: string, name: string): Promise<ReviewSession> {
    const raw = await this.request<RawReviewSession>('PATCH', `/review-sessions/${sessionId}`, {
      name,
    });
    return toReviewSession(raw);
  }

  async activateReviewSession(sessionId: string): Promise<ReviewSession> {
    const raw = await this.request<RawReviewSession>(
      'POST',
      `/review-sessions/${sessionId}/activate`,
    );
    return toReviewSession(raw);
  }

  async deleteReviewSession(sessionId: string): Promise<void> {
    await this.request<void>('DELETE', `/review-sessions/${sessionId}`);
  }

  async listDraftComments(repositoryId: string): Promise<DraftComment[]> {
    const raw = await this.request<RawDraftComment[]>(
      'GET',
      `/repositories/${repositoryId}/draft-comments`,
    );
    return raw.map(toDraftComment);
  }

  async listSessionComments(sessionId: string): Promise<DraftComment[]> {
    const raw = await this.request<RawDraftComment[]>(
      'GET',
      `/review-sessions/${sessionId}/draft-comments`,
    );
    return raw.map(toDraftComment);
  }

  async createDraftComment(input: CreateDraftCommentInput): Promise<DraftComment> {
    const raw = await this.request<RawDraftComment>('POST', '/draft-comments', {
      review_session_id: input.reviewSessionId,
      file_path: input.filePath,
      line_number: input.lineNumber,
      end_line_number: input.endLineNumber ?? null,
      comment_text: input.commentText,
      severity: input.severity ?? 'info',
      origin: input.origin ?? 'manual',
    });
    return toDraftComment(raw);
  }

  async acceptAiSuggestion(id: string): Promise<DraftComment> {
    const raw = await this.request<RawDraftComment>('POST', `/draft-comments/${id}/accept`);
    return toDraftComment(raw);
  }

  async updateCommentPublishStatus(
    id: string,
    status: 'published' | 'failed' | 'draft',
    gitlabNoteId?: string,
    gitlabDiscussionId?: string,
    gitlabMrIid?: number,
    publishedByUserId?: number,
    publishedByUsername?: string,
    publishedAt?: string,
  ): Promise<DraftComment> {
    const raw = await this.request<RawDraftComment>('PATCH', `/draft-comments/${id}/publish-status`, {
      status,
      gitlab_note_id: gitlabNoteId ?? null,
      gitlab_discussion_id: gitlabDiscussionId ?? null,
      gitlab_mr_iid: gitlabMrIid ?? null,
      published_by_user_id: publishedByUserId ?? null,
      published_by_username: publishedByUsername ?? null,
      published_at: publishedAt ?? null,
    });
    return toDraftComment(raw);
  }

  async getInstanceUser(instanceId: string): Promise<GitLabUser | null> {
    try {
      const raw = await this.request<RawGitLabUser>('GET', `/gitlab-instances/${instanceId}/user`);
      return toGitLabUser(raw);
    } catch {
      return null;
    }
  }

  async upsertInstanceUser(instanceId: string, input: UpsertGitLabUserInput): Promise<GitLabUser> {
    const raw = await this.request<RawGitLabUser>('PUT', `/gitlab-instances/${instanceId}/user`, {
      gitlab_user_id: input.gitlabUserId,
      username: input.username,
      display_name: input.displayName,
      email: input.email ?? null,
      avatar_url: input.avatarUrl ?? null,
    });
    return toGitLabUser(raw);
  }

  async updateDraftComment(
    id: string,
    commentText: string,
    severity?: string,
  ): Promise<DraftComment> {
    const body: { comment_text: string; severity?: string } = {
      comment_text: commentText,
    };
    if (severity !== undefined) {
      body.severity = severity;
    }
    const raw = await this.request<RawDraftComment>('PATCH', `/draft-comments/${id}`, body);
    return toDraftComment(raw);
  }

  async deleteDraftComment(id: string): Promise<void> {
    await this.request<void>('DELETE', `/draft-comments/${id}`);
  }
}
