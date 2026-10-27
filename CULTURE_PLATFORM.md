# Culture platform release

## Product scope

- Film and television catalog browsing: trending, popular, top-rated, pagination, title credits, trailers, seasons, related titles, biographies and filmographies.
- People trends come from TMDB and are labeled accordingly. They are separate from the Movie 100 / TV 100.
- 23 curated game, creator and music profiles. Their guides are editorial interpretation, not measured popularity rankings. Each has a source identity and related profile.
- Global search joins Index films, TMDB film/TV/people search, and the curated culture collection. Local saved items span catalog categories; legacy film watchlists are retained.

## Cost and resilience

No new database, paid API subscription, storage bucket, or migration is required. The existing server-side TMDB key is reused. New catalog routes do not access MySQL and remain available when its circuit breaker opens. TMDB JSON caches are capped at 512 entries. Wikimedia enrichment is limited to curated identities, four concurrent requests, and a six-hour cache; reference images require author and license metadata. Editorial profile content remains available without enrichment.

This does not make Railway free, guarantee uninterrupted upstream APIs, or supply cloud sync/accounts. Supabase was not provisioned because a second database would not solve catalog breadth or source licensing. It remains an option for future authenticated social features if needed.

## Trust and advertising

Automatic production demo seeding is removed from lifespan and Docker startup. Manual demo seeding requires LUMIERE_DEMO_DATA=1. Existing historical data is not deleted by this release. If a production database contains old seed_* records, an administrator should audit and repair derived snapshots separately before representing them as measured history.

Sentiment now requires at least 20 recent, non-demo, classified text mentions in a 30-day window. Sample size is displayed; this is a minimum display threshold, not a claim of statistical representativeness or verified audience consensus. Provider ratings and trends retain their own provenance. Empty Weekly 100 is omitted from primary navigation and noindexed pending publication. New catalog/library/profile routes contain no ad slots; homepage placement requires actual chart content.

AdSense approval is not guaranteed. The publisher must confirm TMDB commercial permission before monetizing TMDB-dependent inventory; a free developer key does not grant commercial rights. Wikimedia reference text retains CC BY-SA attribution and licensing links. Only CC/public-domain images with source metadata are displayed by culture enrichment; no game covers or non-free album art are copied as fallback. Review actual licenses and consent requirements before enabling advertising. The existing custom consent preference is not a substitute for a Google-certified CMP where one is required.

## Deployment

Backend changes and frontend changes ship together. No environment variables need to change for existing TMDB access. Deploy the backend before or alongside the frontend: the new /tmdb/trending, /tmdb/person, /tmdb/catalog, /tmdb/search/multi, and /culture/wiki endpoints do not exist on the old backend.

The sitemap includes curated profiles and category destinations. Private saved-item pages remain noindex. Source-linked original guides, accurate data, working navigation and steady curation are ongoing responsibilities; there is no automated AdSense resubmission in this change.
