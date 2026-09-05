import { o as getRisingFilms } from "./apiClient-BBCAVRqq.mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { W as ArrowUp, k as Flame, o as TrendingUp } from "../_libs/lucide-react.mjs";
import { n as Layout, t as FilmPosterThumbnail } from "./Layout-BTCUhU4D.mjs";
import { t as FilmCardSkeleton } from "./Skeletons-JkDOzhQ6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rising-N-4LbZh9.js
var import_jsx_runtime = require_jsx_runtime();
function Rising() {
	const { data: films, isLoading, error } = useQuery({
		queryKey: ["films", "rising"],
		queryFn: () => getRisingFilms(),
		staleTime: 300 * 1e3
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "px-4 pt-6 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-primary flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "h-3 w-3" }), "TOP 10 MOMENTUM"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "· Velocity Ranking" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-serif text-5xl lg:text-6xl",
				children: "Top 10 Rising Films"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed",
				children: "The 10 films climbing the Lumière Index fastest right now. Calculated from 24-hour audience mention velocity, positive sentiment shifts, and cross-platform discussion growth."
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-10 grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6",
		children: [
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "col-span-full glass rounded-2xl p-6 text-center text-sm text-muted-foreground",
				children: "Unable to load data. Please try again later."
			}),
			isLoading ? [...Array(6)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmCardSkeleton, {}, i)) : films?.map((f, i) => {
				const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/films/$slug",
					params: { slug: f.slug },
					className: "glass card-lift overflow-hidden rounded-2xl group transition block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative h-48 overflow-hidden",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
								film: f,
								className: "h-full w-full rounded-none"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-xs font-bold text-primary backdrop-blur",
								children: ["#", i + 1]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-mono text-xs text-white backdrop-blur",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3 text-live" }), (f.movement ?? 0) > 0 ? `+${f.movement}` : f.movement]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-serif text-2xl leading-tight group-hover:text-primary transition-colors",
								children: f.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-sm text-muted-foreground",
								children: director
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 flex items-baseline justify-between border-t border-foreground/10 pt-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "h-3 w-3 text-primary" }), "Index Score"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-2xl tabular text-primary font-semibold",
									children: f.score?.toFixed(1)
								})]
							})
						]
					})]
				}, f.slug);
			}),
			!isLoading && films?.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "col-span-full glass rounded-2xl p-10 text-center text-sm text-muted-foreground",
				children: "No rising films in the latest snapshot yet. Check back after the next refresh."
			})
		]
	})] });
}
//#endregion
export { Rising as component };
