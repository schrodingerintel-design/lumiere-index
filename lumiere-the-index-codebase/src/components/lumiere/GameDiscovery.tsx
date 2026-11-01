import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";

type Game = {
  id: number;
  name: string;
  url: string;
  image: string | null;
  released: string;
  rating: number | null;
  ratings_count: number;
  genres: string[];
  platforms: string[];
};
type Discovery = {
  items: Game[];
  ordering: "catalog_popularity" | "ai_editorial";
  updated_at: string;
  stale: boolean;
};

export function GameDiscovery() {
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(12);
  const query = useQuery({
    queryKey: ["games", "discovery"],
    queryFn: ({ signal }) => apiFetch<Discovery>("/api/v1/games/discover", { signal }, 20000),
    staleTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const items = (query.data?.items ?? []).filter((game) =>
    [game.name, ...game.genres, ...game.platforms]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="game-discovery" aria-labelledby="game-discovery-title">
      <div className="game-discovery-heading">
        <div>
          <span className="eyebrow">In play</span>
          <h2 id="game-discovery-title">
            {query.data?.ordering === "ai_editorial" ? "The games edit" : "Popular games"}
          </h2>
        </div>
        {query.data && (
          <label className="directory-search">
            <span className="sr-only">Search games, platforms or genres</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisible(12);
              }}
              placeholder="Find a game, genre or platform"
            />
          </label>
        )}
      </div>
      {query.isPending && <p role="status">Loading games…</p>}
      {query.isError && (
        <p className="catalog-empty">
          Game discovery is temporarily unavailable. Explore our guides below.
        </p>
      )}
      <div className="game-discovery-grid">
        {items.slice(0, visible).map((game, index) => (
          <article className="game-discovery-card" key={game.id}>
            <a
              href={game.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Explore ${game.name} on RAWG`}
            >
              <div className="game-discovery-art">
                {game.image && <img src={game.image} alt="" loading="lazy" />}
                <span className="game-discovery-position">
                  {search ? "Game" : String(index + 1).padStart(2, "0")}
                </span>
                <span className="game-discovery-genres">{game.genres.join(" · ")}</span>
              </div>
              <div className="game-discovery-info">
                <h3>{game.name}</h3>
                <p>{game.platforms.join(" · ")}</p>
                <div className="game-discovery-meta">
                  <span>{game.released.slice(0, 4) || "Release TBA"}</span>
                  {game.rating !== null && game.ratings_count > 0 && (
                    <span title={`${game.ratings_count.toLocaleString("en")} RAWG ratings`}>
                      {game.rating.toFixed(1)} / 5
                    </span>
                  )}
                </div>
              </div>
            </a>
          </article>
        ))}
      </div>
      {query.data && !items.length && <p className="catalog-empty">No games match this search.</p>}
      {items.length > visible && (
        <button className="soft-button" onClick={() => setVisible((count) => count + 12)}>
          More games
        </button>
      )}
      {query.data && (
        <p className="provider-credit">
          <a href="https://rawg.io" target="_blank" rel="noopener noreferrer">
            Game data and images: RAWG
          </a>
          {query.data.ordering === "ai_editorial"
            ? " · AI-assisted selection"
            : " · Catalog popularity"}
          {" · "}
          {query.data.stale ? "Last available update" : "Updated"}{" "}
          {new Date(query.data.updated_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}
          {" · Refreshes every 72 hours"}
        </p>
      )}
    </section>
  );
}
