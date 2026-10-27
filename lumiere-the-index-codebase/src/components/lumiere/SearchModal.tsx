import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { searchCatalog, CULTURE, imageOf, titleOf, yearOf, type ScreenTitle } from "@/lib/catalog";
import { searchFilms } from "@/lib/apiClient";

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useQuery({
    queryKey: ["catalog", "search", debounced],
    queryFn: () => searchCatalog(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 300000,
    retry: false,
  });
  const index = useQuery({
    queryKey: ["films", "search", debounced],
    queryFn: () => searchFilms(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 300000,
    retry: false,
  });
  const local =
    debounced.length >= 2
      ? CULTURE.filter((entry) =>
          [entry.title, entry.credit, entry.format, ...entry.tags]
            .join(" ")
            .toLowerCase()
            .includes(debounced.toLowerCase()),
        )
      : CULTURE.filter((entry) => ["elden-ring", "mkbhd", "beyonce"].includes(entry.slug));
  const list = (results.data?.results || [])
    .filter((item) => !("adult" in item && item.adult))
    .slice(0, 16);
  function close() {
    setQuery("");
    setDebounced("");
    onClose();
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Content
          className="global-search-dialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <div className="global-search-heading">
            <Dialog.Title>Find your next obsession.</Dialog.Title>
            <Dialog.Close aria-label="Close search" className="soft-button">
              Close
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Search films, television, people, games, creators, and music.
          </Dialog.Description>
          <label className="sr-only" htmlFor="culture-search">
            Search culture
          </label>
          <input
            ref={inputRef}
            id="culture-search"
            className="global-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Films, people, games, music…"
            autoComplete="off"
          />
          <div className="global-search-results">
            {(results.isFetching || index.isFetching) && <p role="status">Searching…</p>}
            {index.data && index.data.length > 0 && (
              <section>
                <h2>On The Index</h2>
                {index.data.slice(0, 4).map((film) => (
                  <Link
                    key={film.slug}
                    to="/films/$slug"
                    params={{ slug: film.slug }}
                    onClick={close}
                  >
                    {film.poster_url && <img src={film.poster_url} alt="" />}
                    <span>
                      <strong>{film.title}</strong>
                      <small>
                        {film.year} ·{" "}
                        {film.rank > 0
                          ? `#${film.rank} ${film.content_type === "TV_SHOW" ? "TV 100" : "Movie 100"}`
                          : "Catalog title"}
                      </small>
                    </span>
                    <span>Open</span>
                  </Link>
                ))}
              </section>
            )}
            {list.length > 0 && (
              <section>
                <h2>Film, television & people</h2>
                {list.map((item) => {
                  if ("media_type" in item && item.media_type === "person") {
                    return (
                      <Link
                        key={`person:${item.id}`}
                        to="/people/$id"
                        params={{ id: String(item.id) }}
                        onClick={close}
                      >
                        {item.profile_path && (
                          <img src={imageOf(item.profile_path, "w185")} alt="" />
                        )}
                        <span>
                          <strong>{item.name}</strong>
                          <small>Person · {item.known_for_department || "Film & TV"}</small>
                        </span>
                        <span>Open</span>
                      </Link>
                    );
                  }
                  const film = item as ScreenTitle;
                  const type = film.media_type === "tv" ? "tv" : "movie";
                  return (
                    <Link
                      key={`${type}:${film.id}`}
                      to="/screen/$type/$id"
                      params={{ type, id: String(film.id) }}
                      onClick={close}
                    >
                      {film.poster_path && <img src={imageOf(film.poster_path, "w185")} alt="" />}
                      <span>
                        <strong>{titleOf(film)}</strong>
                        <small>
                          {type === "tv" ? "TV" : "Film"} · {yearOf(film)}
                        </small>
                      </span>
                      <span>Open</span>
                    </Link>
                  );
                })}
              </section>
            )}
            {local.length > 0 && (
              <section>
                <h2>
                  {debounced.length >= 2
                    ? "Games, creators & music"
                    : "Explore something different"}
                </h2>
                {local.slice(0, 12).map((entry) => (
                  <Link
                    key={entry.slug}
                    to="/culture/$slug"
                    params={{ slug: entry.slug }}
                    onClick={close}
                  >
                    <span>
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.format} · {entry.credit}
                      </small>
                    </span>
                    <span>Open</span>
                  </Link>
                ))}
              </section>
            )}
            {debounced.length >= 2 &&
              !results.isFetching &&
              !index.isFetching &&
              !list.length &&
              !local.length &&
              !index.data?.length && (
                <p>
                  {results.isError
                    ? "The film and people catalog is unavailable right now. You can still search games, creators, and music."
                    : "No matches. Try a different name or title."}
                </p>
              )}
            {results.isError && (
              <button className="soft-button" onClick={() => void results.refetch()}>
                Retry film & people search
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
