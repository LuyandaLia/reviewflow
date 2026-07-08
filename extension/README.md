# ReviewFlow — GitLab Code Reviews

**Review code where you write it.**

ReviewFlow is an IDE-native GitLab code review workspace for Cursor and VS Code. Draft inline comments, manage review sessions, and publish directly to merge requests — without leaving the editor.

---

## Features

- **Draft inline comments** — highlight code, add a review comment, see it in the gutter
- **Review sessions** — group comments by branch or MR; keep drafts until you're ready
- **Publish to GitLab** — post comments as inline MR discussions in one click
- **Sync with GitLab** — check whether published notes still exist on the MR
- **AI suggestions** — optional AI-assisted comments powered by Anthropic Claude *(currently in testing)*
- **Self-hosted support** — works with GitLab.com and any self-hosted GitLab instance

---

## Requirements

| Requirement | Version |
|---|---|
| VS Code or Cursor | 1.85 or later |
| Python | 3.11 or later |
| Git | any recent version |
| GitLab access token | `api` scope |

---

## Installation

### From a VSIX file

**Mac / Linux**
```bash
code --install-extension reviewflow-0.1.0.vsix
# or for Cursor:
cursor --install-extension reviewflow-0.1.0.vsix
```

**Windows (PowerShell)**
```powershell
code --install-extension reviewflow-0.1.0.vsix
# or for Cursor:
cursor --install-extension reviewflow-0.1.0.vsix
```

---

## Backend Setup

ReviewFlow runs a small local backend (FastAPI + SQLite) that stores your draft comments and review sessions. **The extension sets this up automatically** — no manual steps required. On first activation, ReviewFlow will:

1. Create a Python virtual environment inside the `backend/` directory
2. Install the required dependencies
3. Start the backend server

All you need is **Python 3.11+** installed and available on your PATH.

> **Windows note:** If Python isn't on your PATH, download it from [python.org](https://www.python.org/downloads/) and check "Add Python to PATH" during installation.

---

## Getting Started

1. Open the **ReviewFlow** panel in the activity bar (the speech-bubble icon).
2. Click **Add GitLab Instance** — enter your GitLab URL (e.g. `https://gitlab.com`).
3. When prompted, paste a GitLab Personal Access Token with `api` scope.
   - ReviewFlow validates the token immediately and shows **✓ Connected as @username**.
4. Click **Add Repository** — point it to a local Git repository you want to review.
5. Create a **Review Session** under the repository.
6. Open a file, select a line or range, right-click → **ReviewFlow: Add Draft Comment**.
7. When ready, click **Publish Session to GitLab** — enter the MR IID or paste the MR URL.

---

## Creating a GitLab Access Token

1. Go to **GitLab → User Settings → Access Tokens** (or project-level **Settings → Access Tokens**).
2. Give the token a name, set an expiry, and select the **`api`** scope.
3. Copy the token — you will not be able to see it again.
4. Paste it into ReviewFlow when prompted.

---

## Configuration

ReviewFlow works out of the box with no configuration required. The following settings are available for advanced use:

| Setting | Default | Description |
|---|---|---|
| `reviewflow._port` | `51515` | Port the local backend listens on |
| `reviewflow._pythonPath` | auto | Override the Python executable path |
| `reviewflow._backendPath` | auto | Override the backend directory path |

To change a setting: **File → Preferences → Settings** → search "reviewflow".

---

## Troubleshooting

### "Cannot connect to the ReviewFlow backend"

The local backend failed to start. Check the **ReviewFlow Backend** output channel (`View → Output → ReviewFlow Backend`) for error details.

The most common cause is Python not being found. Verify it is installed and on your PATH:

**Mac / Linux**
```bash
python3 --version
```

**Windows**
```powershell
python --version
```

If Python is missing, install it from [python.org](https://www.python.org/downloads/) and reload the window. ReviewFlow will then set up the environment automatically.

### ExecutionPolicy error on Windows (venv setup fails)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then reload the Cursor / VS Code window to trigger setup again.

### "GitLab authentication failed"

The token may have expired or been revoked. Right-click any comment → **ReviewFlow: Publish** and choose **Update Token** when prompted, or remove and re-add the GitLab instance.

### Comments published as general notes (no code context)

This happens when the MR has received new commits since the draft was created and the original line is no longer in the diff. The comment is still posted to the MR — just not as an inline thread. Re-draft the comment against the updated diff to get inline placement.

---

## License

[MIT](LICENSE)
