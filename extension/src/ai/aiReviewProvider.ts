export interface AiSuggestion {
  filePath: string;
  lineNumber: number;
  endLineNumber?: number;
  commentText: string;
  severity: 'info' | 'warning' | 'error';
}

export interface AiReviewInput {
  filePath: string;
  fileContent: string;
  startLine?: number;
  endLine?: number;
}

export interface AiReviewProvider {
  suggestReview(input: AiReviewInput): Promise<AiSuggestion[]>;
}
