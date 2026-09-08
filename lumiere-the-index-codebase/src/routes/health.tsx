import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import {
  getSourceHealth,
  getSignalHealthSummary,
  getSignalHealthFilms,
  type SourceHealth,
} from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Skeleton } from "@/components/lumiere/Skeletons";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  KeyRound,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Data & Signal Health — Lumière The Index" },
      {
        name: "description",
        content:
          "Internal view: ingestion source status, per-run record counters, and films with insufficient evidence.",
      },
    ],
  }),
  component: SignalHealthPage,
  errorComponent: RouteError,
});

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Stale = no successful collection in the last 2 hours (any schedule ≤ 1h). */
function isStale(src: SourceHealth): boolean {
  if (!src.last_ingested_at) return true;
  return Date.now() - new Date(src.last_ingested_at).getTime() > 2 * 60 * 60 * 1000;
}

function StatusPill({ src }: { src: SourceHealth }) {
  if (!src.key_configured)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-foreground/5 px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
        <KeyRound className="h-3 w-3" /> No key
      </span>
    );
  if (src.last_error)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-down/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-down">
        <AlertTriangle className="h-3 w-3" /> Error
      </span>
    );
  if (isStale(src))
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-live">
        <Clock className="h-3 w-3" /> Stale
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-up/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-up">
      <CheckCircle2 className="h-3 w-3" /> OK
    </span>
  );
}

function CounterCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="font-mono text-sm tabular">{fmt(value)}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function SignalHealthPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["health", "summary"],
    queryFn: getSignalHealthSummary,
    staleTime: 60 * 1000,
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["health", "sources"],
    queryFn: getSourceHealth,
    staleTime: 60 * 1000,
  });

  const { data: films, isLoading: filmsLoading } = useQuery({
    queryKey: ["health", "films"],
    queryFn: () => getSignalHealthFilms(100),
    staleTime: 60 * 1000,
  });

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Activity className="h-4 w-4 text-primary" />
          <span>Internal · Data / Signal Health</span>
        </div>
        <h1 className="mt-2 font-display text-4xl lg:text-5xl">Signal Health</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          What the ingestion pipeline is actually collecting — per source, per run. Missing
          data is reported as missing, never synthesized. Raw observations feed source
          metrics, which normalize into the 0–100 Index Score.
        </p>
      </section>

      {/* ── Summary tiles ── */}
      <section className="mt-8 grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 lg:px-6">
        {summaryLoading || !summary ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : (
          <>
            <div className="glass-soft rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Database className="h-3.5 w-3.5" /> Films tracked
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular">
                {summary.total_films_tracked}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {summary.films_charted} charted in latest snapshot
              </div>
            </div>
            <div className="glass-soft rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" /> Evidence gaps
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular text-down">
                {summary.films_with_insufficient_evidence}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                insufficient · {summary.films_with_low_evidence} low confidence
              </div>
            </div>
            <div className="glass-soft rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> Observations 30d
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular">
                {fmt(summary.total_observations_30d)}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {fmt(summary.total_records_30d)} records · views/pageviews/posts
              </div>
            </div>
            <div className="glass-soft rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Pending queue
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular">
                {summary.pending_unresolved}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                unmatched mentions awaiting discovery
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Scheduler status ── */}
      {summary && (
        <section className="mt-6 px-4 lg:px-6">
          <div className="glass-tint flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 font-mono text-[10px]">
            <span className={summary.scheduler_enabled ? "text-up" : "text-down"}>
              scheduler: {summary.scheduler_enabled ? "running in-process" : "disabled"}
            </span>
            {Object.entries(summary.scheduler_last_runs ?? {}).slice(0, 6).map(([task, ts]) => (
              <span key={task} className="text-muted-foreground">
                {task.replace("ingest_", "")}: {timeAgo(ts)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Source table ── */}
      <section className="mt-8 px-4 lg:px-6">
        <h2 className="font-display text-2xl">Ingestion Sources</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Counters reflect the most recent scheduled run of each adapter.
        </p>

        {sourcesLoading ? (
          <div className="mt-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="glass-solid mt-4 overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-foreground/10 text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Last run</th>
                  <th className="px-3 py-3 text-right font-medium">Requested</th>
                  <th className="px-3 py-3 text-right font-medium">Received</th>
                  <th className="px-3 py-3 text-right font-medium">Processed</th>
                  <th className="px-3 py-3 text-right font-medium">Rejected</th>
                  <th className="px-3 py-3 text-right font-medium">API err</th>
                  <th className="px-3 py-3 text-right font-medium">Rate-lim</th>
                </tr>
              </thead>
              <tbody>
                {(sources ?? []).map((src) => (
                  <tr
                    key={src.key}
                    className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{src.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {src.key} · weight {src.weight.toFixed(1)} ·{" "}
                        {fmt(src.mentions_24h)} signals/24h
                      </div>
                      {src.observations_24h > 0 && (
                        <div className="font-mono text-[10px] text-up">
                          {fmt(src.observations_24h)} observations/24h (views · pageviews · units)
                        </div>
                      )}
                      {src.last_error && (
                        <div className="mt-1 max-w-md truncate font-mono text-[10px] text-down">
                          {src.last_error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill src={src} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                      {timeAgo(src.last_ingested_at)}
                    </td>
                    <td className="px-3 py-3">
                      <CounterCell label="req" value={src.records_requested} />
                    </td>
                    <td className="px-3 py-3">
                      <CounterCell label="recv" value={src.records_received} />
                    </td>
                    <td className="px-3 py-3">
                      <CounterCell label="ok" value={src.records_processed} />
                    </td>
                    <td className="px-3 py-3">
                      <CounterCell label="rej" value={src.records_rejected} />
                    </td>
                    <td className="px-3 py-3">
                      <CounterCell label="api" value={src.api_errors} />
                    </td>
                    <td className="px-3 py-3">
                      <CounterCell label="429" value={src.rate_limit_errors} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Films with insufficient evidence ── */}
      <section className="mt-10 px-4 pb-8 lg:px-6">
        <h2 className="font-display text-2xl">Films with insufficient evidence</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Titles currently ranked on too few raw observations to support confident claims.
          Ordered weakest evidence first.
        </p>

        {filmsLoading ? (
          <div className="mt-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (films ?? []).length === 0 ? (
          <div className="glass mt-4 rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No snapshot data yet.
          </div>
        ) : (
          <ul className="glass-solid mt-4 divide-y divide-foreground/5 overflow-hidden rounded-2xl">
            {films!.map((f) => (
              <li key={f.slug} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-10 shrink-0 font-mono text-sm tabular text-muted-foreground">
                  #{f.rank || "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                    f.confidence === "insufficient"
                      ? "bg-down/15 text-down"
                      : f.confidence === "low"
                        ? "bg-live/15 text-live"
                        : "bg-up/15 text-up"
                  }`}
                >
                  {f.confidence}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-xs tabular text-muted-foreground">
                  {f.sample_size} sig
                </span>
                <span className="hidden w-20 shrink-0 text-right font-mono text-[10px] text-muted-foreground sm:block">
                  seen {timeAgo(f.last_seen_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
