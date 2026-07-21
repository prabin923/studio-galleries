# Studio Galleries

Multi-tenant file-management platform for photo studios, modeled on wfolio.com.
Studios upload photoshoots into galleries, share secure links, and clients pick
favorites — with every file stored in **one central Google Drive owned by the
platform admin** (folder per studio, folder per gallery). Set `ADMIN_EMAILS`
in `.env` to control who can connect/disconnect that Drive.

## Stack

Next.js 16 (App Router, TypeScript) · Prisma 7 + Postgres · Auth.js v5 (Google
login) · Google Drive API (`drive.file` scope) as pluggable storage · Tailwind.

## How it works

- **Uploads** go browser → Google Drive directly via resumable upload sessions
  (8 MB chunks, resume on failure). Our server only initiates the session and
  verifies completion — file bytes never pass through it.
- **Serving**: Drive file IDs are never exposed. Images are served through
  `/api/i/{fileId}/{variant}` with HMAC-signed expiring URLs and immutable
  cache headers; thumbnails reuse Drive's own resizer.
- **Clients need no account**: share links carry a token (192-bit), optional
  argon2id password, expiry, selection deadline, and a selection cap. Clients
  label picks as must-have or maybe, leave notes, and finalize their selection;
  all proofing changes are enforced server-side.
- **Export**: per-client selections copy out as comma-separated basenames
  (Lightroom text filter) or newline filenames (Capture One).

## Setup

1. **Database**: `docker compose up -d` (Postgres on port 5434), then
   `npx prisma migrate dev`.

2. **Google Cloud** (one project serves login + Drive):
   - Create a project at console.cloud.google.com and enable the
     **Google Drive API**.
   - Configure the OAuth consent screen (External). Publish it when going to
     production — apps left in "Testing" get refresh tokens that expire after
     7 days.
   - Create an **OAuth client ID** (Web application) with redirect URIs:
     - `http://localhost:3001/api/auth/callback/google`
     - `http://localhost:3001/api/drive/callback`
   - Put the client ID/secret in `.env`.

3. **Env**: copy `.env.example` to `.env` for local development and fill in the
   secrets (generation commands are in the comments). Do not deploy that file to
   Vercel; use project Environment Variables instead.

4. `npm install && npm run dev`

> Note: if something else runs on port 3000, start with
> `npm run dev` (pinned to port 3001) and keep `AUTH_URL`, `NEXT_PUBLIC_APP_URL`,
> and the Google redirect URIs to match.

## Checks

- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript
- `npm run test` — focused unit tests for security-sensitive helpers
- `npm run check` — all of the above

For production rollout details, see `docs/PRODUCTION.md`.

## Key paths

| Path | Purpose |
|---|---|
| `prisma/schema.prisma` | Full data model (Studio, Gallery, File, ShareLink, ClientSession, Favorite) |
| `src/lib/auth.ts` | Auth.js config + `requireStudio()` — sole entry point for tenant-scoped access |
| `src/lib/storage/` | `StorageProvider` interface + `GoogleDriveProvider` |
| `src/lib/crypto.ts` | AES-256-GCM token encryption + HMAC-signed image URLs |
| `src/app/api/uploads/*` | Resumable upload initiate/complete |
| `src/app/api/i/…`, `src/app/api/dl/…` | Image proxy and gated downloads |
| `src/app/g/[token]/` | Public client gallery (enter → password → gallery) |
| `src/components/uploader/Uploader.tsx` | Chunked browser → Drive uploader |

## Known limits (MVP)

- Rate limiting is in-memory — swap for a shared store before scaling to
  multiple instances.
- Video thumbnails rely on Drive generating them (usually fine).
- Watermarking, comments, face recognition, payments: designed for, not built.
# studio-galleries
