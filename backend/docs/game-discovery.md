# Game discovery

Set `RAWG_API_KEY` in the **Railway backend** private variables. Never put it in
Vercel frontend variables or use a `VITE_` prefix. Optional AI ordering uses the
backend `GEMINI_API_KEY` (`GOOGLE_API_KEY` and `AI_API_KEY` are also accepted).
No credentials are committed or returned by `/api/v1/games/discover`.

The collection fetches at most 40 games in one RAWG request every 72 hours.
Without AI, its order is RAWG catalog popularity (`added`, a cumulative count).
This is not a chart of live players, growth, or current social buzz. Provider
failures serve the last available package, marked stale, and wait an hour
before another request. Without a prior package, the curated guides remain.

The existing backend scheduler checks the AI job hourly, starting 18 minutes
after boot. A durable reservation in the existing source-health table allows
only one AI attempt per category every 72 hours, and separates news and game
attempts by at least six hours. Reservations survive failed calls and restarts.
They create disabled, zero-weight scheduling records and never add ranking
signals. No database schema migration is required.

AI can reorder only the first 20 supplied games; every supplied ID must occur
exactly once. The other games retain provider order. The page identifies this
as an AI-assisted editorial selection, not a measured trending chart. Public
requests never call Gemini. Shared AI daily limits also apply. Missing keys,
provider errors, invalid output, or active cooldowns leave catalog ordering
available. This release does not enable the separate unfinished AI news API.

Packages are saved atomically in the OS temporary directory by default.
To retain artwork metadata and AI ordering across deployments, set
`LUMIERE_GAMES_CACHE_PATH` to a file on an **existing** persistent backend mount.
No storage service or paid volume is provisioned by this change. The default
cache can reset on redeploy, but the database AI cooldown remains effective.
Run one scheduler instance; do not enable both Celery beat and the in-process
scheduler. The AI reservation still prevents duplicate AI generations across
workers; the RAWG file cache assumes one backend instance.

RAWG requires a link on each page displaying its data or images. The compact
credit stays on the games page; the general source policy lives in Privacy.
Review the applicable RAWG plan before enabling commercial advertising:
https://rawg.io/apidocs and https://rawg.io/tos_api contain differing descriptions
of commercial eligibility for the free plan. This integration buys no plan.

Verify deployment by opening `/games`, checking image/search/load-more behavior,
and checking `/api/v1/games/discover` for real provider IDs and an honest ordering
label. Repeated visits must preserve the package timestamp and make no AI calls.
