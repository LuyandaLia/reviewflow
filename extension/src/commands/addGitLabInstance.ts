import * as vscode from 'vscode';
import { BackendError, type BackendClient } from '../api/backendClient';
import type { RepositoryTreeProvider } from '../providers/repositoryTreeProvider';

export async function addGitLabInstance(
  client: BackendClient,
  provider: RepositoryTreeProvider,
): Promise<void> {
  const displayName = await vscode.window.showInputBox({
    title: 'Add GitLab Instance (1/3)',
    prompt: 'Display name for this GitLab instance',
    placeHolder: 'Corporate GitLab',
    validateInput: (v) => (v.trim() ? undefined : 'Display name is required.'),
  });
  if (displayName === undefined) return;

  const baseUrl = await vscode.window.showInputBox({
    title: 'Add GitLab Instance (2/3)',
    prompt: 'Base URL of the GitLab instance',
    placeHolder: 'https://gitlab.example.com',
    validateInput: (v) => {
      if (!v.trim()) return 'Base URL is required.';
      try {
        new URL(v);
        return undefined;
      } catch {
        return 'Enter a valid URL (e.g. https://gitlab.example.com).';
      }
    },
  });
  if (baseUrl === undefined) return;

  const caBundlePath = await vscode.window.showInputBox({
    title: 'Add GitLab Instance (3/3)',
    prompt: 'Path to custom CA bundle (leave empty if not needed)',
    placeHolder: '/etc/ssl/certs/my-ca.pem',
  });
  if (caBundlePath === undefined) return;

  try {
    await client.createGitLabInstance({
      displayName: displayName.trim(),
      baseUrl: baseUrl.trim(),
      caBundlePath: caBundlePath.trim() || null,
    });
    provider.refresh();
  } catch (err) {
    if (err instanceof BackendError && err.code === 'DUPLICATE_INSTANCE_URL') {
      vscode.window.showErrorMessage(
        `A GitLab instance with URL "${baseUrl.trim()}" is already registered.`,
      );
    } else {
      vscode.window.showErrorMessage(
        `Failed to add GitLab instance: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
