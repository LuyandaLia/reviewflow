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
