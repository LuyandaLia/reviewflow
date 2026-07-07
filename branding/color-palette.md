# ReviewFlow Color Palette

## Brand Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Primary** | `#2563EB` | `37, 99, 235` | Logo mark, primary buttons, links, active states |
| **Secondary** | `#06B6D4` | `6, 182, 212` | Flow accents, "Flow" wordmark, branch paths, highlights |
| **Dark** | `#0F172A` | `15, 23, 42` | Dark backgrounds, primary text on light surfaces |
| **Light** | `#F8FAFC` | `248, 250, 252` | Light backgrounds, text on dark surfaces, diff lines in mark |

## Extended Palette

| Name | Hex | Usage |
|------|-----|-------|
| **Primary Hover** | `#1D4ED8` | Button hover, interactive emphasis |
| **Primary Light** | `#3B82F6` | Mark on dark backgrounds, elevated surfaces |
| **Secondary Hover** | `#0891B2` | Accent hover states |
| **Slate 800** | `#1E293B` | Banner gradients, card backgrounds (dark mode) |
| **Slate 600** | `#475569` | Secondary text (dark mode) |
| **Slate 500** | `#64748B` | Tertiary text, metadata |
| **Slate 400** | `#94A3B8` | Taglines, subdued labels |
| **Slate 300** | `#CBD5E1` | Borders (dark mode) |
| **Slate 200** | `#E2E8F0` | Borders (light mode) |
| **Slate 100** | `#F1F5F9` | Subtle backgrounds (light mode) |

## Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#22C55E` | Approved reviews, published comments |
| **Warning** | `#F59E0B` | Pending actions, draft state |
| **Error** | `#EF4444` | Failed sync, validation errors |
| **Info** | `#2563EB` | Informational notices |

## Color Application

### Logo Mark
- **Left branch + output flow:** Secondary (`#06B6D4`)
- **Right branch + review pane:** Primary (`#2563EB`)
- **Diff lines inside pane:** Light (`#F8FAFC`)

### Wordmark
- **"Review":** Dark (`#0F172A`) on light backgrounds, Light (`#F8FAFC`) on dark backgrounds
- **"Flow":** Secondary (`#06B6D4`) on all backgrounds

### Backgrounds
- **Light mode:** `#F8FAFC` base, `#FFFFFF` cards
- **Dark mode:** `#0F172A` base, `#1E293B` cards

## Accessibility

| Combination | Contrast Ratio | WCAG |
|-------------|----------------|------|
| Primary on Light | 4.6:1 | AA (large text) |
| Dark on Light | 15.4:1 | AAA |
| Light on Dark | 15.4:1 | AAA |
| Secondary on Dark | 5.8:1 | AA |
| Slate 400 on Dark | 5.1:1 | AA |

## CSS Custom Properties

```css
:root {
  --rf-primary: #2563EB;
  --rf-primary-hover: #1D4ED8;
  --rf-primary-light: #3B82F6;
  --rf-secondary: #06B6D4;
  --rf-secondary-hover: #0891B2;
  --rf-dark: #0F172A;
  --rf-light: #F8FAFC;
  --rf-success: #22C55E;
  --rf-warning: #F59E0B;
  --rf-error: #EF4444;
}
```

## Do Not

- Use gradients on the logo mark itself
- Place the mark on busy or low-contrast backgrounds
- Alter the ratio of Primary to Secondary in the mark
- Use colors outside this palette for brand-facing materials
