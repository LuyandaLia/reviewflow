export type Severity = 'info' | 'suggestion' | 'warning' | 'blocker';

export const SEVERITIES: readonly Severity[] = ['info', 'suggestion', 'warning', 'blocker'];

export function normalizeSeverity(raw: string): Severity {
  switch (raw.toLowerCase()) {
    case 'suggestion':
      return 'suggestion';
    case 'warning':
      return 'warning';
    case 'blocker':
    case 'error':
      return 'blocker';
    case 'info':
    default:
      return 'info';
  }
}

export function cycleSeverity(current: Severity): Severity {
  const index = SEVERITIES.indexOf(current);
  return SEVERITIES[(index + 1) % SEVERITIES.length];
}

/** Unicode glyphs for plain-text labels (thread titles, webviews). */
export function severityGlyph(severity: Severity): string {
  switch (severity) {
    case 'info':
      return 'ℹ️';
    case 'suggestion':
      return '💡';
    case 'warning':
      return '⚠️';
    case 'blocker':
      return '🚫';
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

/** Codicon references for native VS Code chrome (menus, tree items). */
export function severityIcon(severity: Severity): string {
  switch (severity) {
    case 'info':
      return '$(info)';
    case 'suggestion':
      return '$(light-bulb)';
    case 'warning':
      return '$(warning)';
    case 'blocker':
      return '$(error)';
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

export function severityLabel(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
