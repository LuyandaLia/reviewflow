import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class BackendManager implements vscode.Disposable {
  private static readonly DEFAULT_PORT = 51515;

  private _process: cp.ChildProcess | undefined;
  private readonly _channel: vscode.OutputChannel;

  constructor() {
    this._channel = vscode.window.createOutputChannel('ReviewFlow Backend');
  }

  get port(): number {
    return vscode.workspace
      .getConfiguration('reviewflow')
      .get<number>('_port', BackendManager.DEFAULT_PORT);
  }

  async ensureRunning(extensionPath: string): Promise<void> {
    if (await this._isHealthy()) {
      this._channel.appendLine('Backend already running.');
      return;
    }
    await this._start(extensionPath);
  }

  private async _isHealthy(): Promise<boolean> {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 2000),
      );
      const res = await Promise.race([
        fetch(`http://127.0.0.1:${this.port}/health`),
        timeout,
      ]);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  private _resolveBackendPath(extensionPath: string): string {
    const override = vscode.workspace
      .getConfiguration('reviewflow')
      .get<string>('_backendPath');
    return override ?? path.resolve(extensionPath, '..', 'backend');
  }

  private _resolvePython(backendPath: string): string {
    const override = vscode.workspace
      .getConfiguration('reviewflow')
      .get<string>('_pythonPath');
    if (override) return override;
    const venvPython = path.join(backendPath, '.venv', 'bin', 'python3');
    return fs.existsSync(venvPython) ? venvPython : 'python3';
  }

  private async _start(extensionPath: string): Promise<void> {
    const backendPath = this._resolveBackendPath(extensionPath);
    const python = this._resolvePython(backendPath);
    const port = this.port;

    this._channel.appendLine(`Starting backend — ${python} -m uvicorn app.main:app --port ${port}`);
    this._channel.appendLine(`Working directory: ${backendPath}`);

    this._process = cp.spawn(
      python,
      ['-m', 'uvicorn', 'app.main:app', '--port', String(port), '--host', '127.0.0.1'],
      { cwd: backendPath },
    );

    this._process.stdout?.on('data', (d: Buffer) => this._channel.append(String(d)));
    this._process.stderr?.on('data', (d: Buffer) => this._channel.append(String(d)));
    this._process.on('error', (err: Error) =>
      this._channel.appendLine(`Backend process error: ${err.message}`),
    );

    await this._waitForReady();
  }

  private async _waitForReady(timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this._isHealthy()) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(
      `Backend did not become ready within ${timeoutMs / 1000}s — check the "ReviewFlow Backend" output channel for details.`,
    );
  }

  dispose(): void {
    this._process?.kill();
    this._process = undefined;
    this._channel.dispose();
  }
}
