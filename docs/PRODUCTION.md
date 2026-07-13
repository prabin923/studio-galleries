# Production Checklist

Use this checklist before deploying Studio Galleries outside local development.

## Required Environment

- `DATABASE_URL`: production Postgres connection string.
- `AUTH_SECRET`: stable Auth.js secret, generated with `openssl rand -base64 32`.
- `AUTH_URL`: public app origin, for example `https://galleries.example.com`.
- `NEXT_PUBLIC_APP_URL`: same public origin used by Google OAuth redirects.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: OAuth web client with both callback URLs registered.
- `STORAGE_TOKEN_KEY`: 32-byte hex key from `openssl rand -hex 32`.
- `IMAGE_URL_SECRET`: stable HMAC secret from `openssl rand -base64 32`.
- `ADMIN_EMAILS`: comma-separated platform admin emails. Do not leave unset in production.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: stable value shared by every app instance.

## Google OAuth

Register these redirect URLs for the production origin:

- `{NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
- `{NEXT_PUBLIC_APP_URL}/api/drive/callback`

Publish the OAuth consent screen before production. Google refresh tokens issued
while the app is in Testing mode can expire unexpectedly.

## Runtime

- Run database migrations during deploy: `npx prisma migrate deploy`.
- Run preflight checks before shipping: `npm run check`.
- Use rolling deploys when clients may be actively favoriting, commenting, or uploading.
- Keep the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` on every instance in the deployment.

## Scaling Notes

The current rate limiter is in-memory. It protects a single process, but limits
are not shared across multiple instances. Replace `src/lib/rate-limit.ts` with a
shared store such as Redis or Upstash before horizontal scaling.

ZIP exports stream files sequentially from Drive to avoid opening too many Drive
connections. For very large galleries, keep the platform timeout at least 300s
or move exports to a background job.

## Security Checks

- Confirm `.env.example` contains placeholders only.
- Confirm `ADMIN_EMAILS` is set.
- Confirm Drive upload completion rejects files that do not match the gallery
  folder, filename, MIME type, and expected size.
- Confirm signed image responses do not cache beyond their URL expiry.
- Confirm all dashboard mutations call `requireStudio()` or `getStudioContext()`.
