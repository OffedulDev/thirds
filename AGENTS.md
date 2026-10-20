# Repository Guidelines

## Project Structure & Module Organization

This repository is the school-election lower-thirds application. Keep the implementation small and easy to host: the planned layout is `server/` for the lightweight HTTP and live-update service, `public/` for the admin, control deck, and OBS overlay pages, and `data/` for persisted workflow records. Keep overlay styles and scripts separate from administration code where practical. Do not add a framework or build pipeline unless the existing implementation makes it necessary.

## Build, Test, and Development Commands

No application or command scripts exist yet. When scaffolding, provide a single documented local start command (for example, `npm start`) and a test command (for example, `npm test`) in `package.json`. The app should run as one small service and be deployable to a basic Node-compatible host. Keep the OBS overlay available at a stable URL that can be entered as a browser source.

## Coding Style & Naming Conventions

Prefer plain JavaScript, HTML, and CSS with minimal dependencies. Use two spaces for indentation, `camelCase` for JavaScript variables and functions, and descriptive kebab-case for CSS classes. Keep user-facing controls labeled clearly and keep the overlay visually minimal: centered logo, list name and motto, plus a readable candidate ticker. Avoid decorative effects that reduce legibility on stream.

## Testing Guidelines

There is no test framework or coverage requirement yet. Add focused tests when behavior is implemented, especially workflow create/edit/delete, persistence, pause/resume, and manual advancement. Name tests after the behavior they cover and document the command used to run them. Check the overlay at typical OBS browser-source dimensions and verify it updates while the control deck is open.

## Commit & Pull Request Guidelines

No Git history is available here to establish a commit convention. Use short imperative commit subjects, such as `Add workflow editor` or `Pause overlay rotation`. Pull requests should explain the user-visible change, list manual or automated checks performed, and include screenshots for visible layout changes.

## Configuration & Live-Stream Safety

Keep election content and host-specific settings out of source code. Validate workflow and candidate fields before saving, and make control actions explicit so accidental clicks do not unexpectedly alter the on-air display. Document any required environment variables and provide safe defaults for local development.
