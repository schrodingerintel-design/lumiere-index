import { n as __toESM } from "../_runtime.mjs";
import { i as getNewEntries, l as getTmdbNowPlaying, u as getTmdbUpcoming, v as tmdbPosterUrl } from "./apiClient-BWlqrju0.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { O as Funnel, R as Calendar, l as Sparkles } from "../_libs/lucide-react.mjs";
import { n as Layout } from "./Layout-CBXeDHAE.mjs";
import { a as Skeleton, o as slugify } from "./Skeletons-JkDOzhQ6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-B6tgfA64.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var UPCOMING_PAGES = 5;
var NOW_PLAYING_PAGES = 5;
/** "Now in theaters" only counts films released within this window — old re-releases never qualify. */
var THEATER_WINDOW_DAYS = 180;
function getDaysUntil(dateStr) {
	if (!dateStr) return {
		text: "Date TBA",
		isPast: false
	};
	const diffTime = new Date(dateStr).getTime() - (/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0);
	const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
	if (diffDays < 0) return {
		text: "Now In Theaters",
		isPast: true
	};
	if (diffDays === 0) return {
		text: "Releasing Today",
		isPast: false
	};
	if (diffDays === 1) return {
		text: "Tomorrow",
		isPast: false
	};
	if (diffDays <= 30) return {
		text: `In ${diffDays} ${diffDays === 1 ? "day" : "days"}`,
		isPast: false
	};
	const months = Math.round(diffDays / 30);
	return {
		text: `In ~${months} ${months === 1 ? "month" : "months"}`,
		isPast: false
	};
}
/** Fetch several TMDB pages and merge them into one deduped list. */
async function fetchPages(fetchPage, pages) {
	return (await Promise.all(Array.from({ length: pages }, (_, i) => fetchPage(i + 1).then((p) => p.results ?? []).catch(() => [])))).flat();
}
function CalendarPage() {
	const [filter, setFilter] = (0, import_react.useState)("upcoming");
	const { data: upcoming, isLoading: upcomingLoading } = useQuery({
		queryKey: [
			"tmdb",
			"calendar",
			"upcoming",
			UPCOMING_PAGES
		],
		queryFn: () => fetchPages((p) => getTmdbUpcoming(p), UPCOMING_PAGES),
		staleTime: 3600 * 1e3
	});
	const { data: nowPlaying, isLoading: playingLoading } = useQuery({
		queryKey: [
			"tmdb",
			"calendar",
			"now_playing",
			NOW_PLAYING_PAGES
		],
		queryFn: () => fetchPages((p) => getTmdbNowPlaying(p), NOW_PLAYING_PAGES),
		staleTime: 3600 * 1e3
	});
	const { data: indexFilms } = useQuery({
		queryKey: ["films", "new-entries"],
		queryFn: () => getNewEntries(),
		staleTime: 300 * 1e3
	});
	const now = /* @__PURE__ */ new Date();
	const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	const cutoff = new Date(now);
	cutoff.setDate(cutoff.getDate() - THEATER_WINDOW_DAYS);
	const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
	const indexUpcoming = (indexFilms ?? []).filter((f) => f.release_date && f.release_date > todayStr).sort((a, b) => (a.release_date ?? "2099-01-01").localeCompare(b.release_date ?? "2099-01-01"));
	const upcomingMovies = (upcoming ?? []).filter((m) => m.release_date && m.release_date >= todayStr);
	const inTheatersMovies = (nowPlaying ?? []).filter((m) => m.release_date && m.release_date < todayStr && m.release_date >= cutoffStr);
	const sortedUpcoming = [...upcomingMovies].sort((a, b) => (a.release_date ?? "2099-01-01").localeCompare(b.release_date ?? "2099-01-01"));
	const sortedTheaters = Array.from(new Map(inTheatersMovies.map((m) => [m.id, m])).values()).sort((a, b) => (b.release_date ?? "0000-01-01").localeCompare(a.release_date ?? "0000-01-01"));
	const allMovies = Array.from(new Map([...upcomingMovies, ...inTheatersMovies].map((m) => [m.id, m])).values()).sort((a, b) => (a.release_date ?? "2099-01-01").localeCompare(b.release_date ?? "2099-01-01"));
	const displayMovies = filter === "theaters" ? sortedTheaters : filter === "upcoming" ? sortedUpcoming : allMovies;
	const isLoading = upcomingLoading || playingLoading;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "px-4 pt-6 lg:px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "Release Radar"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-serif text-5xl lg:text-6xl",
					children: "Now & Next"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-xl text-sm text-muted-foreground",
					children: "Movies in theaters and coming soon — films tracked on the Index, plus the full TMDB release calendar."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap items-center gap-2 border-b border-foreground/10 pb-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { className: "h-4 w-4 text-muted-foreground mr-1" }),
						[
							{
								id: "upcoming",
								label: "Upcoming Releases"
							},
							{
								id: "theaters",
								label: "Now In Theaters"
							},
							{
								id: "all",
								label: "All Releases"
							}
						].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setFilter(tab.id),
							className: `rounded-full px-4 py-1.5 font-mono text-xs font-medium transition ${filter === tab.id ? "bg-primary text-primary-foreground" : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"}`,
							children: tab.label
						}, tab.id)),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "ml-auto font-mono text-xs text-muted-foreground",
							children: [
								displayMovies.length,
								" ",
								displayMovies.length === 1 ? "title" : "titles"
							]
						})
					]
				})
			]
		}),
		indexUpcoming.length > 0 && filter === "upcoming" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8 px-4 lg:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "Tracked on the Index"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 font-serif text-2xl",
					children: "Coming Next"
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: indexUpcoming.map((f) => {
					const countdown = getDaysUntil(f.release_date ?? "");
					const formattedDate = f.release_date ? new Date(f.release_date).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric"
					}) : "Release Date TBA";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: f.slug },
						className: "glass card-lift group flex gap-4 overflow-hidden rounded-2xl p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-ink",
							children: f.poster_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: f.poster_url,
								alt: f.title,
								className: "h-full w-full object-cover",
								loading: "lazy",
								decoding: "async"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full w-full",
								style: { background: `linear-gradient(155deg, ${f.gradient_from ?? "#333"}, ${f.gradient_to ?? "#111"})` }
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex min-w-0 flex-1 flex-col justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${countdown.isPast ? "bg-forest-deep/20 text-forest-deep" : "bg-primary/15 text-primary"}`,
									children: countdown.text
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 truncate font-serif text-lg font-medium leading-tight transition group-hover:text-primary",
									children: f.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 text-xs text-muted-foreground",
									children: [
										formattedDate,
										" ·",
										" ",
										f.rank > 0 ? `#${f.rank} on the Index` : "Not charted yet"
									]
								})
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex items-center justify-between border-t border-foreground/10 pt-2 text-[10px] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono",
									children: ["Score ", f.score?.toFixed(1) ?? "—"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-primary",
									children: "View Insights →"
								})]
							})]
						})]
					}, f.slug);
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-8 px-4 lg:px-6",
			children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: [...Array(6)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-4 flex gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-36 w-24 rounded-xl shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 space-y-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-6 w-3/4" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-1/2" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-12 w-full" })
						]
					})]
				}, i))
			}) : displayMovies.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: displayMovies.map((m) => {
					const poster = tmdbPosterUrl(m.poster_path, "w342");
					const countdown = getDaysUntil(m.release_date);
					const formattedDate = m.release_date ? new Date(m.release_date).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric"
					}) : "Release Date TBA";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass card-lift rounded-2xl p-4 flex gap-4 overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/films/$slug",
							params: { slug: slugify(m.title) },
							className: "relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-ink",
							children: poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: poster,
								alt: m.title,
								className: "h-full w-full object-cover",
								loading: "lazy"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground",
								children: m.title
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col justify-between min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex items-center justify-between gap-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${countdown.isPast ? "bg-forest-deep/20 text-forest-deep" : "bg-primary/15 text-primary"}`,
										children: countdown.text
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/films/$slug",
									params: { slug: slugify(m.title) },
									className: "mt-2 block font-serif text-lg font-medium leading-tight hover:text-primary transition truncate",
									children: m.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 flex items-center gap-1.5 text-xs text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "h-3 w-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formattedDate })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed",
									children: m.overview || "Overview coming soon."
								})
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex items-center justify-between border-t border-foreground/10 pt-2 text-[10px] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono",
									children: m.vote_count ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										"★ ",
										m.vote_average?.toFixed(1) ?? "—",
										" · ",
										m.vote_count.toLocaleString(),
										" ",
										"votes"
									] }) : "No viewer votes yet"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/films/$slug",
									params: { slug: slugify(m.title) },
									className: "font-mono text-primary hover:underline",
									children: "View Insights →"
								})]
							})]
						})]
					}, m.id);
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-10 text-center text-sm text-muted-foreground",
				children: "No upcoming releases found matching the selected filter."
			})
		})
	] });
}
//#endregion
export { CalendarPage as component };
