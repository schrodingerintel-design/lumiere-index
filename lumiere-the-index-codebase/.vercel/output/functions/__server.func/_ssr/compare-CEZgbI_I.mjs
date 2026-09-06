import { n as __toESM } from "../_runtime.mjs";
import { f as getTopFilms, h as searchTmdbMovie, s as getTmdbMovieDetails, v as tmdbPosterUrl } from "./apiClient-B3VnLWzJ.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { d as ShieldCheck, m as Scale, p as Search, r as X } from "../_libs/lucide-react.mjs";
import { n as Layout } from "./Layout-Dneaa4IB.mjs";
import { a as Skeleton } from "./Skeletons-JkDOzhQ6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/compare-CEZgbI_I.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function FilmPicker({ value, onSelect, placeholder, films }) {
	const [query, setQuery] = (0, import_react.useState)("");
	const [open, setOpen] = (0, import_react.useState)(false);
	const [focusRequest, setFocusRequest] = (0, import_react.useState)(0);
	const inputRef = (0, import_react.useRef)(null);
	const dropdownRef = (0, import_react.useRef)(null);
	const filtered = query.trim() ? films.filter((f) => f.title.toLowerCase().includes(query.toLowerCase())) : films;
	const { data: tmdb } = useQuery({
		queryKey: [
			"tmdb",
			value?.title,
			value?.year
		],
		queryFn: () => searchTmdbMovie(value.title, value?.year ?? void 0),
		enabled: !!value,
		staleTime: 1440 * 60 * 1e3
	});
	const poster = tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w342");
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const onDown = (e) => {
			const t = e.target;
			const inInput = inputRef.current?.contains(t) ?? false;
			const inDropdown = dropdownRef.current?.contains(t) ?? false;
			if (!inInput && !inDropdown) setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);
	(0, import_react.useEffect)(() => {
		if (focusRequest > 0 && !value) inputRef.current?.focus();
	}, [focusRequest, value]);
	const handleSelect = (f) => {
		onSelect(f);
		setQuery("");
		setOpen(false);
		inputRef.current?.blur();
	};
	const handleChange = () => {
		onSelect(null);
		setQuery("");
		setOpen(true);
		setFocusRequest((n) => n + 1);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [value ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mx-auto w-36 aspect-[2/3] overflow-hidden rounded-2xl bg-ink shadow-lg",
			children: [
				poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: poster,
					alt: value.title,
					className: "h-full w-full object-cover"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full w-full",
					style: { background: `linear-gradient(155deg, ${value.gradient_from ?? "#333"}, ${value.gradient_to ?? "#111"})` }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: handleChange,
					className: "absolute left-2 top-2 rounded-full bg-black/50 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur transition hover:bg-black/80",
					children: "Change"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => onSelect(null),
					"aria-label": `Remove ${value.title}`,
					className: "absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white backdrop-blur transition hover:bg-black/80",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3 w-3" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-x-2 bottom-2 text-white",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-serif text-sm leading-tight",
						children: value.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "font-mono text-[10px] text-white/70",
						children: [
							value.director || "Director TBA",
							" · ",
							value.year
						]
					})]
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mx-auto flex aspect-[2/3] w-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-foreground/15 bg-foreground/[0.03] text-muted-foreground",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "h-6 w-6 opacity-40" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "px-2 text-center text-xs",
					children: "Choose a film"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative w-[80%]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "text",
						value: query,
						placeholder,
						onFocus: () => setOpen(true),
						onChange: (e) => {
							setQuery(e.target.value);
							setOpen(true);
						},
						className: "w-full rounded-lg border border-foreground/15 bg-background/80 py-1.5 pl-7 pr-2 text-xs outline-none transition placeholder:text-muted-foreground focus:border-primary"
					})]
				})
			]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: dropdownRef,
			className: "max-h-64 overflow-y-auto rounded-xl border border-foreground/15 bg-background shadow-2xl",
			children: filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-4 py-3 text-sm text-muted-foreground",
				children: "No films found"
			}) : filtered.slice(0, 20).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				className: "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-foreground/5",
				onClick: () => handleSelect(f),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-10 w-7 shrink-0 overflow-hidden rounded-md",
						style: { background: `linear-gradient(155deg, ${f.gradient_from ?? "#333"}, ${f.gradient_to ?? "#111"})` }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate font-serif",
							children: f.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "font-mono text-[10px] text-muted-foreground",
							children: [
								f.director || "Director TBA",
								" · ",
								f.year
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ml-auto font-mono text-sm text-primary",
						children: f.score?.toFixed(1)
					})
				]
			}, f.slug))
		})]
	});
}
function CompareRow({ label, a, b, format = (v) => v.toFixed(1), higher = "better" }) {
	const aWins = a !== null && b !== null && (higher === "better" ? a > b : a < b);
	const bWins = a !== null && b !== null && (higher === "better" ? b > a : b < a);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-foreground/5 py-3 last:border-0 sm:grid-cols-[1fr_auto_1fr] sm:gap-y-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "col-span-2 text-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:whitespace-nowrap sm:px-2",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `text-left font-mono text-lg tabular sm:col-start-1 sm:row-start-1 sm:text-right ${aWins ? "text-primary font-semibold" : "text-foreground/70"}`,
				children: [a !== null ? format(a) : "—", aWins && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-1.5 text-[10px] text-primary",
					children: "▲"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `text-right font-mono text-lg tabular sm:col-start-3 sm:row-start-1 sm:text-left ${bWins ? "text-primary font-semibold" : "text-foreground/70"}`,
				children: [b !== null ? format(b) : "—", bWins && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ml-1.5 text-[10px] text-primary",
					children: "▲"
				})]
			})
		]
	});
}
function ComparePage() {
	const [filmA, setFilmA] = (0, import_react.useState)(null);
	const [filmB, setFilmB] = (0, import_react.useState)(null);
	const { data: allFilms = [], isLoading } = useQuery({
		queryKey: [
			"films",
			"top",
			100
		],
		queryFn: () => getTopFilms(100),
		staleTime: 300 * 1e3
	});
	(0, import_react.useEffect)(() => {
		if (allFilms.length >= 2 && !filmA && !filmB) {
			setFilmA(allFilms[0]);
			setFilmB(allFilms[1]);
		}
	}, [
		allFilms,
		filmA,
		filmB
	]);
	const { data: tmdbA } = useQuery({
		queryKey: [
			"tmdb",
			"details-compare",
			filmA?.id
		],
		queryFn: async () => {
			const id = (await searchTmdbMovie(filmA.title, filmA?.year ?? void 0)).results?.[0]?.id;
			if (!id) return null;
			return getTmdbMovieDetails(id);
		},
		enabled: !!filmA,
		staleTime: 1440 * 60 * 1e3
	});
	const { data: tmdbB } = useQuery({
		queryKey: [
			"tmdb",
			"details-compare",
			filmB?.id
		],
		queryFn: async () => {
			const id = (await searchTmdbMovie(filmB.title, filmB?.year ?? void 0)).results?.[0]?.id;
			if (!id) return null;
			return getTmdbMovieDetails(id);
		},
		enabled: !!filmB,
		staleTime: 1440 * 60 * 1e3
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "px-4 pt-6 lg:px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "h-5 w-5 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "Head to Head"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 font-serif text-5xl lg:text-6xl",
					children: "Compare Films"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-xl text-sm text-muted-foreground",
					children: "Head-to-head analysis comparing Lumière Index Scores, viewer sentiment, audience signals, and box office."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "All scores derived from audience sentiment & viewer engagement signals — 0% critic weight." })]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "mt-8 grid grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "Film A"
				}), isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-40 w-full rounded-xl" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPicker, {
					value: filmA,
					onSelect: setFilmA,
					placeholder: "Search films…",
					films: allFilms
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "Film B"
				}), isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-40 w-full rounded-xl" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPicker, {
					value: filmB,
					onSelect: setFilmB,
					placeholder: "Search films…",
					films: allFilms
				})]
			})]
		}),
		!(!!filmA && !!filmB) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-8 px-4 lg:px-6",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-12 text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "mx-auto h-12 w-12 opacity-20" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-sm text-muted-foreground",
					children: "Select two films to compare — search in either card above."
				})]
			})
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "mt-8 px-4 lg:px-6",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl overflow-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 items-center gap-2 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/films/$slug",
								params: { slug: filmA.slug },
								className: "text-right font-serif text-lg leading-snug hover:text-primary transition sm:truncate sm:text-xl",
								children: filmA.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "hidden px-2 text-center sm:block",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "mx-auto h-5 w-5 text-muted-foreground" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/films/$slug",
								params: { slug: filmB.slug },
								className: "text-left font-serif text-lg leading-snug hover:text-primary transition sm:truncate sm:text-xl",
								children: filmB.title
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-6 py-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Lumière Index Score",
								a: filmA.score,
								b: filmB.score,
								format: (v) => v.toFixed(1)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Audience Mentions (48h)",
								a: filmA.mentions_total,
								b: filmB.mentions_total,
								format: (v) => v.toLocaleString()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Audience Review Volume",
								a: tmdbA?.vote_count ?? null,
								b: tmdbB?.vote_count ?? null,
								format: (v) => v.toLocaleString()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Cultural Velocity",
								a: tmdbA?.popularity ?? null,
								b: tmdbB?.popularity ?? null,
								format: (v) => v.toFixed(0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Index Rank",
								a: filmA.rank,
								b: filmB.rank,
								format: (v) => `#${v}`,
								higher: "worse"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Rank Movement",
								a: filmA.movement ?? 0,
								b: filmB.movement ?? 0,
								format: (v) => v > 0 ? `+${v}` : String(v)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Weeks on Chart",
								a: filmA.weeks_on_chart ?? 1,
								b: filmB.weeks_on_chart ?? 1,
								format: (v) => `${v} ${v === 1 ? "week" : "weeks"}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareRow, {
								label: "Box Office Revenue",
								a: tmdbA?.revenue && tmdbA.revenue > 0 ? tmdbA.revenue : null,
								b: tmdbB?.revenue && tmdbB.revenue > 0 ? tmdbB.revenue : null,
								format: (v) => {
									if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
									if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
									return `$${v.toLocaleString()}`;
								}
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-3 border-t border-foreground/10 bg-foreground/[0.02] px-4 py-4 sm:flex-row sm:px-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/films/$slug",
							params: { slug: filmA.slug },
							className: "flex-1 rounded-xl border border-foreground/10 py-2.5 text-center text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground font-mono",
							children: [filmA.title, " Deep Dive →"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/films/$slug",
							params: { slug: filmB.slug },
							className: "flex-1 rounded-xl border border-foreground/10 py-2.5 text-center text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground font-mono",
							children: [filmB.title, " Deep Dive →"]
						})]
					})
				]
			})
		})
	] });
}
//#endregion
export { ComparePage as component };
