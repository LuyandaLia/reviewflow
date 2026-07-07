# ReviewFlow Typography

## Typefaces

### Primary — Inter

**Role:** UI text, headings, marketing, wordmark fallback

**Source:** [Google Fonts — Inter](https://fonts.google.com/specimen/Inter) (SIL Open Font License)

Inter is the primary typeface for all ReviewFlow interfaces and brand materials. It is optimized for screen readability at small sizes and aligns with the modern, technical aesthetic of developer tools like Docker, Terraform, and Postman.

| Weight | Name | Usage |
|--------|------|-------|
| 400 | Regular | Body text, descriptions, taglines |
| 500 | Medium | Labels, navigation, platform badges |
| 600 | Semibold | Subheadings, buttons, wordmark |
| 700 | Bold | Page titles, banner headlines |

### Monospace — JetBrains Mono

**Role:** Code snippets, diff views, terminal output, technical labels

**Source:** [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License)

JetBrains Mono complements Inter in IDE-native contexts. Use it anywhere code is displayed inline or in blocks.

| Weight | Name | Usage |
|--------|------|-------|
| 400 | Regular | Inline code, file paths |
| 500 | Medium | Emphasized code references |
| 700 | Bold | Diff additions, highlighted hunks |

## Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `display` | 72px / 4.5rem | 1.1 | 700 | GitHub banners, hero headlines |
| `h1` | 48px / 3rem | 1.15 | 700 | Page titles |
| `h2` | 36px / 2.25rem | 1.2 | 600 | Section headings |
| `h3` | 24px / 1.5rem | 1.3 | 600 | Card titles |
| `h4` | 20px / 1.25rem | 1.4 | 600 | Subsection headings |
| `body-lg` | 18px / 1.125rem | 1.6 | 400 | Lead paragraphs |
| `body` | 16px / 1rem | 1.6 | 400 | Default body text |
| `body-sm` | 14px / 0.875rem | 1.5 | 400 | Secondary text, captions |
| `label` | 12px / 0.75rem | 1.4 | 500 | Badges, metadata, overlines |
| `code` | 14px / 0.875rem | 1.5 | 400 | Monospace body |

## Letter Spacing

| Context | Tracking |
|---------|----------|
| Display / H1 | -1.5px to -0.5px (tight) |
| Body | 0 (default) |
| Labels / overlines | +0.5px to +1px (slight open) |
| Platform badges | +1px |

## Wordmark Typography

The ReviewFlow wordmark uses **Inter Semibold (600)** with tight tracking (-0.5px):

- **Review** — Primary text color (Dark or Light depending on background)
- **Flow** — Secondary accent (`#06B6D4`)

Do not modify the weight split, add letter-spacing between the two parts, or use a different typeface for the wordmark.

## CSS Implementation

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --rf-font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --rf-font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
}

body {
  font-family: var(--rf-font-sans);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--rf-dark);
}

code, pre {
  font-family: var(--rf-font-mono);
  font-size: 0.875rem;
}
```

## Fallback Stack

When Inter is unavailable (e.g., in SVG exports or system contexts):

```
Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif
```

When JetBrains Mono is unavailable:

```
'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Liberation Mono', monospace
```

## Do Not

- Use serif or decorative typefaces in brand materials
- Set body text below 14px
- Use all-caps for headings (sentence case preferred)
- Apply gradients or shadows to type
- Stretch or condense letterforms
