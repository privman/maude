# Maude – agent notes

Conventions and decisions that are useful to keep when working on this repo.

## Project

- **Maude** is a Chrome extension for injecting user scripts into pages based on URL matching. Side panel manages maudes (injection rules); background script matches URLs and injects (with optional delay and/or condition). Script and condition run in page context via Trusted Types.

## Code style

1. Prefer **async/await** over `.then()` for async flow. Use a **sync function** when there's no real async work (e.g. don't make a function `async` just to return a value).
2. Inline one-off helpers instead of tiny named functions used once.
3. Don't await **storage writes** when the UI already reflects the new state; fire the write and update UI immediately for responsiveness.
4. Use **ASCII apostrophe** (`'` U+0027) and **hyphen-minus** (`-` U+002D) only; no curly/smart apostrophe (U+2019) or en/em dash (U+2013, U+2014).
5. **Recent browsers only**: no legacy fallbacks (e.g. Trusted Types only, no blob fallback; no `escapeHtml` polyfill).
6. Prefer brevity over defensiveness: In past changes, you've included error handling and support for a broader range of inputs/states than required, leading to unnecessary complexity in the code. Make sure such complexity is really needed by examining upstream code and only handling the cases that could possibly occur.
7. Keep the code DRY and the style consistent with existing code, especially within the same file.
8. Order of functions should keep caller and callee close together (especially for local helpers that don't have many callers), with callees ordered above callers.
9. Where it is easily possible, wrap lines at 120, but do not spend a lot of tokens trying to do this where wrapping is complicated and prefer to keep lines a little longer where wrapping would make them really difficult to read.

## Extension behaviour

- **Script injection**: Use `trustedTypes.createPolicy('maude', { createScript: s => s })` and run user script / condition through it (script tag `textContent` and `eval` for condition). No fallback for older browsers.

## UI (panel)

- **Branding**: Use logo colors as CSS vars (teal, orange, peach).
- **Colors**: Define all colors once in **`:root`** and reuse with `var(--color-*)`. Semantic names (e.g. `--color-teal`, `--color-text-muted`).
- **Icons**: Use **Material Icons** (Google Fonts) for actions (edit, delete), not Unicode symbols.
- **Layout**: The side panel is full height; use fixed heights for script/condition areas with `resize: vertical` so the user can enlarge.
- **Form hierarchy**: Use a proper section heading (e.g. `<h3 class="section-heading">`) for groups like “Injection timing”. Separate sections with a **border-top** and optional **padding-top**. Indent **the heading** (e.g. `padding-left` on the heading), not the section content, so inputs keep full horizontal space.
