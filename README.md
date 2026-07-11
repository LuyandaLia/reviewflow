# ReviewFlow

**Review code where you write it.**

ReviewFlow is an IDE-native GitLab code review workspace for Cursor and VS Code. Draft inline comments, manage review sessions, and publish directly to merge requests — without leaving the editor.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11 or later | Must be on your PATH — see [Python Setup](#python-setup) if needed |
| Node.js | 20 or later | [nodejs.org](https://nodejs.org/) |
| Git | any recent version | |
| VS Code or Cursor | 1.85 or later | |

---

## Quickstart

**1. Get the code**
```bash
git clone https://github.com/LuyandaLia/reviewflow.git
cd reviewflow
```

**2. Build the extension**
```bash
cd extension
npm install
npm run package
```

**3. Install in Cursor or VS Code**

**Mac / Linux**
```bash
cursor --install-extension reviewflow-0.1.0.vsix
# or for VS Code:
code --install-extension reviewflow-0.1.0.vsix
```

**Windows (PowerShell)**
```powershell
cursor --install-extension reviewflow-0.1.0.vsix
# or for VS Code:
code --install-extension reviewflow-0.1.0.vsix
```

**4. Reload the editor and you're ready**

Open the **ReviewFlow** panel in the activity bar. The extension sets up the Python backend automatically on first launch — no manual steps needed.

> **First launch** takes a moment longer while ReviewFlow creates the Python environment and installs backend dependencies. A progress notification will appear.

---

## Getting Started

1. Click **Add GitLab Instance** — enter your GitLab URL (e.g. `https://gitlab.com`).
2. Paste a Personal Access Token with `api` scope — ReviewFlow validates it immediately and shows **✓ Connected as @username**.
3. Click **Add Repository** — point it to a local Git repository.
4. Create a **Review Session** under the repository.
5. Open a file, select a line or range, right-click → **ReviewFlow: Add Draft Comment**.
   - A composer panel opens beside the editor — write your comment, pick a severity, then **Save Draft** or **Publish**.
   - Saved drafts appear as gutter annotations. Click one to open the inline thread.
6. Click **Publish Session to GitLab** when ready — enter the MR IID or paste the MR URL.

---

## Developer Runbooks

### Package the extension

```bash
cd extension
npm run package
```

Produces `extension/reviewflow-0.1.0.vsix`.

---

### Install in Cursor (UI)

1. Open the Extensions panel (`⇧⌘X` / `Ctrl+Shift+X`).
2. Click `···` → **Install from VSIX…**
3. Select `extension/reviewflow-0.1.0.vsix`.

---

### Develop iteratively in VS Code (F5)

Cursor does not support the Extension Development Host — use VS Code for the edit → run loop.

```bash
cd extension
npm run watch
```

Press **F5** in VS Code to open an Extension Development Host window with live reload.

---

### Start the backend manually (API testing)

**Mac / Linux**
```bash
cd backend
.venv/bin/python3 -m uvicorn app.main:app --port 51515 --host 127.0.0.1
```

**Windows**
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 51515 --host 127.0.0.1
```

Verify:
```bash
curl http://127.0.0.1:51515/health
# Expected: {"status":"ok","service":"reviewflow-backend"}
```

---

### Reset the local database

**Mac / Linux**
```bash
rm ~/.reviewflow/reviewflow.db
```

**Windows**
```powershell
Remove-Item "$env:USERPROFILE\.reviewflow\reviewflow.db"
```

The backend recreates the schema on next startup.

---

## Manual Setup

> These steps are only needed if the automatic backend setup fails, or if you want to manage the Python environment yourself.

### Python Setup

**Mac**
```bash
brew install python@3.11
```

**Linux (Ubuntu/Debian)**
```bash
sudo apt update && sudo apt install python3.11 python3.11-venv python3-pip
```

**Windows**

Download Python 3.11+ from [python.org](https://www.python.org/downloads/windows/). On the first installer screen, check **"Add Python to PATH"**.

---

### Manual Backend Setup

**Mac / Linux**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Windows (PowerShell)**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> If you see *"running scripts is disabled"*:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Then retry the activation step.

---

## License

[MIT](LICENSE) — see also [CONTRIBUTORS.md](CONTRIBUTORS.md).
