# ReviewFlow

**Review code where you write it.**

ReviewFlow is an IDE-native GitLab code review workspace for Cursor and VS Code. Draft inline comments, manage review sessions, and publish directly to merge requests — without leaving the editor.

---

## Getting the Code

```bash
git clone https://github.com/LuyandaLia/reviewflow.git
cd reviewflow
```

---

## Installation

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11 or later | See platform instructions below |
| Node.js | 20 or later | Required to build the extension |
| npm | 9 or later | Comes with Node.js |
| VS Code or Cursor | 1.85 or later | |
| Git | any recent version | |

---

### Mac

**1. Install Python**
```bash
brew install python@3.11
```

**2. Install Node.js**
```bash
brew install node
```

**3. Set up the backend**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**4. Build and install the extension**
```bash
cd ../extension
npm install
npm run package
cursor --install-extension reviewflow-0.1.0.vsix
# or for VS Code:
code --install-extension reviewflow-0.1.0.vsix
```

---

### Linux

**1. Install Python and Node.js** (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip nodejs npm
```

For other distributions, use the equivalent package manager (`dnf`, `pacman`, etc.).

**2. Set up the backend**
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**3. Build and install the extension**
```bash
cd ../extension
npm install
npm run package
code --install-extension reviewflow-0.1.0.vsix
# or for Cursor:
cursor --install-extension reviewflow-0.1.0.vsix
```

---

### Windows

**1. Install Python**

Download Python 3.11+ from [python.org](https://www.python.org/downloads/windows/) and run the installer. On the first screen, check **"Add Python to PATH"** before clicking Install.

**2. Install Node.js**

Download Node.js 20+ from [nodejs.org](https://nodejs.org/) and run the installer.

**3. Set up the backend** (PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> If you see *"running scripts is disabled on this system"*, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Then retry the activation step.

**4. Build and install the extension** (PowerShell)
```powershell
cd ..\extension
npm install
npm run package
cursor --install-extension reviewflow-0.1.0.vsix
# or for VS Code:
code --install-extension reviewflow-0.1.0.vsix
```

---

## First Run

After installing the extension:

1. Reload the editor window when prompted.
2. Open the **ReviewFlow** panel in the activity bar.
3. Click **Add GitLab Instance** and enter your GitLab URL.
4. Paste a GitLab Personal Access Token with `api` scope — ReviewFlow validates it immediately.
5. Add a repository, create a review session, and start drafting comments.

The backend starts automatically when the extension activates. If it is the first run and no virtual environment exists yet, the extension will create it and install dependencies automatically.

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

The SQLite database is stored at `~/.reviewflow/reviewflow.db` (Mac/Linux) or `%USERPROFILE%\.reviewflow\reviewflow.db` (Windows).

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

## License

[MIT](LICENSE)

## Contributors

See [CONTRIBUTORS.md](CONTRIBUTORS.md).
