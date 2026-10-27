import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { CultureCard, SaveItem, ShareItem } from "@/components/lumiere/Catalog";
import { CULTURE, getCultureReference, sourceOf } from "@/lib/catalog";
import { canonicalLink } from "@/lib/site";

export const Route = createFileRoute("/culture/$slug")({
  loader: ({ params }) => {
    const entry = CULTURE.find((item) => item.slug === params.slug);
    if (!entry) throw notFound();
    return entry;
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.title || "Culture"} · The Index` },
      {
        name: "description",
        content: loaderData?.intro.slice(0, 155) || "Explore culture with The Index.",
      },
      ...(!loaderData ? [{ name: "robots", content: "noindex" }] : []),
    ],
    links: [canonicalLink(`/culture/${params.slug}`)],
  }),
  component: CultureDetail,
});

function CultureDetail() {
  const entry = Route.useLoaderData();
  const reference = useQuery({
    queryKey: ["culture", "reference", entry.slug],
    queryFn: () => getCultureReference(entry.slug),
    staleTime: 21600000,
    retry: false,
  });
  const categoryPath =
    entry.kind === "games" ? "/games" : entry.kind === "music" ? "/music" : "/creators";
  const related = CULTURE.find((item) => item.slug === entry.related);
  return (
    <Layout>
      <div className="catalog-page">
        <nav className="catalog-breadcrumb">
          <Link to={categoryPath}>{entry.kind[0].toUpperCase() + entry.kind.slice(1)}</Link>
          <span>/</span>
          <span>{entry.title}</span>
        </nav>
        <header
          className="culture-profile-hero"
          style={{
            background: `radial-gradient(ellipse at 90% 0%,${entry.color}99,transparent 75%),#241b2c`,
          }}
        >
          <div>
            <span className="eyebrow">{entry.format}</span>
            <h1>{entry.title}</h1>
            <p>{entry.headline}</p>
            <div className="profile-facts">
              <span>{entry.credit}</span>
              {entry.kind === "games" && <span>First released {entry.year}</span>}
              {entry.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="detail-actions">
              <SaveItem
                item={{
                  key: entry.slug,
                  title: entry.title,
                  path: `/culture/${entry.slug}`,
                  category: entry.kind,
                  image: reference.data?.image_url || undefined,
                  subtitle: entry.format,
                }}
              />
              <ShareItem title={entry.title} path={`/culture/${entry.slug}`} />
            </div>
          </div>
          {reference.data?.image_url && (
            <figure>
              <img src={reference.data.image_url} alt={entry.title} />
              <figcaption>
                <a
                  href={reference.data.image_source || sourceOf(entry)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {reference.data.image_credit} · {reference.data.image_license}
                </a>
              </figcaption>
            </figure>
          )}
        </header>
        <div className="culture-profile-body">
          <article className="culture-guide">
            <span className="eyebrow">The Lumière guide</span>
            <h2>{entry.headline}</h2>
            <p>{entry.intro}</p>
            <h3>
              {entry.kind === "games"
                ? "What to look for"
                : entry.kind === "music"
                  ? "A closer listen"
                  : "Watch with a closer eye"}
            </h3>
            <p>{entry.angle}</p>
            <p className="guide-date">Updated October 26, 2026 · Lumière</p>
            {reference.data?.extract && (
              <section className="reference-notes">
                <h3>Background</h3>
                <p>{reference.data.extract}</p>
                <p className="provider-credit">
                  Excerpt from{" "}
                  <a href={reference.data.source_url} target="_blank" rel="noopener noreferrer">
                    Wikipedia and its contributors
                  </a>
                  , shortened for this profile. Text is available under{" "}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CC BY-SA 4.0
                  </a>
                  .{reference.data.stale ? " Reference data is cached." : ""}
                </p>
              </section>
            )}
            <div className="reference-links">
              <h3>Sources & further reading</h3>
              <a href={sourceOf(entry)} target="_blank" rel="noopener noreferrer">
                Read the reference article on Wikipedia
              </a>
              <a href={`${sourceOf(entry)}#References`} target="_blank" rel="noopener noreferrer">
                Explore the article’s cited sources
              </a>
            </div>
          </article>
          <aside className="culture-related">
            <span className="eyebrow">Continue exploring</span>
            {related && <CultureCard entry={related} />}
            <Link className="soft-button" to={categoryPath}>
              All {entry.kind}
            </Link>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
