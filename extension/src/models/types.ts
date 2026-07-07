export interface GitLabInstance {
  id: string;
  displayName: string;
  baseUrl: string;
  apiPath: string;
  caBundlePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Repository {
  id: string;
  localPath: string;
  gitlabInstanceId: string;
  gitlabProjectPath: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSession {
  id: string;
  repositoryId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGitLabInstanceInput {
  displayName: string;
  baseUrl: string;
  apiPath?: string;
  caBundlePath?: string | null;
}

export interface CreateRepositoryInput {
  localPath: string;
  gitlabInstanceId: string;
  gitlabProjectPath: string;
  displayName: string;
}

export interface DraftComment {
  id: string;
  repositoryId: string;
  reviewSessionId: string;
  filePath: string;
  lineNumber: number;
  endLineNumber: number | null;
  commentText: string;
  severity: string;
  status: string; // 'draft' | 'published' | 'failed'
  origin: string; // 'manual' | 'ai'
  gitlabNoteId: string | null;
  gitlabDiscussionId: string | null;
  gitlabMrIid: number | null;
  publishedByUserId: number | null;
  publishedByUsername: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftCommentInput {
  reviewSessionId: string;
  filePath: string;
  lineNumber: number;
  endLineNumber?: number | null;
  commentText: string;
  severity?: string;
  origin?: string;
}

export interface GitLabUser {
  gitlabInstanceId: string;
  gitlabUserId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastVerified: string;
}

export interface UpsertGitLabUserInput {
  gitlabUserId: number;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
