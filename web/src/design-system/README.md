# Design System

Plain CSS (tokens + CSS Modules). No external UI library.

## Token file

`tokens.css` — imported once in `main.tsx` via `global.css`.
All tokens are CSS custom properties on `:root`.

### Colors

| Token                     | Value     | Usage                   |
| ------------------------- | --------- | ----------------------- |
| `--color-primary`         | `#2563eb` | Primary action fill     |
| `--color-primary-hover`   | `#1d4ed8` | Primary hover state     |
| `--color-primary-fg`      | `#ffffff` | Text on primary fill    |
| `--color-secondary`       | `#6b7280` | Neutral action fill     |
| `--color-secondary-hover` | `#4b5563` | Secondary hover state   |
| `--color-secondary-fg`    | `#ffffff` | Text on secondary fill  |
| `--color-danger`          | `#dc2626` | Destructive action fill |
| `--color-danger-hover`    | `#b91c1c` | Danger hover state      |
| `--color-danger-fg`       | `#ffffff` | Text on danger fill     |
| `--color-surface`         | `#ffffff` | Card / input background |
| `--color-surface-raised`  | `#f9fafb` | Page background         |
| `--color-surface-border`  | `#e5e7eb` | Card / input border     |
| `--color-text`            | `#111827` | Primary body text       |
| `--color-text-muted`      | `#6b7280` | Secondary / helper text |
| `--color-alert-bg`        | `#fef2f2` | Error banner background |
| `--color-alert-border`    | `#fecaca` | Error banner border     |
| `--color-alert-text`      | `#b91c1c` | Error banner text       |
| `--color-focus-ring`      | `#93c5fd` | Keyboard focus outline  |

### Spacing scale (4 px base)

| Token        | rem      | px    |
| ------------ | -------- | ----- |
| `--space-1`  | 0.25 rem | 4 px  |
| `--space-2`  | 0.5 rem  | 8 px  |
| `--space-3`  | 0.75 rem | 12 px |
| `--space-4`  | 1 rem    | 16 px |
| `--space-5`  | 1.25 rem | 20 px |
| `--space-6`  | 1.5 rem  | 24 px |
| `--space-8`  | 2 rem    | 32 px |
| `--space-10` | 2.5 rem  | 40 px |
| `--space-12` | 3 rem    | 48 px |
| `--space-16` | 4 rem    | 64 px |

### Typography

**Font families**

- `--font-family-base` — system UI sans-serif stack
- `--font-family-mono` — system monospace stack

**Font sizes** (`xs` → `3xl`): 0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 rem

**Font weights**: `normal` (400) / `medium` (500) / `semibold` (600) / `bold` (700)

**Line heights**: `tight` (1.25) / `normal` (1.5) / `loose` (1.75)

### Border radii

| Token           | Value            |
| --------------- | ---------------- |
| `--radius-sm`   | 0.25 rem (4 px)  |
| `--radius-base` | 0.375 rem (6 px) |
| `--radius-md`   | 0.5 rem (8 px)   |
| `--radius-lg`   | 0.75 rem (12 px) |
| `--radius-full` | 9999 px (pill)   |

### Shadows

| Token         | Usage                          |
| ------------- | ------------------------------ |
| `--shadow-sm` | Subtle lift (cards, buttons)   |
| `--shadow-md` | Moderate elevation (dropdowns) |
| `--shadow-lg` | High elevation (modals)        |

---

## Components

### `Button`

`web/src/components/Button.tsx`

```tsx
import { Button } from './components/Button';

<Button variant="primary">Add note</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete</Button>
```

**Props**

| Prop      | Type                                      | Default     | Description               |
| --------- | ----------------------------------------- | ----------- | ------------------------- |
| `variant` | `'primary' \| 'secondary' \| 'danger'`    | `'primary'` | Visual style              |
| `...rest` | `ButtonHTMLAttributes<HTMLButtonElement>` | —           | All standard button props |

**Variants**

- **primary** — blue fill; use for the main affirmative / submit action.
- **secondary** — gray fill; use for neutral or cancel actions.
- **danger** — red fill; use for irreversible / destructive actions.
