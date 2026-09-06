import { a as getNewReleaseFilms } from "./apiClient-B3VnLWzJ.mjs";
import { u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { W as ArrowUp, q as ArrowDown } from "../_libs/lucide-react.mjs";
import { n as Layout, t as FilmPosterThumbnail } from "./Layout-Dneaa4IB.mjs";
import { n as FilmRowSkeleton } from "./Skeletons-JkDOzhQ6.mjs";
import { t as isNewRelease } from "./filmUtils-rHExeiqm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/top-100-Bn7-aVit.js
var import_jsx_runtime = require_jsx_runtime();
function Top100() {
	const { data: films, isLoading, error } = useQuery({
		queryKey: [
			"films",
			"new-releases",
			100
		],
		queryFn: () => getNewReleaseFilms(100),
		staleTime: 300 * 1e3
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "px-4 pt-6 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: [
					"The Index · Daily Ranking ·",
					" ",
					(/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
						month: "long",
						day: "numeric",
						year: "numeric"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-display text-5xl lg:text-6xl",
				children: "The Top 100"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-xl text-sm text-muted-foreground",
				children: "The 100 films currently generating the strongest cultural momentum across audience conversation, attention and visibility."
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-10 px-4 lg:px-6",
		children: [error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "glass rounded-2xl p-6 text-center text-sm text-muted-foreground",
			children: "Unable to load rankings right now. Please try again later."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass-solid overflow-hidden rounded-2xl",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "hidden grid-cols-[64px_64px_1fr_90px_110px_90px] items-center gap-3 border-b border-foreground/10 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Rank" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Mvmt" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Title" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Weeks" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-right",
						children: "Index Score"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-right",
						children: "Signals"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: isLoading ? [...Array(20)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmRowSkeleton, {}, i)) : films?.map((f) => {
				const change = f.movement ?? null;
				const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
				const weeks = f.weeks_on_chart ?? 1;
				const signals = f.mentions_total >= 1e3 ? `${(f.mentions_total / 1e3).toFixed(1)}k` : String(f.mentions_total);
				const isNew = f.prev_rank == null && isNewRelease(f);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/films/$slug",
					params: { slug: f.slug },
					className: "grid grid-cols-[44px_1fr_72px] items-center gap-3 border-b border-foreground/5 px-4 py-3.5 transition hover:bg-foreground/[0.04] sm:grid-cols-[64px_64px_1fr_90px_110px_90px] sm:px-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col items-start gap-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "index-score text-2xl font-semibold sm:text-xl",
								children: String(f.rank).padStart(2, "0")
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sm:hidden",
								children: isNew ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded bg-live px-1 py-0.5 font-mono text-[8px] font-bold uppercase text-ink",
									children: "New"
								}) : change !== null && change !== 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: `flex items-center font-mono text-[10px] tabular ${change > 0 ? "text-forest-deep" : "text-down"}`,
									children: [change > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-2.5 w-2.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-2.5 w-2.5" }), Math.abs(change)]
								}) : null
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "hidden sm:block",
							children: isNew ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink",
								children: "New"
							}) : change !== null && change !== 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: `flex items-center gap-0.5 font-mono text-xs tabular ${change > 0 ? "text-forest-deep" : "text-down"}`,
								children: [change > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-3 w-3" }), Math.abs(change)]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: "—"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
								film: f,
								className: "h-14 w-10 sm:h-12 sm:w-9"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-display text-[15px] font-medium sm:text-lg",
									children: f.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "truncate text-xs text-muted-foreground",
									children: [
										director,
										" · ",
										f.year,
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "sm:hidden",
											children: [
												" ",
												"· ",
												weeks,
												" ",
												weeks === 1 ? "wk" : "wks"
											]
										})
									]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden font-mono text-xs tabular text-muted-foreground sm:block",
							children: [
								weeks,
								" ",
								weeks === 1 ? "wk" : "wks"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "index-score text-xl font-semibold sm:text-lg",
								children: f.score?.toFixed(1)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground sm:hidden",
								children: "Index"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "hidden text-right font-mono text-xs tabular text-muted-foreground font-medium sm:block",
							children: signals
						})
					]
				}) }, f.slug);
			}) })]
		})]
	})] });
}
//#endregion
export { Top100 as component };
