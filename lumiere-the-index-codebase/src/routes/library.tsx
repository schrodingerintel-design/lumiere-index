import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/lumiere/Layout";
import { SaveItem } from "@/components/lumiere/Catalog";
import { useLibrary } from "@/lib/library";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Your saved culture · The Index" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [canonicalLink("/library")],
  }),
  component: Library,
});
function Library() {
  const { items } = useLibrary();
  const [filter, setFilter] = useState("Everything");
  const categories = ["Everything", ...new Set(items.map((item) => item.category))];
  const filtered = items.filter((item) => filter === "Everything" || item.category === filter);
  return (
    <Layout>
      <div className="catalog-page">
        <header className="catalog-page-heading">
          <span className="eyebrow">Your corner of culture</span>
          <h1>Keep the good stuff.</h1>
          <p>Films, people, games, and discoveries saved on this device.</p>
          <Link to="/watchlist" className="text-link">
            Open your Index film watchlist
          </Link>
        </header>
        <div className="discovery-filters" role="group" aria-label="Saved category">
          {categories.map((category) => (
            <button
              key={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="library-grid">
          {filtered.map((item) => (
            <article key={item.key}>
              {item.image && (
                <Link to={item.path}>
                  <img src={item.image} alt="" loading="lazy" />
                </Link>
              )}
              <div>
                <span className="eyebrow">{item.category}</span>
                <Link to={item.path}>
                  <h2>{item.title}</h2>
                </Link>
                <p>{item.subtitle}</p>
                <SaveItem item={item} />
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="catalog-empty">
            <h2>Your next favorite belongs here.</h2>
            <p>Use Save on any catalog page to start a collection.</p>
            <Link className="primary-button" to="/explore">
              Explore culture
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
