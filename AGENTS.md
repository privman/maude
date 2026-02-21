# Maude – agent notes

Conventions and decisions that are useful to keep when working on this repo.

## Project

- **Maude** is a Chrome extension for injecting user scripts into pages based on URL rules. Popup manages rules; background script matches URLs and injects (with optional delay and/or condition). Script and condition run in page context via Trusted Types when available.

## Code style

- Prefer **async/await** over `.then()` for async flow. Use a **sync function** when there’s no real async work (e.g. don’t make a function `async` just to return a value).
- Inline one-off helpers instead of tiny named functions used once.
- Don’t await **storage writes** when the UI already reflects the new state; fire the write and update UI immediately for responsiveness.
- **Recent browsers only**: no legacy fallbacks (e.g. Trusted Types only, no blob fallback; no `escapeHtml` polyfill).

## Extension behaviour

- **Script injection**: Use `trustedTypes.createPolicy('maude', { createScript: s => s })` and run user script / condition through it (script tag `textContent` and `eval` for condition). No fallback for older browsers.

## UI (popup)

- **Branding**: Use logo colors as CSS vars (teal, orange, peach).
- **Colors**: Define all colors once in **`:root`** and reuse with `var(--color-*)`. Semantic names (e.g. `--color-teal`, `--color-text-muted`).
- **Icons**: Use **Material Icons** (Google Fonts) for actions (edit, delete), not Unicode symbols.
- **Layout**: Keep popup **compact** so the default form fits without scrolling. Use fixed heights for script/condition areas with `resize: vertical` so the user can enlarge.
- **Form hierarchy**: Use a proper section heading (e.g. `<h3 class="section-heading">`) for groups like “Injection timing”. Separate sections with a **border-top** and optional **padding-top**. Indent **the heading** (e.g. `padding-left` on the heading), not the section content, so inputs keep full horizontal space.
