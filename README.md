# ReviewFlow

IDE-native code review workspace for GitLab.

## Prerequisites

- Python 3.11+ (via Homebrew: `brew install python@3.11`)
- Node.js 20+ and npm
- VS Code 1.85+ (for development) or Cursor (for testing)

---

## Runbooks

### Package the extension (single command)

Produces `extension/reviewflow-0.1.0.vsix` — the installable artifact.

```bash
cd extension
npm run package
```

This compiles TypeScript then packages everything into a `.vsix`. Run this whenever you want a fresh build to install in Cursor.

---

### Install in Cursor

Cursor supports local `.vsix` installation but does **not** support the Extension Development Host (F5 debugging). Use VS Code for iterative development and Cursor for end-to-end testing.

**Via the Cursor UI:**

1. Open Cursor.
2. Open the Extensions panel (`⇧⌘X`).
3. Click the `···` menu at the top-right of the panel.
4. Select **Install from VSIX…**
5. Navigate to `extension/reviewflow-0.1.0.vsix` and confirm.

**Via the command palette:**

1. Open the command palette (`⇧⌘P`).
2. Run **Extensions: Install from VSIX…**
3. Select `extension/reviewflow-0.1.0.vsix`.

After installation, reload the window when prompted. ReviewFlow will appear in the activity bar.

To update after code changes: run `npm run package` again and re-install the `.vsix`. Cursor will replace the existing version.

---

### Develop iteratively in VS Code (F5)

Cursor does not support the Extension Development Host, so use VS Code for the edit → run → inspect loop.

1. Open the `extension/` folder in VS Code.
2. Start watch mode in a terminal:

```bash
cd extension
npm run watch
```

3. Press **F5** — opens an Extension Development Host window with ReviewFlow active and live-reloads on recompile.

When ready to test in Cursor, run `npm run package` and install the `.vsix` as above.

---

### Start the backend

The extension auto-starts the backend on activation — you do not need to run this manually during normal use.

To start it independently for API testing:

```bash
cd backend
.venv/bin/python3 -m uvicorn app.main:app --port 51515 --host 127.0.0.1
```

Verify it's running:

```bash
curl http://127.0.0.1:51515/api/v1/gitlab-instances
# Expected: []
```

---

### Set up the backend from scratch

Only needed on a fresh clone — `.venv/` is not committed.

```bash
cd backend
/opt/homebrew/bin/python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

---

### Install extension dependencies from scratch

Only needed on a fresh clone — `node_modules/` is not committed.

```bash
cd extension
npm install
```

---

### Run the backend smoke test

```bash
BASE="http://127.0.0.1:51515/api/v1"

# Create a GitLab instance
curl -s -X POST "$BASE/gitlab-instances" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"GitLab.com","base_url":"https://gitlab.com","api_path":"/api/v4"}'

# List instances
curl -s "$BASE/gitlab-instances"

# List repositories
curl -s "$BASE/repositories"
```

---

### Reset local database

The SQLite database is stored at `~/.reviewflow/reviewflow.db`.

```bash
rm ~/.reviewflow/reviewflow.db
```

The backend recreates it with the correct schema on next startup.
