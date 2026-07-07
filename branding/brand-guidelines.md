# ReviewFlow Brand Guidelines

## Brand Overview

**ReviewFlow** is an IDE-native GitLab code review workspace for Cursor and VS Code.

**Tagline:** Review code where you write it.

The brand communicates precision, developer fluency, and seamless workflow integration. It should feel at home alongside tools like Docker, Terraform, Postman, GitHub Desktop, and GitKraken — modern, minimal, technical, and trustworthy.

---

## Logo

### The Converge Mark

The ReviewFlow symbol represents the core product workflow:

| Element | Meaning |
|---------|---------|
| **Two branch paths** | Parallel code streams from collaborators or feature branches |
| **Node dots** | Review checkpoints and team input |
| **Central pane** | The in-IDE diff/review surface |
| **Diff lines** | Code under review — additions, changes, context |
| **Output flow** | Merged, reviewed code continuing downstream |

The mark is called the **Converge Mark**. It must never be confused with speech bubbles, Git provider logos, or AI imagery.

### Logo Variants

| File | Use Case |
|------|----------|
| `logo.svg` | Default horizontal logo (light backgrounds) |
| `logo-light.svg` | Explicit light-background variant |
| `logo-dark.svg` | Dark backgrounds (README banners, dark UI chrome) |
| `wordmark.svg` | Text-only contexts where the mark is shown separately |
| `icon.svg` | App icon, avatars, square contexts |
| `favicon.svg` | Browser tab favicon (includes dark rounded background) |

### Clear Space

Maintain clear space around the logo equal to the height of the review pane in the mark (approximately 20% of the total logo height). No other elements, text, or graphics should enter this zone.

### Minimum Sizes

| Asset | Minimum Width |
|-------|---------------|
| Full logo (mark + wordmark) | 120px |
| Converge Mark alone | 16px |
| Wordmark alone | 80px |

Below minimum sizes, use `icon.svg` or `favicon.svg` instead of the full logo.

---

## Color

See [color-palette.md](./color-palette.md) for the complete palette.

**Quick reference:**

- Primary `#2563EB` — trust, action, structure
- Secondary `#06B6D4` — flow, movement, collaboration
- Dark `#0F172A` — depth, professionalism
- Light `#F8FAFC` — clarity, IDE-native lightness

The Converge Mark always uses Primary for the review pane and right branch, Secondary for the left branch and output flow.

---

## Typography

See [typography.md](./typography.md) for the complete type system.

- **Inter** for all UI and marketing text
- **JetBrains Mono** for code and technical content
- Wordmark: Inter Semibold, "Review" in neutral, "Flow" in Secondary

---

## Voice and Tone

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Direct** | Say what it does, no fluff | "Review code where you write it." |
| **Technical** | Speak developer language | "Sync draft comments to your GitLab MR." |
| **Calm** | Confident, not hype-driven | "Your review workspace, inside the editor." |
| **Inclusive** | Open-source friendly | "Built for teams who review in the IDE." |

Avoid: marketing superlatives, AI buzzwords, aggressive growth language.

---

## Imagery and Graphics

### Do
- Dark slate backgrounds with subtle grid patterns
- Generous whitespace
- Code diff aesthetics (line numbers, hunks) as decorative context
- Flow diagrams and pipeline metaphors

### Don't
- Stock photos of people at computers
- Generic speech bubble icons
- GitLab or GitHub logos (respect third-party trademarks)
- AI/robot imagery
- Gradients applied directly to the Converge Mark

---

## Social and Marketing Assets

| File | Dimensions | Usage |
|------|------------|-------|
| `banner.svg` | 1280 × 640 | GitHub repository social banner |
| `social-preview.svg` | 1280 × 640 | Open Graph / social sharing preview |
| `icon.png` | 128 × 128 | Raster icon for contexts requiring PNG |

### GitHub Banner Content
1. **ReviewFlow** (wordmark)
2. **Review code where you write it.** (tagline)
3. **Cursor • VS Code • GitLab** (platform line)

---

## Application Examples

### VS Code / Cursor Extension
- Use `icon.png` (128×128) as the extension marketplace icon
- Use `icon.svg` for in-editor tree views and activity bar
- Extension display name: **ReviewFlow**

### README Header
```markdown
<p align="center">
  <img src="branding/logo-dark.svg" alt="ReviewFlow" width="320">
</p>
<p align="center"><strong>Review code where you write it.</strong></p>
```

### GitHub Social Banner
Upload `banner.svg` (or export to PNG at 1280×640) as the repository social preview image.

---

## File Inventory

```
branding/
├── logo.svg              # Default logo
├── logo-dark.svg         # Logo for dark backgrounds
├── logo-light.svg        # Logo for light backgrounds
├── icon.svg              # Standalone Converge Mark
├── icon.png              # Raster icon (128×128)
├── favicon.svg           # Browser favicon
├── banner.svg            # GitHub social banner
├── social-preview.svg    # Open Graph preview
├── wordmark.svg          # Text-only logo
├── color-palette.md      # Color specifications
├── typography.md         # Type system
└── brand-guidelines.md   # This document
```

---

## Trademark Usage

When referring to third-party products, use their official names:
- **Cursor** (Anysphere)
- **VS Code** (Microsoft)
- **GitLab** (GitLab Inc.)

ReviewFlow is an independent open-source project. Do not imply official endorsement by GitLab, Microsoft, or Anysphere.

---

## Contact

For brand asset questions or high-resolution exports, open an issue in the project repository.
