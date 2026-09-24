# Cloudflare preview operations

## Resources

- Worker name: `mandarinlearnapp`
- D1 database: `mandarinlearnapp` (the preview ID is in the root Wrangler config)
- Static assets: bundled with the Worker, including the initial MP3 and stroke JSON files
- R2: not needed for the starter set; the optional `MEDIA` binding can be enabled later for a larger asset library

## First deployment

1. Install Node.js and dependencies: `npm ci`.
2. Sign Wrangler into the Cloudflare account and verify the account before making resources.
3. Generate a cryptographically random secret with at least 32 characters and run `npx wrangler secret put BETTER_AUTH_SECRET`. Paste the value at Wrangler's hidden input prompt. Do not put it in Git or terminal history.
4. Apply schema and content using `npm run db:migrate:remote`.
5. Deploy using `npm run deploy`. Wrangler prints the HTTPS `workers.dev` URL.
6. Add that exact origin as the `APP_URL` Worker secret with `npx wrangler secret put APP_URL`, then redeploy. This enables secure cookies and restricts trusted auth origins to the deployed app.

Subsequent releases use `npm run deploy`; Worker secrets persist between deployments. Apply any new D1 migration before deploying code that depends on it. For a separate environment, create a separate D1 database rather than reusing production data.

## Owner administrator bootstrap

New registrations receive only the learner role. To set up the first owner, generate a separate temporary random secret and store it with `npx wrangler secret put BOOTSTRAP_ADMIN_SECRET`. Register the intended owner account in the app, then call `POST /api/v1/admin/bootstrap` with JSON `{"email":"the-account-email"}` and the `x-bootstrap-secret` header. The endpoint can run only once. Immediately remove the bootstrap secret with `npx wrangler secret delete BOOTSTRAP_ADMIN_SECRET`. Do not put the temporary value in source control or share it publicly. Audit access to learner profiles is available only to the owner or an explicitly granted content reviewer.

## Database backup and change safety

- Review migration SQL before applying it. Migrations are additive/versioned; do not edit a migration already recorded as applied in any environment.
- Export a D1 snapshot before a destructive schema or content change with Wrangler's D1 export command. Store the export outside the public repository and protect it as learner data.
- To download a backup, use `npx wrangler d1 export mandarinlearnapp --remote --output=mandarinlearnapp-backup.sql` and verify the generated file before storing it. Never commit a populated production export.
- Do not place credentials, learner exports, local `.dev.vars`, or account-specific backups in GitHub.

## Quota and portability notes

The app is designed to use Cloudflare's free services but still needs live quota monitoring; plan limits can change. The seed audio/stroke files are served as static assets, not billed third-party APIs. The API uses versioned `/api/v1` routes and a domain/content schema with stable IDs; a future Supabase/Postgres adapter should preserve those contracts and migration semantics rather than copying Cloudflare-specific code into the UI.
