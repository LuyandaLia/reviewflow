import * as vscode from 'vscode';

const HAS_SEEN_WELCOME_KEY = 'reviewflow.hasSeenWelcome';
const SETUP_PENDING_KEY = 'reviewflow.setupPending';

export function isFirstRun(context: vscode.ExtensionContext): boolean {
  return !context.globalState.get<boolean>(HAS_SEEN_WELCOME_KEY, false);
}

export function isSetupPending(context: vscode.ExtensionContext): boolean {
  return context.globalState.get<boolean>(SETUP_PENDING_KEY, false);
}

export async function markSetupComplete(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(SETUP_PENDING_KEY, false);
  void vscode.commands.executeCommand('setContext', 'reviewflow.setupPending', false);
}

export function restoreSetupPendingContext(context: vscode.ExtensionContext): void {
  void vscode.commands.executeCommand(
    'setContext',
    'reviewflow.setupPending',
    isSetupPending(context),
  );
}

export async function showWelcomeDialog(
  context: vscode.ExtensionContext,
  onGetStarted: () => Promise<boolean>,
): Promise<void> {
  // Mark seen immediately — prevents re-show if VS Code restarts mid-dialog
  await context.globalState.update(HAS_SEEN_WELCOME_KEY, true);

  const choice = await vscode.window.showInformationMessage(
    'Welcome to ReviewFlow! Connect to GitLab and start reviewing code without leaving the editor.',
    { modal: false },
    'Get Started',
    'Later',
  );

  if (choice === 'Get Started') {
    const succeeded = await onGetStarted();
    if (!succeeded) {
      // Wizard was cancelled or failed — keep pending so sidebar shows the button
      await context.globalState.update(SETUP_PENDING_KEY, true);
      void vscode.commands.executeCommand('setContext', 'reviewflow.setupPending', true);
    }
  } else {
    // "Later" or dismissed
    await context.globalState.update(SETUP_PENDING_KEY, true);
    void vscode.commands.executeCommand('setContext', 'reviewflow.setupPending', true);
  }
}
