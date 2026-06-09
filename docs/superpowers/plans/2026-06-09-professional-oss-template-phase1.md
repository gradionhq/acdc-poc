# Professional OSS Template — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve `gradionai/acdc-poc` into a professional, minimal **full-stack** OSS template: a React+Vite notes UI on the existing Express/TS API, a Playwright e2e with video proof, full Apache-2.0 OSS hygiene, and a GitHub Project board with agent-ready issues + automation.

**Architecture:** Light **npm-workspaces monorepo** — `server/` (Express API under `/api`), `web/` (React+Vite SPA), `e2e/` (Playwright). Dev: Vite proxies `/api`→Express. Prod/CI: Express serves the built SPA (`web/dist`) with an `/api`-excluding history fallback; Playwright drives the real app and records video.

**Tech Stack:** Node 22, TypeScript, npm workspaces, Express 4, React 18 + Vite 5, Vitest + supertest + React Testing Library, Playwright, ESLint + Prettier + commitlint, GitHub Actions, SonarQube Cloud, GitHub Projects v2.

**Spec:** `experiment-control:docs/superpowers/specs/2026-06-09-professional-oss-template-phase1-design.md`

## Working branch & conventions
- Implement on a branch off `main`: `git checkout -b phase1/professional-template main`. Open one PR to `main` at the end (or merge per the finishing-a-development-branch skill). Commit with **Conventional Commits**.
- **Operator inputs needed before Chunk 4/5:** confirm copyright legal name (default "Gradion"); for Chunk 5, `gh auth refresh -s project,read:project` and a `PROJECTS_TOKEN` PAT secret (see spec Prereq #1 + fallback).
- The current API routes live at `/notes`; this plan moves them to `/api/notes`.

## File Structure (target)

| Path | Responsibility |
|------|----------------|
| `package.json` (root) | workspaces `["server","web","e2e"]`; orchestration scripts; devDeps for lint/format/commitlint |
| `tsconfig.base.json` | shared strict TS options; each workspace extends it |
| `server/package.json` `server/tsconfig.json` | server workspace manifest/config |
| `server/src/{store,notes,app,server}.ts` | moved from `src/`; routes under `/api`; serves SPA in prod |
| `server/test/{store,notes}.test.ts` | moved from `test/`; hit `/api/notes` |
| `server/vitest.config.ts` | emits coverage to `server/coverage/lcov.info` |
| `web/package.json` `web/tsconfig.json` `web/vite.config.ts` `web/index.html` | SPA workspace |
| `web/src/{main.tsx,App.tsx,api.ts,components/*}` | minimal notes UI + API client |
| `web/src/App.test.tsx` `web/vitest.config.ts` | component test + coverage to `web/coverage/lcov.info` |
| `e2e/package.json` `e2e/playwright.config.ts` `e2e/tests/notes.spec.ts` | Playwright happy-path + video |
| `.github/workflows/ci.yml` | install → lint/typecheck → server cov → web cov → build → e2e (artifacts + PR comment) → Sonar |
| `.github/workflows/add-to-project.yml` | auto-add issues/PRs to the board (Chunk 5) |
| `.github/ISSUE_TEMPLATE/{bug_report,feature_request,agent_task}.yml` `config.yml` | issue templates |
| `.github/PULL_REQUEST_TEMPLATE.md` `.github/CODEOWNERS` `.github/dependabot.yml` | PR template, ownership, deps |
| `eslint.config.js` `.prettierrc` `commitlint.config.js` `.editorconfig` `.gitattributes` | tooling-as-policy |
| `LICENSE` `NOTICE` `README.md` `CONTRIBUTING.md` `CODE_OF_CONDUCT.md` `SECURITY.md` `SUPPORT.md` `CHANGELOG.md` | OSS hygiene |
| `sonar-project.properties` | monorepo coverage paths |

---

## Chunk 1: Monorepo restructure (server workspace)

Goal: move the existing API into a `server/` workspace under a root workspaces manifest, re-point routes to `/api`, keep tests + Sonar + CI green. No web/e2e yet.

### Task 1.1: Create the branch and root workspace manifest

**Files:** Create `tsconfig.base.json`; replace root `package.json`.

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull
git checkout -b phase1/professional-template
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

> Note: we deliberately do NOT add `noUncheckedIndexedAccess` — it would make Express's `req.params.id` resolve to `string | undefined` and break the existing `store.get/update/delete(req.params.id)` call sites. The spec only asks for "shared strict options"; `strict: true` is sufficient.

- [ ] **Step 3: Replace root `package.json`** (workspace orchestrator; no app deps at root)

```json
{
  "name": "acdc-poc",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "workspaces": ["server", "web", "e2e"],
  "scripts": {
    "dev": "npm run dev --workspace web",
    "build": "npm run build --workspace web && npm run build --workspace server",
    "test": "npm run test --workspace server && npm run test --workspace web",
    "test:cov": "npm run test:cov --workspace server && npm run test:cov --workspace web",
    "test:e2e": "npm run test --workspace e2e",
    "start:prod": "npm run build && npm run start --workspace server",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.5.0"
  }
}
```

> `dev` runs only the web workspace; `web`'s own `dev` script will concurrently boot the server (Task 2.2). `start:prod` is the single definition reused by Playwright's `webServer` (Chunk 3).

- [ ] **Step 4: Commit**

```bash
git add tsconfig.base.json package.json
git commit -m "chore: add root workspace manifest and shared tsconfig"
```

### Task 1.2: Move the API into `server/` and re-point routes to `/api`

**Files:** Move `src/*`→`server/src/*`, `test/*`→`server/test/*`; create `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`; modify `server/src/app.ts`; modify both moved test files.

- [ ] **Step 1: Move files with git**

```bash
mkdir -p server
git mv src server/src
git mv test server/test
# Remove the now-stale root configs (they point at the moved src/test paths and
# would fail on a bare `tsc`/`vitest`; each workspace owns its own config).
git rm tsconfig.json vitest.config.ts
rm -rf dist coverage   # orphaned local build artifacts, if any
```

- [ ] **Step 2: Create `server/package.json`**

```json
{
  "name": "@acdc/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/src/server.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/server.js",
    "dev": "tsx src/server.ts",
    "test": "vitest run",
    "test:cov": "vitest run --coverage"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.5.0",
    "@types/supertest": "^6.0.2",
    "@vitest/coverage-v8": "^2.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.16.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create `server/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": ".", "types": ["node"] },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `server/vitest.config.ts`** (coverage into `server/coverage/`)

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
    },
  },
});
```

- [ ] **Step 5: Re-point routes to `/api` in `server/src/app.ts`**

Change the mount from `/notes` to `/api/notes`:

```ts
import express, { type Express } from 'express';
import { NoteStore } from './store.js';
import { createNotesRouter } from './notes.js';

export function createApp(store: NoteStore = new NoteStore()): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/notes', createNotesRouter(store));
  return app;
}
```

- [ ] **Step 6: Update the moved tests to hit `/api/notes`**

In `server/test/notes.test.ts`, replace every request path `'/notes'` → `'/api/notes'` and `/notes/${id}` → `/api/notes/${id}` (the `store.test.ts` unit tests are unaffected). Do not change assertions otherwise.

- [ ] **Step 7: Install and verify**

```bash
npm install
npm run test --workspace server
```
Expected: all server tests pass against `/api/notes`.

- [ ] **Step 8: Verify build + run**

```bash
npm run build --workspace server
PORT=3010 node server/dist/src/server.js & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
curl -fsS -X POST http://localhost:3010/api/notes -H 'content-type: application/json' -d '{"title":"t","body":"b"}'
curl -fsS 'http://localhost:3010/api/notes'
```
Expected: 201 JSON note, then JSON array. No `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move API into server workspace under /api"
```

### Task 1.3: Update SonarQube + CI for the server workspace

**Files:** Modify `sonar-project.properties`, `.github/workflows/ci.yml`.

- [ ] **Step 1: Update `sonar-project.properties`** (server-only for now; web added in Chunk 2)

```properties
sonar.organization=gradion
sonar.projectKey=gradionai_acdc-poc
sonar.sources=server/src
sonar.tests=server/test
sonar.javascript.lcov.reportPaths=server/coverage/lcov.info
sonar.exclusions=**/dist/**,e2e/**,**/*.config.*
```

- [ ] **Step 2: Update `.github/workflows/ci.yml`** to use workspaces + coverage path

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-test-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run test:cov --workspace server
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@v4
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add sonar-project.properties .github/workflows/ci.yml
git commit -m "ci: point Sonar + CI at the server workspace"
```

---

## Chunk 2: Web SPA + serving

Goal: a minimal React+Vite notes UI calling `/api/notes`, with a Vite dev proxy, Express serving the built SPA in prod, and a component test. CI builds + tests web.

### Task 2.1: Scaffold the `web/` workspace

**Files:** Create `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/vite-env.d.ts`.

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "@acdc/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k -n server,web \"npm:dev --workspace @acdc/server\" \"vite\"",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:cov": "vitest run --coverage"
  },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@vitest/coverage-v8": "^2.0.0",
    "concurrently": "^9.0.0",
    "jsdom": "^25.0.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

> Note: the `dev` script's `npm:dev --workspace @acdc/server` runs the server's `tsx` watcher; `vite` serves the SPA with a proxy (Step 3). Root `npm run dev` → `web` dev → both.

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `web/vite.config.ts`** (dev proxy + jsdom test env)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/setupTests.ts', 'src/vite-env.d.ts'],
    },
  },
});
```

> The dev proxy targets the server's default port `3000` (Task 1.2 `server.ts` uses `process.env.PORT ?? 3000`). Keep these in sync.

- [ ] **Step 4: Create `web/index.html`, `web/src/main.tsx`, `web/src/setupTests.ts`, `web/src/vite-env.d.ts`**

`web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Notes</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```
`web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```
`web/src/setupTests.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```
`web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/tsconfig.json web/vite.config.ts web/index.html web/src
rm -f web/src/.gitkeep 2>/dev/null || true
git commit -m "feat(web): scaffold React+Vite workspace with dev proxy"
```

### Task 2.2: API client + notes UI (TDD on the component)

**Files:** Create `web/src/api.ts`, `web/src/App.tsx`, `web/src/App.test.tsx`.

- [ ] **Step 1: Write the failing component test** `web/src/App.test.tsx`

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

function mockFetchSequence() {
  const notes: Array<{ id: string; title: string; body: string }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const b = JSON.parse(String(init.body));
      const n = { id: String(notes.length + 1), title: b.title, body: b.body };
      notes.push(n);
      return new Response(JSON.stringify(n), { status: 201 });
    }
    return new Response(JSON.stringify(notes), {
      status: 200, headers: { 'X-Total-Count': String(notes.length) },
    });
  }));
}

describe('App', () => {
  beforeEach(() => mockFetchSequence());
  it('creates a note and shows it in the list', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/title/i), 'My note');
    await userEvent.type(screen.getByLabelText(/body/i), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    await waitFor(() => expect(screen.getByText('My note')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test --workspace web`
Expected: FAIL — cannot find `./App`.

- [ ] **Step 3: Implement `web/src/api.ts`**

```ts
export interface Note { id: string; title: string; body: string }

const base = '/api/notes';

export async function listNotes(): Promise<Note[]> {
  const res = await fetch(base);
  if (!res.ok) throw new Error('failed to load notes');
  return res.json();
}

export async function createNote(input: { title: string; body: string }): Promise<Note> {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('failed to create note');
  return res.json();
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('failed to delete note');
}
```

- [ ] **Step 4: Implement `web/src/App.tsx`** (minimal CRUD UI)

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { createNote, deleteNote, listNotes, type Note } from './api';

export function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try { setNotes(await listNotes()); } catch (e) { setError(String(e)); }
  }
  useEffect(() => { void refresh(); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      await createNote({ title, body });
      setTitle(''); setBody(''); setError(null);
      await refresh();
    } catch (e) { setError(String(e)); }
  }

  return (
    <main>
      <h1>Notes</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={onSubmit}>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Body<textarea value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <button type="submit">Add note</button>
      </form>
      <ul>
        {notes.map((n) => (
          <li key={n.id}>
            <strong>{n.title}</strong>: {n.body}
            <button onClick={async () => { await deleteNote(n.id); await refresh(); }}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test --workspace web`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/api.ts web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): notes CRUD UI with API client"
```

### Task 2.3: Express serves the built SPA (route precedence contract)

**Files:** Modify `server/src/app.ts`, `server/package.json` (add path dep is built-in), and add a server test.

- [ ] **Step 1: Write a failing test** `server/test/spa.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('SPA serving', () => {
  it('returns 404 JSON for unknown /api routes (not the SPA fallback)', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test --workspace server`
Expected: FAIL (currently unknown `/api/*` falls through to Express default HTML 404, not JSON).

- [ ] **Step 3: Implement SPA serving + `/api` 404 in `server/src/app.ts`**

```ts
import express, { type Express, type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { NoteStore } from './store.js';
import { createNotesRouter } from './notes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/src/app.js → ../../../web/dist  ;  src/app.ts (tsx dev) → ../../web/dist
const webDist = fs.existsSync(path.join(here, '../../../web/dist'))
  ? path.join(here, '../../../web/dist')
  : path.join(here, '../../web/dist');

export function createApp(store: NoteStore = new NoteStore()): Express {
  const app = express();
  app.use(express.json());

  // API first.
  app.use('/api/notes', createNotesRouter(store));
  // Any other /api/* is a JSON 404 — never the SPA fallback.
  app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: 'not found' }));

  // Static SPA + history fallback (only when a build exists).
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(webDist, 'index.html')));
  }
  return app;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test --workspace server`
Expected: PASS (all server tests).

- [ ] **Step 5: Verify the full prod path manually**

```bash
npm run build
PORT=3000 npm run start --workspace server & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
curl -fsS http://localhost:3000/ | grep -q '<div id="root">' && echo "SPA served"
curl -fsS http://localhost:3000/api/notes && echo " API served"
```
Expected: "SPA served" and a notes JSON array.

- [ ] **Step 6: Commit**

```bash
git add server/src/app.ts server/test/spa.test.ts
git commit -m "feat(server): serve built SPA with /api-excluding history fallback"
```

### Task 2.4: Add web to Sonar + CI

**Files:** Modify `sonar-project.properties`, `.github/workflows/ci.yml`.

- [ ] **Step 1: Update `sonar-project.properties`**

```properties
sonar.organization=gradion
sonar.projectKey=gradionai_acdc-poc
sonar.sources=server/src,web/src
sonar.tests=server/test,web/src
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx
sonar.javascript.lcov.reportPaths=server/coverage/lcov.info,web/coverage/lcov.info
sonar.exclusions=**/dist/**,e2e/**,**/*.config.*,web/src/main.tsx
```

- [ ] **Step 2: Add web steps to `.github/workflows/ci.yml`.** Keep the *existing* `npm run test:cov --workspace server` step (don't duplicate it) and **insert** the web-cov + build steps right after it, so the test→build→Sonar order becomes:

```yaml
      - run: npm run test:cov --workspace server   # (existing — do not re-add)
      - run: npm run test:cov --workspace web      # insert
      - run: npm run build                          # insert
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@v4
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add sonar-project.properties .github/workflows/ci.yml
git commit -m "ci: add web workspace coverage + build to pipeline"
```

---

## Chunk 3: Playwright e2e + proof-of-work

Goal: a Playwright happy-path e2e that drives the real app (Express serving the SPA), records video, and runs in CI with artifacts + a PR comment.

### Task 3.1: Scaffold the `e2e/` workspace

**Files:** Create `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/.gitignore`.

- [ ] **Step 1: Create `e2e/package.json`**

```json
{
  "name": "@acdc/e2e",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "report": "playwright show-report"
  },
  "devDependencies": { "@playwright/test": "^1.47.0" }
}
```

- [ ] **Step 2: Create `e2e/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    video: 'on',
    trace: 'on',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // start:prod (root) builds the SPA then boots Express serving web/dist
    command: 'npm run start:prod --prefix ..',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Create `e2e/.gitignore`**

```gitignore
test-results/
playwright-report/
```

- [ ] **Step 4: Commit**

```bash
git add e2e/package.json e2e/playwright.config.ts e2e/.gitignore
git commit -m "test(e2e): scaffold Playwright workspace (video on)"
```

### Task 3.2: Happy-path e2e

**Files:** Create `e2e/tests/notes.spec.ts`.

- [ ] **Step 1: Write the e2e** `e2e/tests/notes.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('create then delete a note', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

  await page.getByLabel(/title/i).fill('E2E note');
  await page.getByLabel(/body/i).fill('proof of work');
  await page.getByRole('button', { name: /add note/i }).click();

  const item = page.getByRole('listitem').filter({ hasText: 'E2E note' });
  await expect(item).toBeVisible();

  await item.getByRole('button', { name: /delete/i }).click();
  await expect(item).toHaveCount(0);
});
```

- [ ] **Step 2: Install browsers and run**

```bash
npm install
npm exec --workspace e2e -- playwright install --with-deps chromium
npm run test:e2e
```
Expected: 1 passed; a video recorded under `e2e/test-results/`; HTML report under `e2e/playwright-report/`.

- [ ] **Step 3: Confirm a video was produced**

```bash
find e2e/test-results -name '*.webm' | head -1
```
Expected: a `.webm` path prints (the proof-of-work video).

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/notes.spec.ts
git commit -m "test(e2e): notes create/delete happy path"
```

### Task 3.3: Wire e2e into CI with artifacts + PR comment

**Files:** Modify `.github/workflows/ci.yml`.

- [ ] **Step 1: Add a top-level `permissions` block to `.github/workflows/ci.yml`** (so the PR-comment step can post; default `GITHUB_TOKEN` is read-only otherwise). Directly under `on:`:

```yaml
permissions:
  contents: read
  pull-requests: write
```

- [ ] **Step 2: Add the e2e job steps** (after `npm run build`, before Sonar)

```yaml
      - name: Install Playwright browser
        run: npm exec --workspace e2e -- playwright install --with-deps chromium
      - name: Run e2e
        run: npm run test:e2e
      - name: Upload e2e artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            e2e/playwright-report
            e2e/test-results
          retention-days: 14
      - name: Comment proof-of-work link on PR
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const run = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
            await github.rest.issues.createComment({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `🎥 **Proof-of-work**: Playwright report + video artifact for this run → ${run} (see the \`playwright-report\` artifact).`,
            });
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run Playwright e2e, upload video artifacts, comment on PR"
```

---

## Chunk 4: OSS hygiene + tooling-as-policy

Goal: the professional file set + lint/format/commit enforcement. **Confirm the copyright legal name (default "Gradion") before this chunk.**

### Task 4.1: License, NOTICE, and the core docs

**Files:** Create `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `CHANGELOG.md`.

- [ ] **Step 1: `LICENSE`** — the full **Apache License 2.0** text (verbatim from https://www.apache.org/licenses/LICENSE-2.0.txt). Do not hand-edit the body.

- [ ] **Step 2: `NOTICE`**
```
acdc-poc
Copyright 2026 Gradion

This product includes software developed at Gradion.
```

- [ ] **Step 3: `README.md`** — required sections: project one-liner; badges (CI status, SonarCloud quality gate, license — wire to the real URLs); **Quickstart** (`npm ci`, `npm run dev`, open the Vite URL); **Scripts** table (dev/build/test/test:e2e/lint); **Architecture** (server/web/e2e workspaces, `/api`, SPA serving, Playwright proof-of-work); **Contributing** link; **License** (Apache-2.0).

- [ ] **Step 4: `CONTRIBUTING.md`** — dev setup (Node 22, `npm ci`), workspace commands, branch naming, **Conventional Commits** (enforced), the **green bar** (server+web tests + e2e pass, Sonar gate green, all reviewer findings resolved), the **proof-of-work expectation** (feature PRs include a passing e2e + its recorded video link), and the PR flow.

- [ ] **Step 5: `CODE_OF_CONDUCT.md`** — Contributor Covenant 2.1 (verbatim), contact = a Gradion email/placeholder.

- [ ] **Step 6: `SECURITY.md`** — private reporting channel (security@gradion… placeholder), supported versions table, response expectations.

- [ ] **Step 7: `SUPPORT.md`** — where to ask (Issues/Discussions), what's in scope.

- [ ] **Step 8: `CHANGELOG.md`** — Keep a Changelog format; an `Unreleased` section + an initial `0.1.0` entry summarizing the full-stack template.

- [ ] **Step 9: Commit**

```bash
git add LICENSE NOTICE README.md CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md SUPPORT.md CHANGELOG.md
git commit -m "docs: add Apache-2.0 license and OSS hygiene docs"
```

### Task 4.2: ESLint + Prettier + EditorConfig

**Files:** Create `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `.gitattributes`; add ESLint deps to root `package.json` devDeps.

- [ ] **Step 1: Add deps** to root `devDependencies`: `typescript-eslint@^8`, `eslint-plugin-react-hooks@^5`, `eslint-config-prettier@^9`, `@eslint/js@^9`, `globals@^15`, then `npm install`. (`eslint-config-prettier` disables ESLint's formatting rules so `eslint` and `prettier --check` don't fight.)

- [ ] **Step 2: `eslint.config.js`** (flat config; TS + React hooks; ignores build/artifacts)

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', 'e2e/test-results/**', 'e2e/playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Flat-config preset for react-hooks (v5): `recommended-latest` is the flat entry.
  { files: ['web/**/*.{ts,tsx}'], ...reactHooks.configs['recommended-latest'],
    languageOptions: { globals: globals.browser } },
  { files: ['server/**/*.ts', 'e2e/**/*.ts'], languageOptions: { globals: globals.node } },
  // Must be LAST: turn off ESLint formatting rules that conflict with Prettier.
  prettier,
);
```
> If `reactHooks.configs['recommended-latest']` is unavailable in the installed
> version, fall back to `reactHooks.configs.flat.recommended`. Verify with a quick
> `npm run lint` after writing the config.

- [ ] **Step 3: `.prettierrc`**
```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }
```
`.prettierignore`:
```
**/dist
**/coverage
e2e/test-results
e2e/playwright-report
package-lock.json
LICENSE
```

- [ ] **Step 4: `.editorconfig`**
```ini
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
insert_final_newline = true
trim_trailing_whitespace = true
```
`.gitattributes`:
```
* text=auto eol=lf
*.webm binary
```

- [ ] **Step 5: Run lint/format and fix**

```bash
npm run format
npm run lint
```
Expected: `eslint .` and `prettier --check .` both pass (run `format` first to normalize).

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js .prettierrc .prettierignore .editorconfig .gitattributes package.json package-lock.json
git commit -m "chore: add ESLint, Prettier, EditorConfig"
```

### Task 4.3: Commit linting (Conventional Commits)

**Files:** Create `commitlint.config.js`, `.github/workflows/commitlint.yml`.

- [ ] **Step 1: `commitlint.config.js`**
```js
export default { extends: ['@commitlint/config-conventional'] };
```

- [ ] **Step 2: `.github/workflows/commitlint.yml`** (lint PR commits)
```yaml
name: Commitlint
on: { pull_request: { branches: [main] } }
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx commitlint --from origin/main --to HEAD --verbose
```

- [ ] **Step 3: Commit**
```bash
git add commitlint.config.js .github/workflows/commitlint.yml
git commit -m "ci: enforce Conventional Commits via commitlint"
```

### Task 4.4: GitHub meta files (templates, CODEOWNERS, dependabot)

**Files:** Create `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/{bug_report,feature_request,agent_task}.yml`, `.github/ISSUE_TEMPLATE/config.yml`.

- [ ] **Step 1: `.github/PULL_REQUEST_TEMPLATE.md`**
```markdown
## Summary
<!-- what & why -->

Closes #

## Checklist
- [ ] Linked issue above
- [ ] `npm test` (server + web) passes
- [ ] `npm run test:e2e` passes; **proof-of-work video** linked from the CI artifact
- [ ] SonarQube quality gate green; all reviewer findings resolved or explicitly dismissed
- [ ] Conventional Commit messages
```

- [ ] **Step 2: `.github/CODEOWNERS`**
```
* @gradionai/maintainers
```
> Adjust to the real team/handle; placeholder is fine for the template.

- [ ] **Step 3: `.github/dependabot.yml`**
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: "/"
    schedule: { interval: weekly }
```

- [ ] **Step 4: `.github/ISSUE_TEMPLATE/agent_task.yml`** (the agent-ready spec)
```yaml
name: Agent task
description: A fully-specified task an autonomous agent can implement unsupervised.
labels: ["agent-ready"]
body:
  - type: textarea
    id: context
    attributes: { label: Context, description: Background and the user-facing goal. }
    validations: { required: true }
  - type: textarea
    id: acceptance
    attributes: { label: Acceptance criteria, description: Testable checklist of done. }
    validations: { required: true }
  - type: textarea
    id: scope
    attributes: { label: Scope boundaries, description: What must NOT change. }
    validations: { required: true }
  - type: dropdown
    id: area
    attributes: { label: Area, options: [web, server, e2e, multiple] }
    validations: { required: true }
  - type: checkboxes
    id: proof
    attributes:
      label: Proof of work
      description: A Playwright e2e covering this feature must pass, with its recorded video linked from the PR.
      options:
        - label: I confirm a passing Playwright e2e + recorded video will be linked on the PR.
          required: true
```

- [ ] **Step 5: `bug_report.yml` and `feature_request.yml`** — standard GitHub form templates (`labels: [type:bug]` / `[type:feature]`), and `config.yml` with `blank_issues_enabled: false` and a Discussions contact link.

- [ ] **Step 6: Commit**
```bash
git add .github/PULL_REQUEST_TEMPLATE.md .github/CODEOWNERS .github/dependabot.yml .github/ISSUE_TEMPLATE
git commit -m "chore(github): add PR/issue templates, CODEOWNERS, dependabot"
```

---

## Chunk 5: GitHub Project board + automation (operator + build)

Goal: a live work queue. **[OPERATOR]** steps need `gh` with `project` scope + a `PROJECTS_TOKEN` PAT (see spec Prereq #1; fallback = built-in workflows + manual add). **[BUILD]** = the workflow file + labels-as-code.

### Task 5.1: Labels as code [BUILD+OPERATOR]

**Files:** Create `.github/labels.json`.

- [ ] **Step 1: `.github/labels.json`** — define: `agent-ready`, `needs-human`, `blocked`, `type:feature`, `type:bug`, `type:chore`, `type:docs`, `area:web`, `area:server`, `area:e2e`, `priority:high`, `priority:med`, `priority:low` (each `{name,color,description}`).

- [ ] **Step 2 [OPERATOR]: Apply labels** via `gh`, looping over `labels.json` (requires `jq`; run from the repo root so the relative path resolves, after Step 3 has committed the file):
```bash
jq -c '.[]' .github/labels.json | while read -r l; do
  gh label create "$(jq -r .name <<<"$l")" \
    --color "$(jq -r .color <<<"$l")" \
    --description "$(jq -r .description <<<"$l")" --force
done
```
Expected: `gh label list` shows the full taxonomy.

- [ ] **Step 3: Commit** `git add .github/labels.json && git commit -m "chore(github): define label taxonomy as code"`

### Task 5.2: Create the Project board [OPERATOR]

- [ ] **Step 1:** `gh auth refresh -s project,read:project` (grant Projects scope).
- [ ] **Step 2:** Create a Project (v2) named "acdc-poc Delivery" with a **Status** field (Todo/In Progress/In Review/Done) and custom fields **Priority** + **Agent**:
```bash
gh project create --owner gradionai --title "acdc-poc Delivery"
# note the project number; add fields via `gh project field-create` as needed
```
- [ ] **Step 3:** In the board UI, enable **built-in workflows**: item added → Todo; PR/issue closed or merged → Done; PR linked & opened → In Review.
- [ ] **Step 4:** Record the project number/URL in `CHANGELOG.md` Unreleased notes (operator note only; no code).

### Task 5.3: Auto-add automation workflow [BUILD] + token [OPERATOR]

**Files:** Create `.github/workflows/add-to-project.yml`.

- [ ] **Step 1 [OPERATOR]:** Create a PAT with `project` scope and add it as repo secret **`PROJECTS_TOKEN`**.
- [ ] **Step 2 [BUILD]: `.github/workflows/add-to-project.yml`**
```yaml
name: Add to project
on:
  issues: { types: [opened, reopened] }
  pull_request: { types: [opened, reopened] }
jobs:
  add:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v2
        with:
          project-url: https://github.com/orgs/gradionai/projects/<NUMBER>
          github-token: ${{ secrets.PROJECTS_TOKEN }}
```
> Replace `<NUMBER>` from Task 5.2 — **this workflow must not be merged with an unreplaced `<NUMBER>`** (it fails at runtime, not commit time), so Task 5.2 (which produces the number) must complete first. **Fallback:** if no PAT is permitted, skip this workflow entirely; rely on the board's built-in "auto-add" workflow instead.

- [ ] **Step 3: Commit** `git add .github/workflows/add-to-project.yml && git commit -m "ci: auto-add issues/PRs to the project board"`

### Task 5.4: Seed the agent backlog [OPERATOR]

- [ ] **Step 1:** Create ~6 issues using the `agent_task` template, each with acceptance criteria + scope + proof-of-work, labeled `agent-ready` + `area:*` + `type:feature`:
  1. Edit a note (PUT `/api/notes/:id` + edit UI)
  2. Search/filter notes (query param + search box)
  3. Tags on notes
  4. Attachments upload/download UI
  5. Pin/favorite a note
  6. Pagination **controls** (next/prev) on the list
```bash
gh issue create --title "feat: edit a note" --label agent-ready,type:feature,area:web,area:server --body-file <spec>
# …repeat
```
- [ ] **Step 2:** Confirm the issues land on the board (Todo) via the automation.

### Task 5.5: Repo cleanup + tag [OPERATOR/BUILD]

- [ ] **Step 1 [OPERATOR]: Clean up prior PoC churn** (spec Prereq #3). **First verify the targets** — `gh pr list --state open` and `git branch -a` — since the PR numbers and the dependabot branch name below are hardcoded and may have changed:
```bash
for n in 5 6 7 8; do gh pr close $n --comment "Closing AC/DC experiment PR (superseded by Phase 1 template)."; done
for b in run/A1 run/A2 run/B1 run/B2; do git push origin --delete "$b" 2>/dev/null; git branch -D "$b" 2>/dev/null; done
for r in pr1 pr2 pr3 pr4 pr5 pr6 pr7 pr8; do git branch -D "$r" 2>/dev/null; done
git push origin --delete dependabot/npm_and_yarn/multi-e50eacec07 2>/dev/null || true
```
Keep `experiment-control`, `baseline`, `task-b-bugged`.

- [ ] **Step 2 [BUILD]: Open the Phase 1 PR** and ensure full CI is green (server+web tests, build, e2e with video artifact, Sonar gate, commitlint).

- [ ] **Step 3 [OPERATOR]: After merge to `main`, tag**:
```bash
git checkout main && git pull
git tag v0.1.0 && git push origin v0.1.0
```

---

## Done criteria
- Fresh clone: `npm ci && npm run dev` serves a working notes UI on the API; `npm test` + `npm run test:e2e` pass and produce a video.
- Repo presents professionally: all hygiene files, README badges, green CI, passing Sonar gate, Conventional Commits enforced.
- GitHub board live with labels, templates, ~6 seeded `agent-ready` issues, and auto-add automation (or the documented fallback).
- `main` cleaned of PoC churn; tagged `v0.1.0`. Phase 2 (autonomous agents + reviewer comparison) can begin on this foundation.
