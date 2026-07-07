# ReviewFlow — Marketplace Release Guide

This document covers the process for publishing ReviewFlow to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/) and [Open VSX](https://open-vsx.org/) (for Cursor and other VS Code-compatible editors).

**Do not publish until every item in the [Marketplace Checklist](#marketplace-checklist) is complete.**

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Publisher account** | Create at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) |
| **Publisher ID** | `LuyandaLia` (must match `publisher` in `package.json`) |
| **Personal Access Token (PAT)** | Azure DevOps PAT with **Marketplace → Manage** scope |
| **Node.js 20+** | For building and packaging |
| **vsce** | Installed as a dev dependency (`npm install` in `extension/`) |

### One-time publisher setup

1. Sign in to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage).
2. Create a publisher with ID `LuyandaLia` (or update `package.json` to match your chosen ID).
3. Generate an Azure DevOps PAT:
   - Go to [dev.azure.com](https://dev.azure.com) → User Settings → Personal Access Tokens.
   - Create a token with **Custom defined** scope → **Marketplace → Manage**.
4. Store the PAT securely. Use it via environment variable — never commit it:

```bash
export VSCE_PAT="<your-pat>"
```

Alternatively, `vsce login LuyandaLia` will prompt for the PAT and store it via keytar.

---

## Versioning

ReviewFlow follows [Semantic Versioning](https://semver.org/):

| Bump | When |
|------|------|
| **MAJOR** (`1.0.0`) | Breaking changes to extension API, settings, or data format |
| **MINOR** (`0.2.0`) | New features, backward-compatible |
| **PATCH** (`0.1.1`) | Bug fixes, backward-compatible |

### Pre-1.0 convention

While `version` starts with `0.x`, treat **MINOR** bumps as feature releases and **PATCH** as fixes. Promote to `1.0.0` when the extension is stable for general use.

### Version bump workflow

```bash
cd extension

# Patch release
npm version patch

# Minor release
npm version minor

# Major release
npm version major
```

This updates `package.json` and creates a git tag. Alternatively, set the version manually in `package.json` before packaging.

---

## Release Process

### 1. Pre-release checklist

Complete every item in the [Marketplace Checklist](#marketplace-checklist) below.

### 2. Build and package

```bash
cd extension
npm install
npm run package
```

This compiles TypeScript and produces `reviewflow-<version>.vsix` in the `extension/` directory.

**Verify the package contents:**

```bash
npx vsce ls --tree
```

Expected inclusions:

- `package.json`, `LICENSE`, `README.md`
- `resources/icon.png` (128×128 marketplace icon)
- `resources/icon.svg` (activity bar icon)
- `out/` (compiled JavaScript)
- Gutter SVG assets

### 3. Smoke-test the VSIX locally

**VS Code:**

```bash
code --install-extension reviewflow-<version>.vsix
```

**Cursor:**

1. Extensions panel → `···` → **Install from VSIX…**
2. Select the generated `.vsix` file.
3. Reload the window.

Verify:

- [ ] Extension activates without errors
- [ ] Activity bar icon renders correctly
- [ ] Backend starts and connects
- [ ] GitLab instance can be added
- [ ] Draft comment flow works end-to-end

### 4. Tag and push

```bash
git add extension/package.json extension/CHANGELOG.md  # if updated
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

### 5. Create a GitHub Release

1. Go to [github.com/LuyandaLia/reviewflow/releases](https://github.com/LuyandaLia/reviewflow/releases).
2. Create a new release from tag `v0.1.0`.
3. Attach the `.vsix` file as a release asset.
4. Write release notes summarizing changes.

### 6. Publish to Visual Studio Marketplace

```bash
cd extension
export VSCE_PAT="<your-pat>"
npx vsce publish
```

Or publish a specific pre-built VSIX:

```bash
npx vsce publish --packagePath reviewflow-<version>.vsix
```

### 7. Publish to Open VSX (Cursor / VSCodium)

Cursor pulls extensions from Open VSX. After marketplace publish:

```bash
npm install -g ovsx
export OVSX_PAT="<your-open-vsx-pat>"
ovsx publish reviewflow-<version>.vsix
```

Create an Open VSX account at [open-vsx.org](https://open-vsx.org/).

### 8. Post-release

- [ ] Verify the listing page renders correctly (icon, banner, description, screenshots)
- [ ] Install from marketplace in a clean VS Code profile
- [ ] Install from Open VSX in Cursor
- [ ] Monitor [GitHub Issues](https://github.com/LuyandaLia/reviewflow/issues) for reports

---

## Publishing Reference

### package.json fields used by the marketplace

| Field | Value | Purpose |
|-------|-------|---------|
| `name` | `reviewflow` | Extension identifier (with publisher: `LuyandaLia.reviewflow`) |
| `displayName` | `ReviewFlow — GitLab Code Reviews` | Marketplace title |
| `description` | Tagline + feature summary | Short listing description |
| `version` | Semver | Release version |
| `publisher` | `LuyandaLia` | Publisher namespace |
| `icon` | `resources/icon.png` | 128×128 PNG listing icon |
| `license` | `MIT` | License identifier |
| `repository` | HTTPS Git URL | Source link |
| `homepage` | GitHub README URL | Project homepage |
| `bugs` | GitHub Issues URL | Bug report link |
| `categories` | `SCM Providers`, `Other` | Marketplace categories |
| `keywords` | GitLab, code review, etc. | Search discoverability |
| `galleryBanner` | `#0F172A` dark | Marketplace page banner |
| `qna` | `marketplace` | Q&A on marketplace |

### Useful vsce commands

```bash
# Package without publishing
npx vsce package

# Validate package.json and assets
npx vsce ls

# Show what would be published
npx vsce show LuyandaLia.reviewflow

# Unpublish (use with caution)
npx vsce unpublish LuyandaLia.reviewflow
```

---

## Screenshots Required

The marketplace listing requires visual assets to communicate the product. Prepare these before first publish.

### Marketplace icon

| Spec | Value |
|------|-------|
| File | `extension/resources/icon.png` |
| Size | 128 × 128 px |
| Format | PNG |
| Source | `branding/icon.png` |

### Gallery banner

| Spec | Value |
|------|-------|
| Color | `#0F172A` (configured in `galleryBanner`) |
| Theme | `dark` |
| Source asset | `branding/banner.svg` (export to PNG if customizing the gallery header) |

### Screenshots (required for a polished listing)

Capture at **1280 × 800** or **1440 × 900** (16:10). Save to `docs/screenshots/` (not bundled in the VSIX).

| # | Screenshot | What to show |
|---|------------|--------------|
| 1 | **Activity bar & repositories** | ReviewFlow panel with GitLab instances and repositories |
| 2 | **Review session tree** | Active session with draft comments in the sidebar |
| 3 | **Inline draft comment** | Editor with gutter decoration and selected code |
| 4 | **Publish to GitLab** | Comment published confirmation or MR sync state |
| 5 | **Add GitLab instance** | Instance setup flow (optional, for onboarding) |

**Tips:**

- Use a clean VS Code / Cursor window with the default dark theme.
- Hide unrelated panels and personal file paths.
- Add short captions in the marketplace upload UI.

### Social preview (GitHub, not marketplace)

| Spec | Value |
|------|-------|
| File | `branding/social-preview.svg` or `branding/banner.svg` |
| Size | 1280 × 640 px |
| Usage | GitHub repository social preview image |

---

## Marketplace Checklist

Use this checklist before every publish.

### Metadata

- [ ] `displayName` is clear and under 50 characters
- [ ] `description` includes the tagline and key value proposition
- [ ] `version` is bumped per semver
- [ ] `publisher` matches your marketplace publisher ID
- [ ] `repository`, `homepage`, and `bugs` URLs are correct and public
- [ ] `license` is `MIT` and `LICENSE` file is included in the VSIX
- [ ] `keywords` cover GitLab, code review, Cursor, VS Code
- [ ] `categories` are set (`SCM Providers`, `Other`)

### Assets

- [ ] `resources/icon.png` is 128×128 and matches brand guidelines
- [ ] `resources/icon.svg` renders in the activity bar at 16×16
- [ ] `galleryBanner` color matches brand (`#0F172A`)
- [ ] `extension/README.md` is complete with features and getting started
- [ ] Screenshots captured and ready to upload (see above)
- [ ] GitHub social preview image set (`branding/banner.svg`)

### Build & test

- [ ] `npm run compile` succeeds with no errors
- [ ] `npm run package` produces a `.vsix` without warnings
- [ ] VSIX installs and activates in VS Code
- [ ] VSIX installs and activates in Cursor
- [ ] Backend auto-starts on activation
- [ ] Core flows tested: add instance → add repo → draft comment → publish

### Legal & compliance

- [ ] No secrets or tokens in the packaged files
- [ ] Third-party trademarks used correctly (GitLab, VS Code, Cursor)
- [ ] MIT license applies to the extension
- [ ] Privacy policy considered if telemetry is added later

### Release

- [ ] Git tag created (`v<version>`)
- [ ] GitHub Release created with `.vsix` attached
- [ ] `vsce publish` to Visual Studio Marketplace
- [ ] `ovsx publish` to Open VSX
- [ ] Listing verified live in both marketplaces

---

## Troubleshooting

### `LICENSE not found` during packaging

Ensure `LICENSE` exists in the `extension/` directory (copied from repo root).

### Secret scanning error during `vsce package`

If `vsce` fails with a concurrency error in restricted environments, run packaging outside the sandbox or with full permissions.

### Publisher mismatch

The `publisher` field in `package.json` must exactly match your marketplace publisher ID. The full extension ID is `<publisher>.<name>` → `LuyandaLia.reviewflow`.

### Cursor cannot find the extension

Cursor uses Open VSX, not the Visual Studio Marketplace directly. Publish to both registries.

---

## Related Documents

- [Brand Guidelines](../branding/brand-guidelines.md)
- [Extension README](../extension/README.md)
- [Project README](../README.md)
