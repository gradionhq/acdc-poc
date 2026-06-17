# Notes API — Guide Context (held constant across all AC/DC runs)

## What this project is

A minimal Express + TypeScript notes API. In-memory store, no database.
Entry points: `src/app.ts` (`createApp` factory), `src/server.ts` (listen).

## Conventions

- TypeScript strict mode. No `any`; prefer explicit types and narrow `unknown`.
- Routers are pure functions of their dependencies (`createNotesRouter(store)`).
- Validate all external input at the route boundary; never trust `req.body`,
  `req.query`, or `req.params`.
- Tests use Vitest + supertest under `test/`. Every behavior change needs a test.

## Testing strategy (test pyramid)

- **Default new tests to the cheapest layer that can prove the behavior**: a unit/
  component test (web, Vitest + Testing Library) or an integration test (server,
  Vitest + supertest). A behavior change normally gets a unit/component or
  integration test — not an e2e test.
- **e2e (Playwright) covers only core, critical user journeys end-to-end plus an
  API/health smoke** — create · view/list · edit · delete → trash → restore ·
  search/filter · basic tagging · core navigation across the app-shell views.
  Keep the e2e suite small and fast.
- **Do not add an e2e spec** unless it exercises a core journey not already
  covered. Prefer extending an existing core spec over adding a new file; push
  everything else (component states, validation, edge cases, styling, hooks)
  down to unit/component or integration tests.

## Security expectations

- Never build a filesystem path directly from client-supplied input.
- Enforce explicit limits on request/file size and validate content types.
- Check resource existence/ownership before acting on it.

## Quality bar

- The SonarQube quality gate must pass and no new issues of severity
  Medium or above may remain on changed code before a change is considered done.
- Maintain or increase test coverage on changed files.
