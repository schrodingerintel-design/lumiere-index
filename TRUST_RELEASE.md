# Title experience and trust release

Isolated branch: polish/trust-and-title-experience. No schema migration, ranking algorithm change, production data edit, or external service provisioning.

Streaming availability stays on the title page with region, availability type, retrieval date, and JustWatch attribution. No unsupported playback links. Chart titles use stored catalog IDs only. Full credits expand in place. Canonical URLs remain intact. Social metadata renders on the server; native sharing points to the film. New homepage artwork uses a versioned URL. Evidence excludes metadata and demo records. No causal narrative is fabricated.

## Operational limits

Database backup/restore was not performed: no production backup mechanism was available in this session; this release does not write or migrate production records. An operator must create and restore-test a backup before future migrations. Public per-snapshot input manifests and methodology versions remain unavailable; the UI states this. Historical snapshots are preserved, not recalculated.

TMDB commercial permissions require publisher confirmation. Personalized Google ads require certified CMP configuration in EEA/UK/Switzerland; the local preference banner is not certified. No AdSense approval is claimed. External social caches require recrawling, and some validators require publisher accounts. Initial HTML is verified directly.

## Rollback

Revert the release merge commit on master and push normally; Vercel and Railway redeploy. No database restoration is needed for this code-only release.
