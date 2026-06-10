# Contributing to acdc-poc

Thank you for your interest in contributing! This document covers everything you need to open a successful pull request.

---

## Dev setup

1. Install **Node 22** (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm)).
2. Clone the repo and install all workspace dependencies:

```bash
git clone https://github.com/gradionai/acdc-poc.git
cd acdc-poc
npm ci
```

---

## Workspace commands

| Command                           | What it does                                   |
| --------------------------------- | ---------------------------------------------- |
| `npm run dev`                     | Vite dev server + Express backend (hot reload) |
| `npm run build`                   | Build SPA + compile server                     |
| `npm test`                        | Vitest — server + web unit/integration tests   |
| `npm run test:e2e`                | Playwright end-to-end tests (needs a build)    |
| `npm run lint`                    | ESLint + Prettier check                        |
| `npm run format`                  | Auto-format with Prettier                      |
| `npm run test --workspace server` | Server tests only                              |
| `npm run test --workspace web`    | Web tests only                                 |

---

## Branch naming

Use the pattern `<type>/<short-description>`, e.g.:

- `feat/edit-note`
- `fix/delete-returns-404`
- `chore/update-deps`

---

## Conventional Commits

All commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/). The `commitlint` GitHub Actions workflow rejects PRs whose commits do not conform.

```
<type>(<optional scope>): <short summary>

[optional body]
[optional footer(s)]
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`, `revert`.

---

## The green bar

A PR is ready to merge when **all** of the following are true:

- `npm test` (server + web Vitest suites) passes.
- `npm run test:e2e` (Playwright) passes.
- `npm run lint` is clean (ESLint + Prettier).
- SonarCloud quality gate is green.
- All reviewer findings are resolved or explicitly dismissed with a rationale.

---

## Proof-of-work expectation

Feature PRs **must** include:

1. A new or updated Playwright test in `e2e/tests/` that exercises the feature end-to-end.
2. A link to the recorded video from the CI artifact in the PR description.

The `agent_task` issue template formalises this requirement for agent-driven work.

---

## PR flow

1. Fork or create a branch off `main` (`git checkout -b feat/my-feature`).
2. Make your changes with Conventional Commit messages.
3. Run `npm run format && npm run lint && npm test` locally until green.
4. Open a PR against `main` using the PR template — fill in every checklist item.
5. Address review feedback and wait for CI + Sonar to pass.
6. A maintainer will merge once the green bar is met.

---

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Please read it before participating.
