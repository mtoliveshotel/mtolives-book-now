````md
# Changelog
All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog** and this project adheres to **Semantic Versioning**.

## [Unreleased]
- (add entries here for the next patch)

## [0.4.6] – 2025-10-25
### Added
- **Styling tokens:** `--range` (in-range tint) and `--hover-day` (true day hover). `--hover` remains as a legacy alias.
- **Placeholders:** `placeholder-checkin`, `placeholder-checkout`.
- **Max nights enforcement:** `max-nights="N"` (0 = unlimited) with friendly hints.
- **Docs:** Quick start, attributes table, styling tokens.

### Fixed
- One-night bridge now neutral (no default blue), including hover preview.
- Static render polish (no chevron flash); CSS load order inside Shadow DOM.
- Specificity tweaks so brand colors reliably override theme defaults.

### Changed
- Default theming uses `--accent` (endpoints), `--range` (strip), `--hover-day` (hover).

### Migration notes
- If you used `--hover` for in-range color, it still works; prefer `--range` going forward.
- To brand hover: set `--hover-day`.

### Upgrade checklist
- Update script to bust caches:
  ```html
  <script src="./mtolives-book-now.js?v=0.4.6" defer></script>
````

* (Optional) Adopt new tokens:

  ```html
  style="--accent:#808000; --range:#a0ae62; --hover-day:#e5ecc4"
  ```
* (Optional) Add placeholders:

  ```html
  placeholder-checkin="Select arrival date"
  placeholder-checkout="Select departure date"
  ```

## Earlier releases

* 0.4.x (pre-0.4.6): initial widget, labels, min-nights, basic theming.

````

### 2) Lean (if you don’t want “Earlier releases”)
```md
# Changelog
All notable changes to this project will be documented in this file.

The format is based on **Keep a Changelog** and this project adheres to **Semantic Versioning**.

## [Unreleased]

## [0.4.6] – 2025-10-25
### Added
- `--range`, `--hover-day` tokens; placeholders; max-nights; docs.

### Fixed
- Neutral 1-night bridge (incl. hover); static render polish; color specificity.

### Changed
- Theming via `--accent` (endpoints), `--range` (strip), `--hover-day` (hover).

### Migration notes
- `--hover` still works; prefer `--range`. Set `--hover-day` to brand hover.

### Upgrade checklist
- `<script src="./mtolives-book-now.js?v=0.4.6" defer></script>`
- Optional tokens/placeholder updates as needed.
````

Either one is fine. If you later want clickable diffs, we can add compare links at the bottom.
