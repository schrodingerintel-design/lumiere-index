import { n as __toESM } from "../_runtime.mjs";
import { a as getNewReleaseFilms, f as getTopFilms } from "./apiClient-B3VnLWzJ.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { B as Bookmark, K as ArrowRight, V as BookmarkX, d as ShieldCheck, m as Scale } from "../_libs/lucide-react.mjs";
import { n as Layout } from "./Layout-Dneaa4IB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watchlist-S6D6uZiQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function gradientStyle(film) {
	return `linear-gradient(155deg, ${film.gradient_from ?? "#2a2a2a"}, ${film.gradient_to ?? "#111"})`;
}
function WatchlistPage() {
	const [savedSlugs, setSavedSlugs] = (0, import_react.useState)([]);
	const [isLoaded, setIsLoaded] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			setSavedSlugs(JSON.parse(localStorage.getItem("lumiere_watchlist") ?? "[]"));
		} catch {
			setSavedSlugs([]);
		}
		setIsLoaded(true);
	}, []);
	const removeSlug = (slug) => {
		const next = savedSlugs.filter((s) => s !== slug);
		setSavedSlugs(next);
		localStorage.setItem("lumiere_watchlist", JSON.stringify(next));
	};
	const clearAll = () => {
		setSavedSlugs([]);
		localStorage.removeItem("lumiere_watchlist");
	};
	const { data: topFilms = [], isLoading: topLoading } = useQuery({
		queryKey: [
			"films",
			"top",
			100
		],
		queryFn: () => getTopFilms(100),
		staleTime: 300 * 1e3
	});
	const { data: newReleases = [], isLoading: newLoading } = useQuery({
		queryKey: [
			"films",
			"new-releases",
			100
		],
		queryFn: () => getNewReleaseFilms(100),
		staleTime: 300 * 1e3
	});
	const allFilmsMap = /* @__PURE__ */ new Map();
	for (const f of [...topFilms, ...newReleases]) if (!allFilmsMap.has(f.slug)) allFilmsMap.set(f.slug, f);
	const savedFilms = savedSlugs.map((slug) => allFilmsMap.get(slug)).filter((f) => f !== void 0);
	const isLoading = !isLoaded || savedSlugs.length > 0 && topLoading && newLoading;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "px-4 pt-6 lg:px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "h-3.5 w-3.5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Personal Tracking" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-serif text-5xl lg:text-6xl",
					children: "My Watchlist"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-xl text-sm text-muted-foreground",
					children: "Films you are monitoring. Track score shifts, audience sentiment, and momentum across the Index."
				})
			] }), savedFilms.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: clearAll,
				className: "flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-4 py-2 font-mono text-xs text-muted-foreground transition hover:border-foreground/30 hover:bg-foreground/10 hover:text-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookmarkX, { className: "h-3.5 w-3.5" }),
					"Clear All (",
					savedFilms.length,
					")"
				]
			})]
		})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mt-10 px-4 lg:px-6",
		children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
			children: [...Array(4)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-4 flex gap-4 animate-pulse",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-36 w-24 rounded-xl bg-foreground/10 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 space-y-3 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-5 w-3/4 rounded bg-foreground/10" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-1/2 rounded bg-foreground/10" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-8 w-full rounded bg-foreground/10 mt-4" })
					]
				})]
			}, i))
		}) : savedFilms.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "h-7 w-7" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-serif text-2xl text-foreground",
					children: "Your watchlist is empty"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted-foreground leading-relaxed",
					children: [
						"Save films by clicking the ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Save" }),
						" button on any film page to track their audience signals, rank changes, and cultural velocity here."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pt-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/top-100",
						className: "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-mono text-xs font-semibold text-primary-foreground transition hover:opacity-90",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Explore Top 100 Films" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "h-3.5 w-3.5" })]
					})
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
			children: savedFilms.map((film) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/films/$slug",
				params: { slug: film.slug },
				className: "glass card-lift group flex flex-col overflow-hidden rounded-2xl transition",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative aspect-[2/3] w-full overflow-hidden bg-ink",
					children: [
						film.poster_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: film.poster_url,
							alt: film.title,
							className: "h-full w-full object-cover transition duration-300 group-hover:scale-105",
							loading: "lazy"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full w-full flex items-center justify-center p-4 text-center text-sm text-muted-foreground",
							style: { background: gradientStyle(film) },
							children: film.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" }),
						film.rank > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 font-mono text-xs font-bold text-primary backdrop-blur",
							children: ["#", film.rank]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "absolute inset-x-3 bottom-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-serif text-lg font-medium text-white leading-tight",
								children: film.title
							})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-xs text-muted-foreground",
							children: [
								film.director || "Director TBA",
								" · ",
								film.year || "—"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 font-mono text-sm text-primary font-semibold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Score ", film.score?.toFixed(1) ?? "—"] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 font-mono text-[10px] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "h-3 w-3" }), "Compare"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: (e) => {
									e.preventDefault();
									e.stopPropagation();
									removeSlug(film.slug);
								},
								title: "Remove from watchlist",
								className: "flex items-center gap-1 rounded-lg border border-foreground/10 bg-foreground/5 px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition hover:border-down/30 hover:bg-down/10 hover:text-down",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookmarkX, { className: "h-3 w-3" }), "Remove"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between border-t border-foreground/10 pt-3 font-mono text-[10px] text-muted-foreground transition group-hover:text-primary",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "View Signal Breakdown" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "→" })]
						})
					]
				})]
			}, film.slug))
		})
	})] });
}
//#endregion
export { WatchlistPage as component };
