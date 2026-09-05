import { n as __toESM } from "../_runtime.mjs";
import { a as getNewReleaseFilms, f as getTopFilms } from "./apiClient-OpsbjiRR.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { A as Film, D as Ghost, T as Heart, f as ShieldAlert, h as Rocket, k as Flame, l as Sparkles, u as Smile } from "../_libs/lucide-react.mjs";
import { n as Layout } from "./Layout-B2NEJ6Q7.mjs";
import { a as Skeleton } from "./Skeletons-JkDOzhQ6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/genres-pAJggGbl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var GENRES = [
	{
		id: "action",
		name: "Action",
		icon: Flame,
		color: "from-red-500/15 to-amber-500/10 text-red-500",
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("war") || s.includes("race") || s.includes("fight") || s.includes("battle") || s.includes("mission") || s.includes("soldier") || s.includes("combat") || t.includes("f1") || t.includes("superman") || t.includes("warfare") || t.includes("mission impossible") || t.includes("captain america") || t.includes("thunderbolts");
		}
	},
	{
		id: "scifi",
		name: "Sci-Fi",
		icon: Rocket,
		color: "from-blue-500/15 to-cyan-500/10 text-blue-500",
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("alien") || s.includes("space") || s.includes("future") || s.includes("robot") || s.includes("clone") || s.includes("planet") || t.includes("dune") || t.includes("alien") || t.includes("avatar") || t.includes("mickey 17") || t.includes("elio") || t.includes("klara");
		}
	},
	{
		id: "thriller",
		name: "Thriller",
		icon: Ghost,
		color: "from-emerald-500/15 to-teal-500/10 text-emerald-500",
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("thriller") || s.includes("mystery") || s.includes("murder") || s.includes("conspiracy") || s.includes("crime") || s.includes("detective") || s.includes("framed") || s.includes("spy") || s.includes("serial") || t.includes("black bag") || t.includes("accountant") || t.includes("novocaine");
		}
	},
	{
		id: "comedy",
		name: "Comedy",
		icon: Smile,
		color: "from-amber-500/15 to-yellow-500/10 text-amber-500",
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("comedy") || s.includes("hilarious") || s.includes("laugh") || s.includes("funny") || s.includes("humorous") || t.includes("minecraft") || t.includes("bugonia");
		}
	},
	{
		id: "drama",
		name: "Drama",
		icon: Film,
		color: "from-purple-500/15 to-indigo-500/10 text-purple-500",
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("family") || s.includes("relationship") || s.includes("biography") || s.includes("historical") || s.includes("social") || s.includes("struggles") || t.includes("anora") || t.includes("wicked") || t.includes("conclave") || t.includes("brutalist") || t.includes("complete unknown") || t.includes("michael") || t.includes("lilo") || t.includes("snow white") || t.includes("the bride");
		}
	},
	{
		id: "romance",
		name: "Romance",
		icon: Heart,
		color: "from-pink-500/15 to-rose-500/10 text-pink-500",
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			return s.includes("love") || s.includes("romance") || s.includes("relationship") || s.includes("wedding") || s.includes("heart") || s.includes("couple") || s.includes("affair") || s.includes("marry") || s.includes("dating");
		}
	},
	{
		id: "animation",
		name: "Animation",
		icon: Sparkles,
		color: "from-indigo-500/15 to-blue-500/10 text-indigo-500",
		matches: (f) => {
			(f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return t.includes("elio") || t.includes("lilo") || t.includes("minecraft") || t.includes("dragon") || t.includes("inside out") || t.includes("karate kid");
		}
	},
	{
		id: "horror",
		name: "Horror",
		icon: ShieldAlert,
		color: "from-orange-500/15 to-red-500/10 text-orange-500",
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("horror") || s.includes("vampire") || s.includes("ghost") || s.includes("demon") || s.includes("monster") || s.includes("dead") || s.includes("zombie") || s.includes("supernatural") || s.includes("cult") || t.includes("nosferatu") || t.includes("sinners") || t.includes("heretic") || t.includes("28 years") || t.includes("until dawn") || t.includes("death of a unicorn") || t.includes("final destination") || t.includes("substance");
		}
	}
];
function GenresPage() {
	const [selectedGenre, setSelectedGenre] = (0, import_react.useState)(GENRES[0]);
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
	const isLoading = topLoading || newLoading;
	const allFilms = (0, import_react.useMemo)(() => {
		const seen = /* @__PURE__ */ new Set();
		const merged = [];
		for (const f of [...topFilms, ...newReleases]) if (!seen.has(f.slug)) {
			seen.add(f.slug);
			merged.push(f);
		}
		return merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
	}, [topFilms, newReleases]);
	const filteredFilms = (0, import_react.useMemo)(() => allFilms.filter((f) => selectedGenre.matches(f)), [allFilms, selectedGenre]);
	const displayFilms = (0, import_react.useMemo)(() => {
		if (filteredFilms.length >= 5) return filteredFilms;
		const filteredSlugs = new Set(filteredFilms.map((f) => f.slug));
		const supplements = allFilms.filter((f) => !filteredSlugs.has(f.slug)).slice(0, 20 - filteredFilms.length);
		return [...filteredFilms, ...supplements];
	}, [filteredFilms, allFilms]);
	const ActiveIcon = selectedGenre.icon;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "px-4 pt-6 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: "Categories"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-serif text-5xl lg:text-6xl",
				children: "By Genre"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-xl text-sm text-muted-foreground",
				children: "Explore cultural rankings and top titles segmented across film genres."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "no-scrollbar mt-6 flex gap-2.5 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0",
				children: GENRES.map((g) => {
					const Icon = g.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setSelectedGenre(g),
						className: `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${selectedGenre.id === g.id ? "bg-primary text-primary-foreground shadow-md" : "glass border border-foreground/10 text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: g.name })]
					}, g.id);
				})
			})
		]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8 px-4 lg:px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex items-center justify-between border-b border-foreground/10 pb-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${selectedGenre.color}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ActiveIcon, { className: "h-5 w-5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "font-serif text-2xl",
					children: [
						"Top ",
						selectedGenre.name,
						" Films"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"Ranked by Index score · ",
						displayFilms.length,
						" titles tracked"
					]
				})] })]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6",
			children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
				children: [...Array(10)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "aspect-[2/3] w-full rounded-xl" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-4 w-3/4" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-1/2" })
					]
				}, i))
			}) : displayFilms.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
				children: displayFilms.map((film, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/films/$slug",
					params: { slug: film.slug },
					className: "card-lift group relative block overflow-hidden rounded-xl glass border border-foreground/10 p-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink",
						children: [
							film.poster_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: film.poster_url,
								alt: film.title,
								className: "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
								loading: "lazy"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground",
								style: { background: `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})` },
								children: film.title
							}),
							film.rank > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary backdrop-blur",
								children: ["#", film.rank]
							}),
							i < filteredFilms.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 font-mono text-[9px] font-bold text-white backdrop-blur",
								children: selectedGenre.name
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2.5 px-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate font-serif text-base font-medium leading-tight group-hover:text-primary transition",
							children: film.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5 flex items-center justify-between gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs text-muted-foreground",
								children: film.year || "—"
							}), film.score > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-xs text-primary font-semibold",
								children: film.score.toFixed(0)
							})]
						})]
					})]
				}, film.slug))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-10 text-center text-sm text-muted-foreground",
				children: [
					"No movies found for ",
					selectedGenre.name,
					"."
				]
			})
		})]
	})] });
}
//#endregion
export { GenresPage as component };
