import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  imageOf,
  titleOf,
  yearOf,
  getCultureReference,
  sourceOf,
  type Person,
  type ScreenTitle,
  type ScreenType,
  type CultureEntry,
} from "@/lib/catalog";
import { useLibrary, type LibraryItem } from "@/lib/library";
import { sitePath } from "@/lib/site";

export function SaveItem({ item }: { item: LibraryItem }) {
  const { items, toggle } = useLibrary();
  const saved = items.some((entry) => entry.key === item.key);
  return (
    <button
      className="catalog-save"
      type="button"
      aria-pressed={saved}
      onClick={() => toggle(item)}
      aria-label={`${saved ? "Unsave" : "Save"} ${item.title}`}
    >
      {saved ? "Saved" : "+ Save"}
    </button>
  );
}
export function ShareItem({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      const url = sitePath(path);
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast.error("Couldn't share this page. Try again.");
    }
  }
  return (
    <button className="soft-button" onClick={() => void share()}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
export function ScreenCard({ film, type }: { film: ScreenTitle; type: ScreenType }) {
  const title = titleOf(film);
  const path = `/screen/${type}/${film.id}`;
  return (
    <article className="catalog-card">
      <Link
        to="/screen/$type/$id"
        params={{ type, id: String(film.id) }}
        className="catalog-poster"
      >
        {film.poster_path ? (
          <img src={imageOf(film.poster_path, "w342")} alt="" loading="lazy" />
        ) : (
          <span>{title}</span>
        )}
        {(film.vote_count ?? 0) > 0 && (
          <span className="catalog-rating">
            {film.vote_average?.toFixed(1)}
            <small>TMDB</small>
          </span>
        )}
      </Link>
      <div className="catalog-card-info">
        <Link to="/screen/$type/$id" params={{ type, id: String(film.id) }}>
          <h3>{title}</h3>
        </Link>
        <p>
          {yearOf(film)}
          {` · ${[film.character, film.job].filter(Boolean).join(" · ") || (type === "tv" ? "TV" : "Film")}`}
        </p>
        <SaveItem
          item={{
            key: `${type}:${film.id}`,
            title,
            path,
            image: imageOf(film.poster_path, "w342"),
            category: type === "movie" ? "Film" : "TV",
            subtitle: yearOf(film),
          }}
        />
      </div>
    </article>
  );
}
export function PersonCard({ person }: { person: Person }) {
  return (
    <article className="person-card">
      <Link to="/people/$id" params={{ id: String(person.id) }}>
        <div className="person-portrait">
          {person.profile_path ? (
            <img src={imageOf(person.profile_path, "w342")} alt="" loading="lazy" />
          ) : (
            <span>
              {person.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
          )}
        </div>
        <h3>{person.name}</h3>
      </Link>
      <p>{person.known_for_department || "Film & TV"}</p>
      <small>{person.known_for?.map(titleOf).slice(0, 2).join(" · ")}</small>
    </article>
  );
}
export function CultureCard({ entry }: { entry: CultureEntry }) {
  const query = useQuery({
    queryKey: ["culture", "reference", entry.slug],
    queryFn: () => getCultureReference(entry.slug),
    staleTime: 21_600_000,
    retry: false,
  });
  return (
    <article className="culture-card">
      <Link
        to="/culture/$slug"
        params={{ slug: entry.slug }}
        className="culture-card-art"
        style={{ background: `linear-gradient(145deg, ${entry.color}, #21182d)` }}
      >
        {query.data?.image_url ? (
          <img src={query.data.image_url} alt="" loading="lazy" />
        ) : (
          <span className="culture-title-art">{entry.title}</span>
        )}
        <span className="culture-card-kind">{entry.format}</span>
      </Link>
      <div className="culture-card-info">
        <Link to="/culture/$slug" params={{ slug: entry.slug }}>
          <h3>{entry.title}</h3>
        </Link>
        <p>{entry.headline}</p>
        <div className="culture-card-bottom">
          <span>{entry.credit}</span>
          <SaveItem
            item={{
              key: entry.slug,
              title: entry.title,
              path: `/culture/${entry.slug}`,
              category: entry.kind,
              image: query.data?.image_url || undefined,
              subtitle: entry.format,
            }}
          />
        </div>
        {query.data?.image_url && (
          <a
            className="image-credit"
            href={query.data.image_source || sourceOf(entry)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Image: {query.data.image_credit} · {query.data.image_license}
          </a>
        )}
      </div>
    </article>
  );
}
export function CatalogStatus({
  loading,
  error,
  retry,
  empty,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
  empty: boolean;
}) {
  if (loading)
    return (
      <div className="catalog-loading" role="status">
        Loading the catalog…
      </div>
    );
  if (error)
    return (
      <div className="catalog-empty" role="status">
        <h2>The catalog couldn't load.</h2>
        <p>Your saved items are still available.</p>
        <button className="soft-button" onClick={retry}>
          Try again
        </button>
        <Link to="/library" className="text-link">
          Open saved items
        </Link>
      </div>
    );
  if (empty)
    return (
      <div className="catalog-empty">
        <h2>No matches here yet.</h2>
        <p>Try another name, title, or category.</p>
      </div>
    );
  return null;
}
export function ProviderCredit() {
  return (
    <p className="provider-credit">
      Film, TV, people, images, and audience ratings:{" "}
      <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
        TMDB
      </a>
      . This product uses the TMDB API but is not endorsed or certified by TMDB. Provider trends and
      ratings are separate from Lumière’s charts.
    </p>
  );
}
