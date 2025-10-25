# Changelog
All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [Unreleased]

## [0.4.6] – 2025-10-25
### Added
- Styling tokens: `--range` (in-range tint) and `--hover-day` (true day hover). `--hover` remains a legacy alias.
- Placeholders: `placeholder-checkin`, `placeholder-checkout`.
- Max nights enforcement: `max-nights="N"` (`0` = unlimited) with friendly hints.
- Documentation: Quick start, attributes table, styling tokens.

### Fixed
- One-night bridge now neutral (no default blue), including hover preview.
- Static render polish (no chevron flash); CSS load order inside the Shadow DOM.
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
```
- (Optional) Adopt new tokens:
```html
style="--accent:#808000; --range:#a0ae62; --hover-day:#e5ecc4"
```
- (Optional) Add placeholders:
```html
placeholder-checkin="Select arrival date"
placeholder-checkout="Select departure date"
```
