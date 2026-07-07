import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';

export interface GitLabProject {
  id: number;
  path_with_namespace: string;
}

export interface GitLabMR {
  id: number;
  iid: number;
  title: string;
  diff_refs: {
    base_sha: string;
    head_sha: string;
    start_sha: string;
  } | null;
}

export interface GitLabDiscussion {
  id: string;
  notes: Array<{ id: number }>;
}

export class GitLabApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly endpoint: string = '',
  ) {
    super(message);
    this.name = 'GitLabApiError';
  }
}

export class GitLabClient {
  private readonly apiBase: string;
  private readonly agent: https.Agent | undefined;

  constructor(
    baseUrl: string,
    apiPath: string,
    private readonly pat: string,
    caBundlePath: string | null,
  ) {
    // Use only the origin (scheme + host + port) so a stored group URL like
    // "https://gitlab.com/my-group" does not pollute the API path.
    const origin = new URL(baseUrl).origin;
    this.apiBase = `${origin}${apiPath}`;
    if (caBundlePath) {
      this.agent = new https.Agent({ ca: fs.readFileSync(caBundlePath) });
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = new URL(`${this.apiBase}${path}`);
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    const isHttps = url.protocol === 'https:';
    const endpoint = `${method} ${url.origin}${url.pathname}`;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port) : (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${this.pat}`,
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
        agent: isHttps ? this.agent : undefined,
      };

      const transport = isHttps ? https : (http as unknown as typeof https);
      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          const sc = res.statusCode ?? 0;
          if (sc >= 200 && sc < 300) {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              resolve(data as unknown as T);
            }
          } else {
            let errMsg = `HTTP ${sc}`;
            try {
              const errBody = JSON.parse(data) as { message?: string | string[]; error?: string };
              const raw = errBody.message ?? errBody.error;
              errMsg = Array.isArray(raw) ? raw.join('; ') : (raw ?? errMsg);
            } catch { /* ignore */ }
            console.error(`[ReviewFlow] GitLab API error — ${endpoint} → ${sc}`);
            reject(new GitLabApiError(sc, errMsg, endpoint));
          }
        });
      });

      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  async getProject(projectPath: string): Promise<GitLabProject> {
    const encoded = encodeURIComponent(projectPath);
    return this.request<GitLabProject>('GET', `/projects/${encoded}`);
  }

  async getMR(projectId: number, mrIid: number): Promise<GitLabMR> {
    return this.request<GitLabMR>('GET', `/projects/${projectId}/merge_requests/${mrIid}`);
  }

  async createDiscussion(
    projectId: number,
    mrIid: number,
    body: string,
    position: {
      baseSha: string;
      headSha: string;
      startSha: string;
      newPath: string;
      newLine: number;
    },
  ): Promise<GitLabDiscussion> {
    return this.request<GitLabDiscussion>(
      'POST',
      `/projects/${projectId}/merge_requests/${mrIid}/discussions`,
      {
        body,
        position: {
          position_type: 'text',
          base_sha: position.baseSha,
          head_sha: position.headSha,
          start_sha: position.startSha,
          new_path: position.newPath,
          new_line: position.newLine,
        },
      },
    );
  }

  async createNote(
    projectId: number,
    mrIid: number,
    body: string,
  ): Promise<{ id: number }> {
    return this.request<{ id: number }>(
      'POST',
      `/projects/${projectId}/merge_requests/${mrIid}/notes`,
      { body },
    );
  }

  async noteExists(projectId: number, mrIid: number, noteId: number): Promise<boolean> {
    try {
      await this.request('GET', `/projects/${projectId}/merge_requests/${mrIid}/notes/${noteId}`);
      return true;
    } catch (err) {
      if (err instanceof GitLabApiError && err.status === 404) return false;
      throw err;
    }
  }
}
