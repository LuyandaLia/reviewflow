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
    if (override) return override;

    const candidates = [
      path.join(extensionPath, 'backend'),
      path.resolve(extensionPath, '..', 'backend'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'app', 'main.py'))) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private _assertBackendPresent(backendPath: string): void {
    if (fs.existsSync(path.join(backendPath, 'app', 'main.py'))) {
      return;
    }

    throw new Error(
      `Backend not found at "${backendPath}". ` +
        'Set reviewflow._backendPath to your ReviewFlow backend directory, or reinstall the extension.',
    );
  }

  private _resolveSystemPython(): string {
    const override = vscode.workspace
      .getConfiguration('reviewflow')
      .get<string>('_pythonPath');
    if (override) return override;
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private _resolveVenvPython(backendPath: string): string | undefined {
    const isWin = process.platform === 'win32';
    const venvPython = isWin
      ? path.join(backendPath, '.venv', 'Scripts', 'python.exe')
      : path.join(backendPath, '.venv', 'bin', 'python3');
    return fs.existsSync(venvPython) ? venvPython : undefined;
  }

  private async _start(extensionPath: string): Promise<void> {
    const backendPath = this._resolveBackendPath(extensionPath);
    this._assertBackendPresent(backendPath);

    // Auto-provision venv if it doesn't exist yet
    if (!this._resolveVenvPython(backendPath)) {
      await this._provisionVenv(backendPath);
    }

    const python = this._resolveVenvPython(backendPath) ?? this._resolveSystemPython();
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

  private async _provisionVenv(backendPath: string): Promise<void> {
    const systemPython = this._resolveSystemPython();
    const requirementsPath = path.join(backendPath, 'requirements.txt');

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'ReviewFlow: Setting up Python environment…',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Creating virtual environment…' });
        await this._run(systemPython, ['-m', 'venv', '.venv'], backendPath);

        if (fs.existsSync(requirementsPath)) {
          progress.report({ message: 'Installing dependencies…' });
          const pip = process.platform === 'win32'
            ? path.join(backendPath, '.venv', 'Scripts', 'pip.exe')
            : path.join(backendPath, '.venv', 'bin', 'pip');
          await this._run(pip, ['install', '-r', 'requirements.txt'], backendPath);
        }
      },
    );

    this._channel.appendLine('Virtual environment ready.');
  }

  private _run(cmd: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._channel.appendLine(`> ${cmd} ${args.join(' ')}`);
      const proc = cp.spawn(cmd, args, { cwd });
      proc.stdout?.on('data', (d: Buffer) => this._channel.append(String(d)));
      proc.stderr?.on('data', (d: Buffer) => this._channel.append(String(d)));
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`"${cmd} ${args.join(' ')}" exited with code ${code}`));
        }
      });
    });
  }

  private async _waitForReady(timeoutMs = 30_000): Promise<void> {
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
