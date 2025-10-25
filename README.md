# mtolives-book-now

The mtolives-book-now widget is a lightweight, self-hosted Web Component (Custom Element + Shadow DOM) that renders a two-field date-range picker (Check-in / Check-out) and a BOOK NOW button. It navigates to the Cloudbeds booking engine with the selected dates passed as query parameters.

## Quick start

Drop the custom element on your page and include the script. The widget opens a two-field date-range picker and sends `checkin` / `checkout` (ISO `YYYY-MM-DD`) to your booking URL.

```html
<mtolives-book-now
  book-url="https://www.mtoliveshotel.com/book-now"
  show-months="2"
  display-format="d M Y"
  min-nights="1"
  max-nights="3"
  labels="show"
  label-checkin="Arrival"
  label-checkout="Departure"
  label-choose-start="Choose arrival"
  label-choose-end="Choose departure"
  placeholder-checkin="Select arrival date"
  placeholder-checkout="Select departure date"
  style="--fieldW:260px; --rounded:6px; --accent:#808000; --range:#a0ae62; --hover-day:#e5ecc4; --shadow:0 10px 28px rgba(0,0,0,.18);">
</mtolives-book-now>

<script src="./mtolives-book-now.js?v=0.4.6" defer></script>
```

The script self-loads Flatpickr (local vendor first, CDN fallback). No external CSS is required.

---

## Attributes

| Name | Type / Values | Default | Notes |
|---|---|---|---|
| `book-url` | URL (required) | — | Destination for BOOK NOW; widget appends `?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD`. |
| `show-months` | number | `2` | Months shown side-by-side. |
| `display-format` | Flatpickr format | `d M Y` | Input display only (handoff stays ISO). |
| `min-nights` | number (≥1) | `1` | Enforced with a friendly hint. |
| `max-nights` | number (`0` = unlimited) | `0` | Enforced with a friendly hint. |
| `labels` | `show` / `hidden` / `none` | `none` | Controls visibility of labels above fields. |
| `label-checkin` / `label-checkout` | string | `Check-in` / `Check-out` | Visible labels above the fields. |
| `placeholder-checkin` / `placeholder-checkout` | string | falls back to labels | Placeholder text inside fields. |
| `label-choose-start` / `label-choose-end` | string | `Choose check-in` / `Choose check-out` | Text in the small pill at the top of the calendar. |
| `align` | `left` / `center` / `right` | `center` | Aligns the input/button row. |
| `accent` | CSS color | `#808000` | Optional attribute shortcut; also controllable via `--accent`. |
| `rounded` | CSS length | `12px` | Optional attribute shortcut; also controllable via `--rounded`. |

---

## Styling tokens (CSS variables)

Set these on the element (inline `style` or in a stylesheet):

- `--accent` — start/end day color (and the button background).
- `--range` — in-range strip color. (`--hover` remains a legacy alias for `--range`.)
- `--hover-day` — “mouse hover” color for a single day.
- `--fieldW` — input width.
- `--rounded` — corner radius.
- `--shadow` — button/card shadow.

Example:

```css
mtolives-book-now {
  --accent:#808000;
  --range:#a0ae62;
  --hover-day:#e5ecc4;
  --fieldW:260px;
  --rounded:6px;
  --shadow:0 10px 28px rgba(0,0,0,.18);
}
```

---

## Accessibility & behavior

- Keyboard and mouse supported; a pointer tracks the active field.
- Intent pill guides “Choose arrival / Choose departure”.
- One-night selections render neutral gaps (no default blue), including hover preview.
- URL handoff always uses ISO `YYYY-MM-DD`. Inputs follow your `display-format`.

---

## Versioning

This README reflects v0.4.6. See the repository Releases for notes and tags.  
To force browsers to load new JS, bump the query string (for example, `?v=0.4.6` → `?v=0.4.7`).
