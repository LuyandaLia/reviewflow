import * as https from 'https';
import type { AiReviewInput, AiReviewProvider, AiSuggestion } from './aiReviewProvider';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export class AnthropicProvider implements AiReviewProvider {
  constructor(private readonly apiKey: string) {}

  async suggestReview(input: AiReviewInput): Promise<AiSuggestion[]> {
    const rangeNote =
      input.startLine != null && input.endLine != null
        ? ` Focus on lines ${input.startLine}–${input.endLine}.`
        : '';

    const prompt =
      `You are a code reviewer. Review the following file and suggest specific improvements.\n` +
      `File: ${input.filePath}${rangeNote}\n\n` +
      `Return ONLY a JSON array of suggestions with this exact shape:\n` +
      `[{"filePath":"<relative path>","lineNumber":<1-based int>,"endLineNumber":<1-based int or null>,"commentText":"<markdown>","severity":"info"|"warning"|"error"}]\n\n` +
      `If there are no suggestions, return an empty array []. Do not include any text outside the JSON.\n\n` +
      `\`\`\`\n${input.fileContent}\n\`\`\``;

    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = await this._post(body);

    let parsed: unknown;
    try {
      const content = JSON.parse(responseText) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const textBlock = content.content?.find((b) => b.type === 'text');
      parsed = JSON.parse(textBlock?.text ?? '[]');
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (s): s is Record<string, unknown> =>
          typeof s === 'object' && s !== null,
      )
      .map((s) => ({
        filePath: String(s['filePath'] ?? input.filePath),
        lineNumber: Number(s['lineNumber'] ?? 1),
        endLineNumber: s['endLineNumber'] != null ? Number(s['endLineNumber']) : undefined,
        commentText: String(s['commentText'] ?? ''),
        severity: (['info', 'warning', 'error'].includes(String(s['severity']))
          ? String(s['severity'])
          : 'info') as 'info' | 'warning' | 'error',
      }))
      .filter((s) => s.commentText.length > 0);
  }

  private _post(body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        ANTHROPIC_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode != null && res.statusCode >= 400) {
              reject(new Error(`Anthropic API error ${res.statusCode}: ${text}`));
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
}
