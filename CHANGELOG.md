# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- OSS hygiene: Apache-2.0 LICENSE, NOTICE, README badges, CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant 2.1), SECURITY, SUPPORT, CHANGELOG.
- Tooling-as-policy: ESLint flat config (TypeScript + React hooks + Prettier compat), Prettier, EditorConfig, `.gitattributes`.
- Commitlint workflow enforcing Conventional Commits on all PRs to `main`.
- GitHub meta files: PR template, CODEOWNERS, Dependabot config (npm + GitHub Actions, weekly), issue templates (bug, feature, agent task), and `config.yml` disabling blank issues.

## [0.1.0] - 2026-06-09

### Added

- npm workspaces monorepo: `server/`, `web/`, `e2e/` workspaces with a root orchestrator `package.json`.
- Shared `tsconfig.base.json` with strict TypeScript options (ES2022, Bundler module resolution).
- **`server/`**: Express 4 REST API at `/api/notes` (CRUD + pagination), in-memory `NoteStore`, SPA serving with API-excluding history fallback, Vitest + supertest integration tests with V8 coverage.
- **`web/`**: React 18 + Vite 5 notes UI (list, create, delete), Vite dev proxy to Express, React Testing Library component tests with coverage.
- **`e2e/`**: Playwright happy-path test (create + delete a note) with video recording enabled.
- GitHub Actions CI pipeline: lint → typecheck → server coverage → web coverage → build → e2e (video artifact + PR comment) → SonarCloud quality gate.
- `sonar-project.properties` configured for the monorepo (dual lcov paths).

[Unreleased]: https://github.com/gradionhq/acdc-poc/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gradionhq/acdc-poc/releases/tag/v0.1.0
