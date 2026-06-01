# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Cloudflare Worker API built with Hono. Server utilities include `database.ts`, `file.ts`, and `stream-tarball.ts`.
- `web/`: React 19 frontend built with Rsbuild. Main code lives in `web/src/`, grouped into `components/`, `actions/`, `store/`, `database/`, and `utils/`.
- `web/public/`: static frontend assets and PWA-facing files.
- `cli/`: local CLI package, exposed as `cfdrop` from `cli/bin/cfdrop.js`.
- Root configuration includes `wrangler.toml`, `pnpm-workspace.yaml`, `tsconfig.json`, and deployment scripts.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies. Node.js `>=20` is required.
- `pnpm dev`: run Worker and web dev servers together via `npm-run-all`.
- `pnpm dev:cf`: run the Cloudflare Worker locally with Wrangler.
- `pnpm dev:web`: start the frontend dev server from `web/`.
- `pnpm build`: build production frontend assets.
- `pnpm deploy`: build the frontend, then deploy the Worker with `wrangler deploy --minify`.
- `cd web && pnpm preview`: preview the built frontend locally.

## Coding Style & Naming Conventions
- TypeScript uses `strict: true`; keep public API and Worker boundary types explicit.
- Use 2-space indentation and semicolons.
- Preserve local quote style: backend files in `src/` use double quotes; frontend files in `web/src/` use single quotes.
- React components use PascalCase, for example `PasswordInput.tsx`.
- Utilities, hooks, actions, and store helpers use camelCase, for example `debounce.ts` or `useConsistCallback.ts`.

## Testing Guidelines
- No dedicated automated test framework is currently configured.
- Minimum validation for changes is `pnpm build`.
- For Worker/API edits, also run `pnpm dev:cf` and manually verify a relevant endpoint, for example `GET /api/list`.
- For frontend edits, run `pnpm dev:web` and check the affected workflow in the browser.
- If tests are added later, prefer colocated `*.test.ts` or `*.test.tsx` files near the code under test.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style already used in history: `feat:`, `fix:`, `refactor:`, `chore:`, `style:`, and `docs:`.
- Keep commit subjects short and imperative, for example `fix: handle empty upload names`.
- Pull requests should include scope, reason for change, validation results, and config or infrastructure impact.
- Include screenshots or GIFs for user-facing web changes.

## Security & Configuration Tips
- Do not commit secrets or environment-specific Cloudflare credentials.
- Treat `wrangler.toml` changes as infrastructure-impacting and document D1, R2, or binding updates in the PR.
