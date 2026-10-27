import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTmdbWatchProviders, getTmdbTvWatchProviders } from "@/lib/apiClient";
import type { ScreenType } from "@/lib/catalog";

const REGIONS = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["NG", "Nigeria"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["IN", "India"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["BR", "Brazil"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["ZA", "South Africa"],
];
export function WatchAvailability({
  type,
  id,
  upcoming = false,
}: {
  type: ScreenType;
  id: number;
  upcoming?: boolean;
}) {
  const [region, setRegion] = useState("US");
  const query = useQuery({
    queryKey: ["availability", type, id],
    queryFn: () => (type === "tv" ? getTmdbTvWatchProviders(id) : getTmdbWatchProviders(id)),
    enabled: !upcoming,
    staleTime: 1800000,
  });
  const data = query.data?.results?.[region];
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const regions = [
    ...new Set([...REGIONS.map(([code]) => code), ...Object.keys(query.data?.results || {})]),
  ]
    .map((code) => [code, names.of(code) || code])
    .sort((a, b) => a[1].localeCompare(b[1]));
  const groups = [
    ["Subscription", data?.flatrate],
    ["Free", data?.free],
    ["With ads", data?.ads],
    ["Rent", data?.rent],
    ["Buy", data?.buy],
  ] as const;
  const available = groups.some(([, providers]) => providers?.length);
  return (
    <section className="catalog-section" id="where-to-watch">
      <div className="catalog-section-heading">
        <h2>Where to watch</h2>
        <select
          aria-label="Availability region"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        >
          {regions.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {upcoming ? (
        <p>Streaming availability is not yet listed for this upcoming title.</p>
      ) : query.isPending ? (
        <p>Loading streaming availability…</p>
      ) : !available ? (
        <p>Streaming availability is currently unavailable for this region.</p>
      ) : (
        groups.map(
          ([label, providers]) =>
            !!providers?.length && (
              <div className="watch-provider-group" key={label}>
                <h3>{label}</h3>
                <div>
                  {providers.map((provider) => (
                    <span key={provider.provider_id}>{provider.provider_name}</span>
                  ))}
                </div>
              </div>
            ),
        )
      )}
      <p className="catalog-source">
        Availability data:{" "}
        <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">
          JustWatch
        </a>{" "}
        via TMDB. Region: {names.of(region) || region}.
        {query.dataUpdatedAt > 0 &&
          ` Retrieved ${new Date(query.dataUpdatedAt).toISOString().slice(0, 10)}.`}{" "}
        Provider verification dates and direct playback links are not supplied. Availability may
        change.
      </p>
    </section>
  );
}
