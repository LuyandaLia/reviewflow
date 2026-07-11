import * as https from 'https';
import * as vscode from 'vscode';
import type { Severity } from '../providers/severity';

// Models mirroring Cursor's agent model selector.
// Extend this list as Cursor adds new models.
export const CURSOR_MODELS = [
  { id: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5', description: 'Claude Sonnet 4.5 — Cursor default' },
  { id: 'claude-opus-4-5', label: 'claude-opus-4-5', description: 'Claude Opus 4.5 — most capable' },
  { id: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5', description: 'Claude Haiku 4.5 — fastest' },
  { id: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6', description: 'Claude Sonnet 4.6' },
] as const;

export type CursorModelId = (typeof CURSOR_MODELS)[number]['id'];

const MODEL_SETTING_KEY = 'reviewflow._aiModel';

export interface CursorLmReviewInput {
  language: string;
  fileName: string;
  selectedCode: string;
  startLine: number;
  endLine: number;
  surroundingContext: string;
}

export interface SingleCommentReview {
  severity: Severity;
  title: string;
  body: string;
}

/**
 * Picks a model if not yet configured, then calls the Anthropic API.
 * Returns undefined if the user cancelled model or key selection.
 */
export async function reviewWithSelectedModel(
  input: CursorLmReviewInput,
  apiKey: string,
  modelId: string,
  token: vscode.CancellationToken,
): Promise<SingleCommentReview> {
  const body = JSON.stringify({
    model: modelId,
    max_tokens: 1024,
    messages: [{ role: 'user', content: _buildPrompt(input) }],
  });

  if (token.isCancellationRequested) throw new vscode.CancellationError();

  const raw = await _anthropicPost(apiKey, body);

  let responseText: string;
  try {
    const parsed = JSON.parse(raw) as { content?: Array<{ type: string; text?: string }> };
    responseText = parsed.content?.find((b) => b.type === 'text')?.text ?? '';
  } catch {
    throw new Error('Unexpected response from Anthropic API.');
  }

  return _parseResponse(responseText);
}

/** Prompt the user to pick a model from the Cursor model list. Returns undefined on cancel. */
export async function pickModel(): Promise<CursorModelId | undefined> {
  const saved = vscode.workspace.getConfiguration().get<string>(MODEL_SETTING_KEY);
  if (saved && CURSOR_MODELS.some((m) => m.id === saved)) {
    return saved as CursorModelId;
  }

  const items = CURSOR_MODELS.map((m) => ({
    label: m.label,
    description: m.description,
    id: m.id,
  }));

  const pick = await vscode.window.showQuickPick(items, {
    title: 'ReviewFlow: Select AI model',
    placeHolder: 'Choose the model to use for code reviews (matches Cursor model selector)',
    ignoreFocusOut: true,
  });

  if (!pick) return undefined;

  // Persist selection
  await vscode.workspace
    .getConfiguration()
    .update(MODEL_SETTING_KEY, pick.id, vscode.ConfigurationTarget.Global);

  return pick.id as CursorModelId;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _buildPrompt(input: CursorLmReviewInput): string {
  const lineRange =
    input.startLine === input.endLine
      ? `line ${input.startLine}`
      : `lines ${input.startLine}–${input.endLine}`;

  const contextBlock = input.surroundingContext
    ? `Surrounding context:\n\`\`\`${input.language}\n${input.surroundingContext}\n\`\`\`\n\n`
    : '';

  return `You are performing a professional code review. Analyse the selected code and produce one focused, actionable review comment.

File: ${input.fileName} (${input.language})
Selection: ${lineRange}

${contextBlock}Selected code:
\`\`\`${input.language}
${input.selectedCode}
\`\`\`

Review focus (address whichever apply; skip irrelevant areas):
- Correctness & bugs
- Readability & naming
- Maintainability & design
- Performance
- Security

Respond with ONLY a JSON object — no markdown fences, no prose:
{
  "severity": "info" | "warning" | "error",
  "title": "concise one-line title, max 80 chars",
  "body": "detailed review comment in Markdown, specific and actionable"
}

Use "error" for bugs or security issues, "warning" for things that should be improved, "info" for style or minor suggestions.`;
}

function _parseResponse(raw: string): SingleCommentReview {
  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('AI response did not contain a JSON object.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('Failed to parse AI response as JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('AI response is not a JSON object.');
  }

  const obj = parsed as Record<string, unknown>;

  if (!['info', 'warning', 'error'].includes(obj.severity as string)) {
    throw new Error(`Invalid severity "${String(obj.severity)}" in AI response.`);
  }
  if (typeof obj.title !== 'string' || !obj.title.trim()) {
    throw new Error('AI response is missing "title".');
  }
  if (typeof obj.body !== 'string' || !obj.body.trim()) {
    throw new Error('AI response is missing "body".');
  }

  return {
    severity: obj.severity as Severity,
    title: obj.title.trim(),
    body: obj.body.trim(),
  };
}

function _anthropicPost(apiKey: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode != null && res.statusCode >= 400) {
            reject(new Error(`${res.statusCode}: ${text}`));
          } else {
            resolve(text);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
