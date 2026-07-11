import * as vscode from 'vscode';
import type { Severity } from '../providers/severity';

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

export async function reviewWithCursorLm(
  input: CursorLmReviewInput,
  token: vscode.CancellationToken,
): Promise<SingleCommentReview> {
  const models = await vscode.lm.selectChatModels();
  if (models.length === 0) {
    throw new Error('No AI model is available. Enable GitHub Copilot or another AI provider in Cursor.');
  }

  const [model] = models;
  const messages = [vscode.LanguageModelChatMessage.User(_buildPrompt(input))];

  const response = await model.sendRequest(
    messages,
    { justification: 'Generating a draft code review comment for ReviewFlow' },
    token,
  );

  let raw = '';
  for await (const chunk of response.text) {
    if (token.isCancellationRequested) throw new vscode.CancellationError();
    raw += chunk;
  }

  return _parseResponse(raw);
}

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
