import { i as getNewEntries } from "./apiClient-BWlqrju0.mjs";
import { u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { l as Sparkles, z as CalendarClock } from "../_libs/lucide-react.mjs";
import { n as Layout, t as FilmPosterThumbnail } from "./Layout-CBXeDHAE.mjs";
import { t as FilmCardSkeleton } from "./Skeletons-JkDOzhQ6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/new-entries-DOTXNWR_.js
var import_jsx_runtime = require_jsx_runtime();
function formatDate(iso) {
	if (!iso) return "Date TBA";
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric"
	});
}
function FilmCard({ film }) {
	const director = film.director && film.director !== "Unknown" ? film.director : "Director TBA";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass card-lift overflow-hidden rounded-2xl",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative aspect-[2/3] overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
					film,
					className: "h-full w-full rounded-none"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute left-3 top-3 rounded-md bg-live px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink z-10",
					children: "New"
				}),
				film.rank > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute right-3 top-3 z-10 rounded-md bg-black/50 px-2 py-1 font-mono text-xs text-white backdrop-blur",
					children: ["#", film.rank]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-x-3 bottom-3 text-white z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 font-mono text-xs text-white/80",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarClock, { className: "h-3 w-3" }), formatDate(film.release_date)]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-0.5 font-serif text-xl leading-tight",
						children: film.title
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-3 text-xs text-muted-foreground",
			children: director
		})]
	});
}
function NewEntriesPage() {
	const { data: films, isLoading, error } = useQuery({
		queryKey: ["films", "new-entries"],
		queryFn: () => getNewEntries(),
		staleTime: 300 * 1e3
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "px-4 pt-6 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: "Debuts"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-serif text-5xl lg:text-6xl",
				children: "New Entries"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-xl text-sm text-muted-foreground",
				children: "Movies that just hit theaters — every new release on the Index from the last 30 days."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/calendar",
				className: "mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline",
				children: "See what's coming next on Now & Next →"
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-10 px-4 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "Released in the last 30 days"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 font-serif text-3xl",
					children: "New This Month"
				})] })]
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-6 text-center text-sm text-muted-foreground",
				children: "Unable to load data. Please try again later."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: isLoading ? [...Array(8)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmCardSkeleton, {}, i)) : films?.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmCard, { film: f }, f.slug))
			}),
			!isLoading && films?.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-10 text-center text-sm text-muted-foreground",
				children: "No films have been released in the last month yet. Check back after the next ingest cycle."
			})
		]
	})] });
}
//#endregion
export { NewEntriesPage as component };
