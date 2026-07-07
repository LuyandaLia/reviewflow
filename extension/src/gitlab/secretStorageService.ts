import * as vscode from 'vscode';

export class SecretStorageService {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async getPat(instanceId: string): Promise<string | undefined> {
    return this.secrets.get(`reviewflow.pat.${instanceId}`);
  }

  async storePat(instanceId: string, pat: string): Promise<void> {
    await this.secrets.store(`reviewflow.pat.${instanceId}`, pat);
  }

  async deletePat(instanceId: string): Promise<void> {
    await this.secrets.delete(`reviewflow.pat.${instanceId}`);
  }

  async getAnthropicKey(): Promise<string | undefined> {
    return this.secrets.get('reviewflow.ai.anthropic');
  }

  async storeAnthropicKey(key: string): Promise<void> {
    await this.secrets.store('reviewflow.ai.anthropic', key);
  }

  async deleteAnthropicKey(): Promise<void> {
    await this.secrets.delete('reviewflow.ai.anthropic');
  }
}
