# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Cloudflare Worker API (Hono) and server utilities such as `database.ts`, `file.ts`, and `stream-tarball.ts`.
- `web/`: React 19 + Rsbuild frontend (PWA-capable).
- Frontend modules live in `web/src/` and are grouped by role: `components/`, `actions/`, `store/`, `database/`, `utils/`.
- Static assets are in `web/public/`.
- Root-level operational config includes `wrangler.toml`, `wrangler.toml.example`, `pnpm-workspace.yaml`, and `tsconfig.json`.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: run Worker and web dev servers in parallel.
- `pnpm dev:cf`: run Cloudflare Worker locally with Wrangler.
- `pnpm dev:web`: run frontend dev server only.
- `pnpm build`: build production frontend assets.
- `pnpm deploy`: build first, then deploy Worker (`wrangler deploy --minify`).

## Coding Style & Naming Conventions
- TypeScript is configured with `strict: true`; keep API boundary types explicit.
- Use 2-space indentation and semicolons.
- Keep existing quote conventions by area: backend files in `src/` currently use double quotes; frontend files in `web/src/` use single quotes.
- React component files use PascalCase (example: `PasswordInput.tsx`).
- Utilities and hooks use camelCase (example: `debounce.ts`, `useConsistCallback.ts`).

## Testing Guidelines
- No dedicated automated test framework is currently configured.
- Minimum validation for every change:
1. Run `pnpm build` and ensure it succeeds.
2. Run `pnpm dev` and confirm both services start without runtime errors.
3. For API edits, verify at least one endpoint via Wrangler (example: `GET /api/list`).
- If adding tests, prefer `*.test.ts(x)` near related modules or `src/__tests__/` for Worker-focused coverage.

## Commit & Pull Request Guidelines
- Follow Conventional Commits seen in history: `feat:`, `fix:`, `refactor:`, `chore:`, `style:`, `docs:`.
- Keep commit subjects short and imperative (example: `fix: cannot paste file from clipboard`).
- PRs should include:
1. Scope and reason for change.
2. Config or infrastructure impact (`wrangler.toml`, D1, R2).
3. Validation steps and results.
4. Screenshots/GIFs for user-facing web changes.
