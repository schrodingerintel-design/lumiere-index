import { useState } from "react";
import { Layout } from "./Layout";
import { CultureNav } from "./CultureNav";
import { CultureCard } from "./Catalog";
import { CULTURE, CULTURE_CATEGORIES } from "@/lib/catalog";
export function CultureDirectory({ kind }: { kind: "games" | "creators" | "music" }) {
  const [tag, setTag] = useState("All");
  const [search, setSearch] = useState("");
  const category = CULTURE_CATEGORIES.find((item) => item.kind === kind)!;
  const all = CULTURE.filter((item) => item.kind === kind);
  const tags = ["All", ...new Set(all.flatMap((item) => item.tags))];
  const entries = all.filter(
    (item) =>
      (tag === "All" || item.tags.includes(tag)) &&
      [item.title, item.format, item.credit].join(" ").toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Layout>
      <div className="catalog-page">
        <header className="catalog-page-heading">
          <span className="eyebrow">{category.label} · Lumière selections</span>
          <h1>{category.heading}</h1>
          <p>{category.copy}</p>
        </header>
        <div className="catalog-toolbar">
          <div className="discovery-filters" role="group" aria-label="Filter by interest">
            {tags.map((item) => (
              <button key={item} aria-pressed={tag === item} onClick={() => setTag(item)}>
                {item}
              </button>
            ))}
          </div>
          <label className="directory-search">
            <span className="sr-only">Search {category.label}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Find ${category.label.toLowerCase()}`}
            />
          </label>
        </div>
        <div className="culture-grid">
          {entries.map((entry) => (
            <CultureCard key={entry.slug} entry={entry} />
          ))}
        </div>
        {!entries.length && (
          <p className="catalog-empty">No matching profiles. Try another search or filter.</p>
        )}
        <p className="provider-credit">
          Selections are curated, not a popularity ranking. Each profile includes a Lumière viewing
          or listening guide and links to its reference sources. Updated October 26, 2026.
        </p>
      </div>
    </Layout>
  );
}
