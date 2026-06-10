# acdc-poc

A professional full-stack OSS template: React + Vite notes UI on an Express/TypeScript API, Playwright end-to-end proof, and full Apache-2.0 OSS hygiene — ready to fork as an agent-driven development baseline.

[![CI](https://github.com/gradionai/acdc-poc/actions/workflows/ci.yml/badge.svg)](https://github.com/gradionai/acdc-poc/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=gradionai_acdc-poc&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=gradionai_acdc-poc)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

---

## Quickstart

Requires **Node 22** and **npm 10**.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite (default: http://localhost:5173). The dev server proxies `/api` requests to the Express backend, which starts automatically on port 3000.

---

## Scripts

| Command            | Description                                                               |
| ------------------ | ------------------------------------------------------------------------- |
| `npm run dev`      | Start the Vite dev server (proxies `/api` to Express on :3000)            |
| `npm run build`    | Build the SPA (`web/dist`) and compile the server (`server/dist`)         |
| `npm test`         | Run Vitest suites for `server` and `web`                                  |
| `npm run test:e2e` | Run Playwright end-to-end tests (requires a build: `npm run build` first) |
| `npm run lint`     | ESLint + Prettier check (must be clean before merging)                    |
| `npm run format`   | Auto-format all files with Prettier                                       |

---

## Architecture

```
acdc-poc/
  server/   Express 4 API — routes live under /api/notes
  web/      React 18 + Vite 5 SPA — dev proxy, prod served by Express
  e2e/      Playwright happy-path tests — records video proof-of-work
```

**Dev flow:** `npm run dev` boots Vite, which proxies `/api/*` to Express (`tsx server/src/server.ts`).

**Prod flow:** `npm run build` compiles both workspaces; `npm run start --workspace server` starts Express, which serves `web/dist` as static files with an API-excluding history fallback for client-side routing.

**CI:** GitHub Actions runs lint → server coverage → web coverage → build (typechecks both workspaces) → Playwright e2e (video artifact + PR comment) → SonarCloud quality gate. A separate workflow enforces Conventional Commits.

**E2e proof-of-work:** Every feature PR must include a passing Playwright test and link its recorded video from the CI artifact.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commits must follow [Conventional Commits](https://www.conventionalcommits.org/); the `commitlint` workflow enforces this on every PR.

---

## License

Copyright 2026 Gradion. Licensed under the [Apache License, Version 2.0](LICENSE).
