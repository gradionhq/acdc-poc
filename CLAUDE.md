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

## Security expectations

- Never build a filesystem path directly from client-supplied input.
- Enforce explicit limits on request/file size and validate content types.
- Check resource existence/ownership before acting on it.

## Quality bar

- The SonarQube quality gate must pass and no new issues of severity
  Medium or above may remain on changed code before a change is considered done.
- Maintain or increase test coverage on changed files.
