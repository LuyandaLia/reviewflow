# ReviewFlow

**Review code where you write it.**

ReviewFlow is an IDE-native GitLab code review workspace for Cursor and VS Code. Draft inline comments, manage review sessions, and publish to merge requests — without leaving the editor.

## Features

- **GitLab merge request reviews** — connect GitLab.com or self-hosted instances
- **Draft comments** — add, edit, and publish inline review comments from the editor gutter
- **Review sessions** — organize work across branches and merge requests
- **Sync with GitLab** — publish sessions and comments directly to your MR
- **AI suggestions** — optional AI-assisted comment suggestions (requires API key)

## Getting Started

1. Install ReviewFlow from the marketplace (or install a `.vsix` locally).
2. Open the ReviewFlow panel in the activity bar.
3. Add a GitLab instance and personal access token.
4. Register a repository and create a review session.
5. Select code in the editor, add draft comments, and publish to GitLab.

## Requirements

- VS Code 1.85+ or Cursor
- Python 3.11+ (bundled backend starts automatically on activation)
- A GitLab personal access token with `api` scope

## Documentation

Full setup, development, and contribution guides are in the [repository](https://github.com/LuyandaLia/reviewflow).

## License

[MIT](https://github.com/LuyandaLia/reviewflow/blob/main/LICENSE)
