import { p as getTrendingFilms } from "./apiClient-BBCAVRqq.mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { o as TrendingUp, y as MessageCircle } from "../_libs/lucide-react.mjs";
import { n as Layout } from "./Layout-BTCUhU4D.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/trending-D0YXI_zP.js
var import_jsx_runtime = require_jsx_runtime();
function FilmPosterCell({ film }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative h-20 w-14 shrink-0 overflow-hidden rounded-lg",
		style: { background: `linear-gradient(155deg, ${film.gradient_from ?? "#2a2a2a"}, ${film.gradient_to ?? "#111"})` },
		children: film.poster_url && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: film.poster_url,
			alt: film.title,
			className: "absolute inset-0 h-full w-full object-cover",
			loading: "lazy"
		})
	});
}
function TrendingPage() {
	const { data: films, isLoading, error } = useQuery({
		queryKey: ["trending", "films"],
		queryFn: () => getTrendingFilms(20),
		staleTime: 300 * 1e3
	});
	const maxMentions = Math.max(...films?.map((f) => f.mentions_24h) ?? [1], 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "px-4 pt-6 lg:px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "Conversations"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-serif text-5xl lg:text-6xl",
					children: "Trending Now"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-xl text-sm text-muted-foreground",
					children: "Films the world is actively discussing — ranked by audience engagement velocity across reviews, social media, and viewer communities."
				})
			]
		}),
		error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-10 mx-4 lg:mx-6 glass rounded-2xl p-6 text-center text-sm text-muted-foreground",
			children: "Unable to load trending films. Please try again later."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-10 px-4 lg:px-6",
			children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-3",
				children: [...Array(10)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "glass rounded-2xl p-4 flex items-center gap-4 animate-pulse",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-20 w-14 rounded-lg bg-foreground/10 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1 space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-5 w-48 rounded bg-foreground/10" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-3 w-32 rounded bg-foreground/10" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-2 w-full rounded-full bg-foreground/10" })
						]
					})]
				}, i))
			}) : films && films.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-3",
				children: films.map((film, i) => {
					const mentions = film.mentions_24h;
					const mentionsLabel = mentions >= 1e3 ? `${(mentions / 1e3).toFixed(1)}k` : String(mentions);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: film.film_slug },
						className: "glass card-lift flex items-start gap-4 rounded-2xl p-4 transition-all hover:ring-1 hover:ring-primary/30",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "hidden sm:grid h-8 w-8 shrink-0 place-items-center font-mono text-lg tabular text-muted-foreground",
								children: String(i + 1).padStart(2, "0")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterCell, { film }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-serif text-xl leading-tight",
										children: film.title
									}),
									film.director && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-0.5 text-xs text-muted-foreground",
										children: [film.director, film.year ? ` · ${film.year}` : ""]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 flex items-start gap-1.5 text-[11px] font-medium leading-snug text-primary",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "mt-0.5 h-3 w-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: film.trend_reason })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 flex flex-wrap gap-1.5",
										children: film.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] text-muted-foreground",
											children: tag
										}, tag))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex-1 h-1.5 overflow-hidden rounded-full bg-foreground/10",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-full rounded-full bg-primary transition-all duration-700",
												style: { width: `${mentions / maxMentions * 100}%` }
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1 font-mono text-[10px] text-muted-foreground shrink-0",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "h-3 w-3" }),
												mentionsLabel,
												" signals"
											]
										})]
									})
								]
							})
						]
					}) }, film.film_slug);
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-10 text-center text-sm text-muted-foreground",
				children: "No trending films yet — titles appear once they accumulate enough real audience signal to clear the evidence floor."
			})
		})
	] });
}
//#endregion
export { TrendingPage as component };
