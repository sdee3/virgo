# Virgo

One-card tarot readings at [virgo.sdee3.com](https://virgo.sdee3.com), connected to the [Identity](https://identity.sdee3.com) hub for Clerk auth and shared credits.

This repo is the reference layout for identity-connected apps in the sdee3 monorepo.

## Repository layout

```
virgo/
  frontend/          # Vite React SPA (package.json, src/, vite.config.js, public/)
  backend/           # Convex backend (convex/, convex.json, package.json)
  scripts/           # Deploy scripts (e.g. deploy-frontend.sh)
  docs/              # Security and ops checklists
  .github/           # Dependabot and CI config
```

There is no root `package.json`, no root `convex/`, and no `web/` directory. Frontend and backend are fully separated; the only cross-package link is the Vite/TypeScript alias to generated Convex types.

## Development

**Requirements:** Node.js >= 24, pnpm >= 11

### Backend (Convex)

```bash
cd backend
pnpm install
pnpm dev          # convex dev
```

Copy `backend/.env.example` values into the Convex dashboard (Settings → Environment Variables).

### Frontend (Vite)

```bash
cd frontend
pnpm install
cp .env.example .env.local   # fill in dev Convex + Clerk URLs
pnpm dev
```

The frontend depends on `@sdee3/credits` via `file:../../identity/packages/credits` and imports the Virgo Convex API through:

- Vite alias: `../backend/convex/_generated/api.js` (`@convex-api`)
- TypeScript paths: `../backend/convex/_generated/api.d.ts`

Run `pnpm dev` in `backend/` first so `_generated/` exists.

## Verification

```bash
cd backend && pnpm test
cd frontend && pnpm build
```

## Production deploy

```bash
cp scripts/.env.example scripts/.env   # fill in S3 + CloudFront values
./scripts/deploy-frontend.sh
```

See `docs/security/production-checklist.md` for the full pre-release checklist.
