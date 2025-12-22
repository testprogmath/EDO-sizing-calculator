# Repository Guidelines

## Project Structure & Module Organization
- `index.html` — main app UI and layout.
- `js/` — calculation logic (`calculator.js`), shared constants (`coefficients.js`), and UI glue (`hybrid.js`).
- `css/` — global styles (`styles.css`) and calculator-specific styles (`calculator.css`).
- `images/` — static assets.
- `azure-pipelines.yml` — CI for static validation and artifact publishing.
- `DEPLOYMENT.md`, `nginx.conf` — deployment instructions and server config.
- `mockup*.html`, `test*.html` — mockups and manual test pages.

## Build, Test, and Development Commands
- Run locally (no build step): `python3 -m http.server 8080` then open `http://localhost:8080/index.html`.
- Quick HTML/JS sanity (mirrors CI intent): ensure HTML contains `<html>...</html>` and JS files are non‑empty and define `function|const|let`.
- CI: Azure Pipelines triggers on `main/master`, validates HTML/JS, and publishes artifacts. See `azure-pipelines.yml`.

## Coding Style & Naming Conventions
- Indentation: 4 spaces; UTF‑8 encoding.
- JavaScript: ES6+, camelCase for functions/vars, UPPER_SNAKE_CASE for shared constants; keep modules small and cohesive.
- Files: lowercase, concise names (e.g., `calculator.js`, `styles.css`).
- CSS: classes in kebab-case; prefer variables and reuse over inline styles.
- HTML: semantic structure; keep script/style tags external; avoid inline JS except minimal bootstrapping.

## Testing Guidelines
- Manual testing via `index.html`, `test.html`, and `test_mac_spoofing.html`:
  - Verify main flows: inputs → calculate → results, CSV/PDF export, and toggles (OCSP, Accounting, MAC spoofing).
  - Validate Russian labels/messages render correctly.
- If adding unit tests, place browser-runner specs as `js/*.spec.js` and keep them free of external network calls.

## Commit & Pull Request Guidelines
- Commits: imperative mood, concise subject (<72 chars), details in body as needed (e.g., “Refactor calculator with improved terminology”).
- Branches: `feat/…`, `fix/…`, `refactor/…` are preferred.
- PRs: clear description of intent, linked issues, before/after screenshots for UI changes, and notes on performance impact. Update `DEPLOYMENT.md` if CI/CD or hosting steps change.

## Security & Configuration Tips
- Project is a static site—no secrets in repo; prefer vendoring third‑party assets if offline use is required.
- Follow `nginx.conf` as a baseline; set correct static caching and UTF‑8 headers.
