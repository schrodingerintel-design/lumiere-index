import { n as __toESM } from "../_runtime.mjs";
import { _ as tmdbBackdropUrl, a as getNewReleaseFilms, c as getTmdbMovieVideos, f as getTopFilms, h as searchTmdbMovie, i as getNewEntries, o as getRisingFilms, p as getTrendingFilms, v as tmdbPosterUrl } from "./apiClient-B3VnLWzJ.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { A as Film, D as Ghost, F as ChevronRight, I as ChevronLeft, M as ExternalLink, N as Compass, P as CircleAlert, T as Heart, U as Award, W as ArrowUp, a as Trophy, g as Play, h as Rocket, j as Eye, k as Flame, l as Sparkles, o as TrendingUp, q as ArrowDown, s as TrendingDown, t as Zap, u as Smile } from "../_libs/lucide-react.mjs";
import { n as Layout, t as FilmPosterThumbnail } from "./Layout-Dneaa4IB.mjs";
import { i as PulseRowSkeleton, n as FilmRowSkeleton, r as HeroSkeleton, t as FilmCardSkeleton } from "./Skeletons-JkDOzhQ6.mjs";
import { t as isNewRelease } from "./filmUtils-rHExeiqm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CFgEKg0M.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function gradientStyle$3(film) {
	if (!film) return "#333";
	return `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`;
}
/** One-line "why it's here" summary derived from real backend signals. */
function whyItsHere(film) {
	const move = film.movement ?? 0;
	if (film.prev_rank == null) return "New entry — opening-weekend conversation is still building.";
	if (move >= 5) return "Strong word-of-mouth momentum — audience conversation accelerating across platforms.";
	if (move >= 1) return "Steady climb — audience conversation and social mentions trending upward.";
	if (move <= -3) return "Cooling from its peak — still drawing a large conversation base.";
	return "Holding strong — sustained audience attention and visibility this cycle.";
}
function Hero() {
	const { data: films, isLoading: filmsLoading } = useQuery({
		queryKey: [
			"films",
			"top",
			10
		],
		queryFn: () => getTopFilms(10),
		staleTime: 300 * 1e3
	});
	const [activeIndex, setActiveIndex] = (0, import_react.useState)(0);
	const queryClient = useQueryClient();
	const carouselFilms = films?.slice(0, 5) ?? [];
	const activeFilm = carouselFilms[activeIndex] ?? null;
	(0, import_react.useEffect)(() => {
		if (!carouselFilms.length) return;
		for (const film of carouselFilms) {
			const tmdbKey = [
				"tmdb",
				film.title,
				film.year
			];
			queryClient.ensureQueryData({
				queryKey: tmdbKey,
				queryFn: () => searchTmdbMovie(film.title, film.year ?? void 0),
				staleTime: 1440 * 60 * 1e3
			}).then((tmdbData) => {
				const id = tmdbData?.results?.[0]?.id;
				if (id) queryClient.prefetchQuery({
					queryKey: ["tmdb-videos", id],
					queryFn: () => getTmdbMovieVideos(id),
					staleTime: 1440 * 60 * 1e3
				});
			}).catch(() => {});
		}
	}, [carouselFilms, queryClient]);
	const { data: tmdb } = useQuery({
		queryKey: [
			"tmdb",
			activeFilm?.title,
			activeFilm?.year
		],
		queryFn: () => searchTmdbMovie(activeFilm.title, activeFilm?.year ?? void 0),
		enabled: !!activeFilm,
		staleTime: 1440 * 60 * 1e3
	});
	const tmdbFilm = tmdb?.results?.[0];
	const { data: videos } = useQuery({
		queryKey: ["tmdb-videos", tmdbFilm?.id],
		queryFn: () => getTmdbMovieVideos(tmdbFilm.id),
		enabled: !!tmdbFilm?.id,
		staleTime: 1440 * 60 * 1e3
	});
	const trailer = videos?.results?.find((v) => v.type === "Trailer" && v.site === "YouTube") ?? videos?.results?.find((v) => v.site === "YouTube");
	(0, import_react.useEffect)(() => {
		if (carouselFilms.length < 2) return;
		const interval = setInterval(() => {
			setActiveIndex((current) => (current + 1) % carouselFilms.length);
		}, 6e3);
		return () => clearInterval(interval);
	}, [carouselFilms.length]);
	if (filmsLoading || !films) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeroSkeleton, {});
	const posterUrl = activeFilm?.poster_url || tmdbPosterUrl(tmdbFilm?.poster_path, "w500");
	const backdropUrl = activeFilm?.backdrop_url || tmdbBackdropUrl(tmdbFilm?.backdrop_path, "w1280");
	const director = activeFilm?.director && activeFilm.director !== "Unknown" ? activeFilm.director : "Director TBA";
	const score = activeFilm?.score ?? null;
	const move = activeFilm?.movement ?? 0;
	const isNew = activeFilm?.prev_rank == null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "relative w-full overflow-hidden rounded-2xl px-4 lg:px-6 mt-4 max-w-full",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute inset-0",
			children: [
				backdropUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: backdropUrl,
					alt: "",
					className: "absolute inset-0 h-full w-full object-cover object-center",
					fetchPriority: "high",
					decoding: "async"
				}, backdropUrl) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0",
					style: { background: gradientStyle$3(activeFilm) }
				}, activeFilm?.slug),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/25" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 py-8 sm:p-8 lg:p-10 min-h-[460px] lg:min-h-[540px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col justify-center lg:col-span-7 animate-fade-up",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2.5 mb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "h-3.5 w-3.5" }), "#1 on the Index"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm",
							children: "Daily ranking"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.98] text-white drop-shadow-lg line-clamp-3",
						children: activeFilm?.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex items-center gap-4 sm:gap-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "index-score text-6xl sm:text-7xl lg:text-8xl font-medium leading-none drop-shadow-md",
								children: score?.toFixed(1) ?? "—"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-0.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/75",
									children: "Index"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/75",
									children: "Score"
								})]
							})]
						}), score != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `flex items-center gap-1 rounded-full border px-2.5 py-1.5 font-mono text-xs font-medium ${isNew ? "border-live/50 bg-live/15 text-live" : move > 0 ? "border-up/50 bg-up/15 text-up" : move < 0 ? "border-down/50 bg-down/15 text-down" : "border-white/25 bg-black/35 text-white/80"}`,
							children: isNew ? "NEW" : move > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3.5 w-3.5" }),
								" +",
								move
							] }) : move < 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-3.5 w-3.5" }),
								" ",
								move
							] }) : "HOLDING"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 max-w-xl text-sm sm:text-[15px] font-medium leading-relaxed text-white/90",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-primary font-mono text-[10px] uppercase tracking-[0.2em] block mb-1",
							children: "Why it's here"
						}), activeFilm ? whyItsHere(activeFilm) : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-x-2 text-[13px] text-white/60 font-mono",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: director }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white/30",
								children: "·"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeFilm?.year ?? "—" }),
							activeFilm?.country_origin && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white/30",
								children: "·"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeFilm.country_origin })] }),
							(activeFilm?.weeks_on_chart ?? 0) > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white/30",
								children: "·"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								activeFilm?.weeks_on_chart,
								" ",
								activeFilm?.weeks_on_chart === 1 ? "week" : "weeks",
								" on chart"
							] })] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex flex-wrap items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/films/$slug",
							params: { slug: activeFilm?.slug ?? "" },
							className: "inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90",
							children: ["Compare this title", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-4 w-4" })]
						}), trailer && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: `https://www.youtube.com/watch?v=${trailer.key}`,
							target: "_blank",
							rel: "noopener noreferrer",
							className: "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/60",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-4 w-4" }),
								"Watch Trailer",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3 w-3 opacity-50" })
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex items-center gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveIndex((curr) => (curr - 1 + carouselFilms.length) % carouselFilms.length),
								className: "flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-all",
								"aria-label": "Previous film",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-5 w-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-2",
								children: carouselFilms.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setActiveIndex(i),
									className: `h-2 rounded-full transition-all duration-300 ${i === activeIndex ? "w-6 bg-primary" : "w-2 bg-white/30 hover:bg-white/50"}`,
									"aria-label": `View ${f.title}`
								}, f.slug))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveIndex((curr) => (curr + 1) % carouselFilms.length),
								className: "flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-all",
								"aria-label": "Next film",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-5 w-5" })
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hidden lg:flex lg:col-span-5 items-center justify-end animate-fade-up delay-100",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex items-end gap-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-end gap-1 pb-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "index-score text-5xl font-medium leading-none",
								children: score?.toFixed(1) ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[10px] uppercase tracking-[0.22em] text-white/70",
								children: "Index Score"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-[11px] text-white/60",
								children: [
									"#",
									activeFilm?.rank,
									" of the daily Top 100"
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: activeFilm?.slug ?? "" },
						className: "card-lift relative block w-56 overflow-hidden rounded-xl shadow-2xl",
						children: [posterUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: posterUrl,
							alt: activeFilm?.title,
							className: "h-full w-full object-cover aspect-[2/3]",
							fetchPriority: "high",
							decoding: "async"
						}, posterUrl) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "aspect-[2/3]",
							style: { background: gradientStyle$3(activeFilm) }
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-display text-base font-semibold leading-tight text-white drop-shadow",
								children: activeFilm?.title
							})
						})]
					})]
				})
			})]
		})]
	});
}
function gradientStyle$2(from, to) {
	return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}
/** One Index-specific line per card — what the ranking says about this film. */
function indexNote(film) {
	if (film.prev_rank == null) return "New entry";
	const move = film.movement ?? 0;
	if (move >= 5) return `↑ ${move} positions this cycle`;
	if (move >= 1) return `↑ ${move} position${move === 1 ? "" : "s"} this cycle`;
	if (move <= -1) return `↓ ${Math.abs(move)} this cycle`;
	return null;
}
function PosterCard({ film, width = 140 }) {
	const change = film.movement ?? null;
	const isNew = film.prev_rank == null && isNewRelease(film);
	const { data: tmdb } = useQuery({
		queryKey: [
			"tmdb",
			film.title,
			film.year
		],
		queryFn: () => searchTmdbMovie(film.title, film.year ?? void 0),
		enabled: !film.poster_url && !!film.title,
		staleTime: 1440 * 60 * 1e3,
		retry: false
	});
	const posterUrl = film.poster_url || tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w342");
	const note = indexNote(film);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/films/$slug",
		params: { slug: film.slug },
		className: "card-lift group block shrink-0",
		style: { width },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative aspect-[2/3] overflow-hidden rounded-xl bg-ink",
			style: { background: gradientStyle$2(film.gradient_from, film.gradient_to) },
			children: [
				posterUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: posterUrl,
					alt: film.title,
					className: "absolute inset-0 h-full w-full object-cover",
					loading: "lazy",
					decoding: "async"
				}),
				!posterUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 opacity-30 mix-blend-overlay",
					style: { backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,.5), transparent 50%)" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute left-2 top-2 flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "rounded-md border border-white/20 bg-black/60 px-2 py-1 font-mono text-xs font-medium text-white backdrop-blur-sm",
						children: ["#", film.rank]
					}), isNew ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-md bg-live px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink",
						children: "New"
					}) : change !== 0 && change !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: `flex items-center rounded-md px-1.5 py-1 font-mono text-[10px] font-medium ${change > 0 ? "bg-up/90 text-ink" : "bg-down/90 text-white"}`,
						children: [change > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-3 w-3" }), Math.abs(change)]
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute right-2 top-2 rounded-full bg-primary px-2 py-1 font-mono text-[12px] font-bold leading-none text-primary-foreground shadow",
					children: film.score?.toFixed(1)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-display text-lg font-semibold leading-tight text-white drop-shadow",
						children: film.title
					}), note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-live",
						children: note
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-2 px-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: "Index Score"
			})
		})]
	});
}
/** Rank + movement cell shared by desktop and mobile rows. */
function MovementBadge({ film }) {
	const change = film.movement ?? null;
	if (film.prev_rank == null && isNewRelease(film)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink",
		children: "New"
	});
	if (change !== null && change !== 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `flex items-center gap-0.5 font-mono text-xs tabular ${change > 0 ? "text-forest-deep" : "text-down"}`,
		children: [change > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-3 w-3" }), Math.abs(change)]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-xs text-muted-foreground",
		children: "—"
	});
}
function Top100Section() {
	const stripRef = (0, import_react.useRef)(null);
	const scrollStrip = (direction) => {
		if (!stripRef.current) return;
		const distance = stripRef.current.clientWidth * .75;
		stripRef.current.scrollBy({
			left: direction === "left" ? -distance : distance,
			behavior: "smooth"
		});
	};
	const { data: films, isLoading, error } = useQuery({
		queryKey: [
			"films",
			"new-releases",
			100
		],
		queryFn: () => getNewReleaseFilms(100),
		staleTime: 300 * 1e3
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-10 px-4 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "The Index · Daily Ranking"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-1 font-display text-3xl",
						children: "The Top 100"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-xl text-sm text-muted-foreground",
						children: "The 100 films currently generating the strongest cultural momentum across audience conversation, attention and visibility."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden gap-1.5 sm:flex",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => scrollStrip("left"),
							className: "flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
							"aria-label": "Scroll posters left",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-4 w-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => scrollStrip("right"),
							className: "flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
							"aria-label": "Scroll posters right",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-4 w-4" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/top-100",
						className: "shrink-0 font-mono text-xs text-muted-foreground transition hover:text-foreground",
						children: "Full list →"
					})]
				})]
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-6 text-center text-sm text-muted-foreground",
				children: "Unable to load rankings. Please try again later."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-2.5 lg:hidden",
				children: isLoading ? [...Array(6)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "glass-soft rounded-xl p-3 flex items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-9 w-9 bg-foreground/10 animate-pulse rounded" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-16 w-11 bg-foreground/10 animate-pulse rounded-md" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-32 bg-foreground/10 animate-pulse rounded" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-3 w-24 bg-foreground/10 animate-pulse rounded" })]
						})
					]
				}, i)) : films?.slice(0, 10).map((f) => {
					const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
					const weeks = f.weeks_on_chart ?? 1;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: f.slug },
						className: "glass-soft card-lift flex items-center gap-3 rounded-xl p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex w-9 shrink-0 flex-col items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "index-score text-xl font-semibold",
									children: String(f.rank).padStart(2, "0")
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MovementBadge, { film: f })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
								film: f,
								className: "h-16 w-11"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-display text-[15px] font-medium leading-snug",
									children: f.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-0.5 truncate text-xs text-muted-foreground",
									children: [
										director,
										" · ",
										f.year,
										" · ",
										weeks,
										" ",
										weeks === 1 ? "wk" : "wks"
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "shrink-0 text-right",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "index-score text-2xl font-semibold leading-none",
									children: f.score?.toFixed(1)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground",
									children: "Index"
								})]
							})
						]
					}) }, f.slug);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "hidden lg:block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: stripRef,
					className: "no-scrollbar -mx-4 overflow-x-auto px-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-4 pb-6",
						children: isLoading ? [...Array(10)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							style: { width: 140 },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmCardSkeleton, {})
						}, i)) : films?.slice(0, 10).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PosterCard, { film: f }, f.slug))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass-solid rounded-2xl",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sticky top-0 z-10 grid grid-cols-[70px_64px_1fr_90px_110px] items-center gap-3 rounded-t-2xl border-b border-foreground/10 bg-background/95 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Rank" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Mvmt" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Title" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Weeks" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-right",
								children: "Index Score"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "max-h-[480px] overflow-y-auto",
						children: isLoading ? [...Array(10)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmRowSkeleton, {}, i)) : films?.slice(0, 10).map((f) => {
							const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
							const weeks = f.weeks_on_chart ?? 1;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/films/$slug",
								params: { slug: f.slug },
								className: "grid grid-cols-[70px_64px_1fr_90px_110px] items-center gap-3 border-b border-foreground/5 px-5 py-3.5 transition hover:bg-foreground/[0.04]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "index-score text-2xl font-semibold",
										children: String(f.rank).padStart(2, "0")
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MovementBadge, { film: f }) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
											film: f,
											className: "h-12 w-9"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "truncate font-display text-base font-medium",
												children: f.title
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "truncate text-xs text-muted-foreground",
												children: [
													director,
													" · ",
													f.year
												]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-mono text-xs tabular text-muted-foreground",
										children: [
											weeks,
											" ",
											weeks === 1 ? "wk" : "wks"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-right",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "index-score text-xl font-semibold",
											children: f.score?.toFixed(1)
										})
									})
								]
							}) }, f.slug);
						})
					})]
				})]
			}),
			!isLoading && films?.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-10 text-center text-sm text-muted-foreground",
				children: "No new releases charted yet. Films will appear after the next ingest cycle."
			})
		]
	});
}
var PLATFORM_NAMES = {
	reddit: "Reddit",
	tiktok: "TikTok",
	youtube: "YouTube",
	news: "news outlets",
	letterboxd: "Letterboxd",
	trends: "Google Trends",
	wikipedia: "Wikipedia"
};
function platformName(key) {
	if (!key) return null;
	return PLATFORM_NAMES[key.toLowerCase()] ?? key;
}
function isConfident(film) {
	return film.confidence === "moderate" || film.confidence === "high";
}
function isHigh(film) {
	return film.confidence === "high";
}
function driverLabel(film, isHeadline, rank) {
	const label = film.driver_label ?? null;
	if (!label || !isConfident(film)) return "Not enough signal yet";
	if (isHeadline && isHigh(film) && film.headline_eligible) return `#${String(rank).padStart(2, "0")} ${label}`;
	return label;
}
function DriverIcon({ driver, className }) {
	if (driver === "momentum") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className });
	if (driver === "declining") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingDown, { className });
	if (driver === "recency") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className });
	if (driver === "engagement") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className });
}
function editorialHeadline(top) {
	const confidence = top.confidence ?? "insufficient";
	const driver = top.dominant_driver ?? null;
	const delta = top.attention_delta_pct ?? null;
	const deltaStr = delta == null ? null : `${delta != null && delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`;
	const platform = platformName(top.top_platform);
	const sample = top.sample_size ?? 0;
	if (confidence === "insufficient") return "Just entered tracking — not enough signal yet";
	if (confidence === "low") return `Limited early signal — ${top.title} just started registering audience mentions`;
	if (driver === "recency") return `${top.title} opens strong — drawing ${sample.toLocaleString()} signals in its first days`;
	if (driver === "momentum") return deltaStr ? `${top.title} surging ${deltaStr}${platform ? ` on ${platform}` : ""}` : `${top.title} surging — momentum building${platform ? ` on ${platform}` : ""}`;
	if (driver === "declining") return delta != null && delta < 0 ? `${top.title} cools — conversation down ${Math.abs(delta).toFixed(0)}% from peak` : `${top.title} cooling after earlier momentum`;
	if (driver === "engagement") return `${top.title} holds with deep audience engagement — ${top.score.toFixed(1)} Index Score`;
	if (isHigh(top) && top.headline_eligible) return deltaStr ? `${top.title} anchors the Index — ${deltaStr} conversation this cycle` : `${top.title} anchors the Index — ${sample.toLocaleString()} signals tracked`;
	return deltaStr ? `${top.title} holds steady — ${deltaStr} conversation this cycle` : `${top.title} holds steady — ${sample.toLocaleString()} signals tracked`;
}
function editorialBody(top) {
	return top.trend_reason || "";
}
function spotlightCopy(film) {
	const confidence = film.confidence ?? "insufficient";
	const driver = film.dominant_driver ?? null;
	const delta = film.attention_delta_pct ?? null;
	const deltaStr = delta == null ? null : `${delta != null && delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`;
	const platform = platformName(film.top_platform);
	const sample = film.sample_size ?? 0;
	if (confidence === "insufficient") return "Just entered tracking — not enough signal yet";
	if (confidence === "low") {
		const noun = sample === 1 ? "mention" : "mentions";
		return `Limited early signal — ${sample.toLocaleString()} ${noun} tracked so far`;
	}
	if (driver === "recency") return `Opening window active — ${sample.toLocaleString()} signals over the last 30 days`;
	if (driver === "momentum") return deltaStr ? `Conversation ${deltaStr} over 3 days — rapid rise` : `${film.title} is gaining momentum — ${sample.toLocaleString()} signals tracked`;
	if (driver === "declining") return delta != null && delta < 0 ? `Signal cooling — conversation down ${Math.abs(delta).toFixed(0)}% from peak` : `Cooling after earlier momentum — ${sample.toLocaleString()} signals tracked`;
	if (driver === "engagement") return `High audience intensity — ${film.score.toFixed(1)} Index Score holding strong`;
	return `${sample.toLocaleString()} signals tracked over the last 30 days${platform ? `, led by ${platform}` : ""}`;
}
function EditorialInsight({ films }) {
	const spotlightFilms = films.slice(0, 3);
	const weekLabel = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric"
	});
	if (spotlightFilms.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mt-4 px-4 lg:px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-foreground/[0.06] to-primary/5 dark:via-ink/80 p-6 lg:p-8 flex items-center gap-4 text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-5 w-5 text-primary shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm",
				children: "Editorial Briefing — not enough audience signal yet. Briefs appear once titles clear the evidence floor."
			})]
		})
	});
	const headlineIdx = spotlightFilms.findIndex((f) => f.headline_eligible);
	const top = spotlightFilms[headlineIdx === -1 ? 0 : headlineIdx];
	const topPlatform = platformName(top.top_platform);
	const topDelta = top.attention_delta_pct ?? null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mt-4 px-4 lg:px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-foreground/[0.06] to-primary/5 dark:via-ink/80 p-6 lg:p-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Index Editorial Brief · ", weekLabel] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-serif text-3xl lg:text-4xl text-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "italic text-primary",
								children: editorialHeadline(top)
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-sm text-muted-foreground leading-relaxed",
							children: editorialBody(top)
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "shrink-0 flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-5 backdrop-blur max-w-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-xs font-mono text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Signal Breakdown · ", top.title] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "grid grid-cols-2 gap-x-4 gap-y-1 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Index Score"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-right font-mono text-primary font-semibold",
									children: top.score.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "24h mentions"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-right font-mono",
									children: top.mentions_24h.toLocaleString()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "3-day trend"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-right font-mono",
									children: topDelta == null ? "—" : `${topDelta >= 0 ? "+" : ""}${topDelta.toFixed(0)}%`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Driver"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-right font-mono",
									children: top.driver_label ?? "Not enough signal yet"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Top platform"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-right font-mono",
									children: topPlatform ?? "Not enough platform data yet"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Signal volume"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
									className: "text-right font-mono",
									children: [(top.sample_size ?? 0).toLocaleString(), " in 30d"]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] uppercase font-mono text-primary mt-1",
							children: "— Lumière Signal Engine"
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 pt-5 border-t border-foreground/10",
				children: spotlightFilms.map((film, i) => {
					const driver = film.dominant_driver ?? null;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: film.film_slug },
						className: "group rounded-xl border border-foreground/5 bg-foreground/[0.03] p-4 transition hover:bg-foreground/10",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs font-mono text-primary mb-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: driverLabel(film, i === headlineIdx, film.rank) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DriverIcon, {
									driver,
									className: "h-3.5 w-3.5"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-serif text-lg font-medium text-foreground group-hover:text-primary transition-colors",
								children: film.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground line-clamp-2",
								children: spotlightCopy(film)
							}),
							film.tags && film.tags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 flex flex-wrap gap-1",
								children: film.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded px-1.5 py-0.5 font-mono text-[9px] bg-primary/10 text-primary",
									children: tag
								}, tag))
							})
						]
					}, film.film_slug);
				})
			})]
		})
	});
}
function gradientStyle$1(from, to) {
	return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}
function PulseRow() {
	const { data: rising, isLoading: risingLoading } = useQuery({
		queryKey: ["films", "rising"],
		queryFn: () => getRisingFilms(),
		staleTime: 300 * 1e3
	});
	const { data: newEntries } = useQuery({
		queryKey: ["films", "new-entries"],
		queryFn: () => getNewEntries(),
		staleTime: 300 * 1e3
	});
	const { data: trendingFilms } = useQuery({
		queryKey: ["trending", "films"],
		queryFn: () => getTrendingFilms(6),
		staleTime: 300 * 1e3
	});
	if (risingLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PulseRowSkeleton, {});
	const big = rising?.[0];
	const topRising = rising?.slice(0, 3) ?? [];
	const topEntries = newEntries?.slice(0, 5) ?? [];
	const topTrending = trendingFilms?.slice(0, 3) ?? [];
	const maxMentions = Math.max(...topTrending.map((f) => f.mentions_24h), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8 grid grid-cols-1 gap-4 px-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass card-lift flex h-full flex-col overflow-hidden rounded-2xl",
				children: [big ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative h-44 overflow-hidden",
					children: [
						big.poster_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: big.poster_url,
							alt: big.title,
							className: "absolute inset-0 h-full w-full object-cover",
							loading: "lazy",
							decoding: "async"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "absolute inset-0",
							style: { background: gradientStyle$1(big.gradient_from, big.gradient_to) }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white backdrop-blur",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3 text-live" }), " Biggest Mover"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute inset-x-4 bottom-3 text-white",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-serif text-2xl leading-tight",
								children: big.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-white/80",
								children: [
									big.director,
									" ·",
									" ",
									big.prev_rank && big.prev_rank > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
										big.prev_rank,
										" to #",
										big.rank
									] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["New entry — debuts at #", big.rank] })
								]
							})]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-44 bg-foreground/5 flex items-center justify-center text-sm text-muted-foreground",
					children: "No rising films yet"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
						children: "Rising Now"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "space-y-2.5",
						children: [topRising.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-serif",
									children: r.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate text-xs text-muted-foreground",
									children: r.director
								})]
							}), r.is_fallback ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[10px] text-muted-foreground/50 tabular",
								children: "Charted"
							}) : (r.movement ?? 0) !== 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center gap-0.5 font-mono text-xs text-forest-deep tabular",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3" }),
									"+",
									r.movement
								]
							}) : null]
						}, r.slug)), topRising.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-xs text-muted-foreground",
							children: "No data yet"
						})]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass card-lift flex h-full flex-col rounded-2xl p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
						children: "New This Week"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "space-y-3",
					children: [topEntries.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
								film: n,
								className: "h-14 w-10"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-serif text-base",
									children: n.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate text-xs text-muted-foreground",
									children: n.director
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-right",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-mono text-base tabular",
									children: ["#", n.rank]
								}), n.is_fallback ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-[10px] text-muted-foreground/50",
									children: "On Chart"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-[10px] text-live",
									children: "NEW"
								})]
							})
						]
					}, n.slug)), topEntries.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-xs text-muted-foreground",
						children: "No new entries yet"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass card-lift flex h-full flex-col rounded-2xl p-4 md:col-span-2 xl:col-span-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
							children: "What's Trending"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/trending",
						className: "font-mono text-[10px] text-muted-foreground hover:text-foreground",
						children: "See all →"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "space-y-3",
					children: [topTrending.map((film) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: film.film_slug },
						className: "flex items-start gap-3 group",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
							film,
							className: "h-12 w-9"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-serif text-sm group-hover:text-primary transition-colors",
									children: film.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-0.5 text-[10px] text-primary/80 font-medium leading-tight",
									children: film.trend_reason
								}),
								film.tags[0] && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-0.5 font-mono text-[9px] text-muted-foreground",
									children: film.tags[0]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full rounded-full bg-primary",
										style: { width: `${film.mentions_24h / maxMentions * 100}%` }
									})
								})
							]
						})]
					}) }, film.film_slug)), topTrending.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "text-xs text-muted-foreground",
						children: "No trending films yet — cards appear once titles accumulate enough audience signal."
					})]
				})]
			})
		]
	});
}
function gradientStyle(from, to) {
	return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}
var GENRE_CATEGORIES = [
	{
		id: "action",
		title: "Action & High Octane",
		subtitle: "Blockbusters, adrenaline, and explosive cinematic storytelling",
		icon: Flame,
		tag: "Action"
	},
	{
		id: "scifi",
		title: "Sci-Fi & Future Worlds",
		subtitle: "Futuristic visions, space epics, and speculative thrillers",
		icon: Rocket,
		tag: "Sci-Fi"
	},
	{
		id: "horror",
		title: "Horror & the Macabre",
		subtitle: "Night terrors, haunted houses, and dread-soaked suspense",
		icon: Ghost,
		tag: "Horror"
	},
	{
		id: "drama",
		title: "Drama & Character Studies",
		subtitle: "Intimate portraits, social currents, and award-season contenders",
		icon: Award,
		tag: "Drama"
	},
	{
		id: "indie",
		title: "Indie & Festival Gems",
		subtitle: "Festival darlings and auteur masterworks from the circuit",
		icon: Sparkles,
		tag: "Indie"
	},
	{
		id: "animation",
		title: "Animation & Anime",
		subtitle: "Visually breathtaking animated features from around the world",
		icon: Film,
		tag: "Animation"
	},
	{
		id: "romance",
		title: "Romance & longing",
		subtitle: "Love stories, heartbreak, and everything in between",
		icon: Heart,
		tag: "Romance"
	},
	{
		id: "comedy",
		title: "Comedy",
		subtitle: "Satire, absurdity, and big laughs",
		icon: Smile,
		tag: "Comedy"
	}
];
var ROW_LIMIT = 10;
/**
* Build one row per category. Films are assigned to AT MOST ONE collection —
* the first (highest-priority) matching tag wins — and rows only ever contain
* films whose backend genre_tag genuinely matches. A sparse row is shown as
* sparse; we never pad collections with unrelated films.
*/
function buildGenreRows(catalogFilms) {
	const claimed = /* @__PURE__ */ new Set();
	const rows = GENRE_CATEGORIES.map(() => []);
	for (const film of catalogFilms) {
		const filmTag = (film.genre_tag ?? "").trim().toLowerCase();
		if (!filmTag || claimed.has(film.slug)) continue;
		const ci = GENRE_CATEGORIES.findIndex((c) => c.tag.toLowerCase() === filmTag && rows[GENRE_CATEGORIES.indexOf(c)].length < ROW_LIMIT);
		if (ci === -1) continue;
		rows[ci].push(film);
		claimed.add(film.slug);
	}
	return rows;
}
function GenreRow({ category, films }) {
	const scrollRef = (0, import_react.useRef)(null);
	const scroll = (direction) => {
		if (!scrollRef.current) return;
		const distance = scrollRef.current.clientWidth * .75;
		scrollRef.current.scrollBy({
			left: direction === "left" ? -distance : distance,
			behavior: "smooth"
		});
	};
	const Icon = category.icon;
	const cardNote = (film) => {
		if (film.prev_rank == null) return "New entry";
		const move = film.movement ?? 0;
		if (move >= 5) return `↑ ${move} positions this cycle`;
		if (move >= 1) return `↑ ${move} position${move === 1 ? "" : "s"} this cycle`;
		if (move <= -1) return `↓ ${Math.abs(move)} this cycle`;
		return `Holding at #${film.rank}`;
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end justify-between gap-3 px-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "truncate font-display text-xl leading-tight text-foreground",
						children: category.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-xs text-muted-foreground",
						children: category.subtitle
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "hidden shrink-0 items-center gap-1.5 sm:flex",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => scroll("left"),
					className: "flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
					"aria-label": `Scroll ${category.title} left`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-4 w-4" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => scroll("right"),
					className: "flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
					"aria-label": `Scroll ${category.title} right`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-4 w-4" })
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: scrollRef,
			className: "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pt-1 scroll-smooth",
			children: [films.map((film) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/films/$slug",
				params: { slug: film.slug },
				className: "card-lift group relative block w-[140px] shrink-0 snap-start sm:w-[160px]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative aspect-[2/3] overflow-hidden rounded-xl bg-ink",
					children: [
						film.poster_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: film.poster_url,
							alt: film.title,
							className: "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
							loading: "lazy"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-full w-full items-center justify-center p-3 text-center text-xs font-display text-white/90",
							style: { background: gradientStyle(film.gradient_from, film.gradient_to) },
							children: film.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white backdrop-blur-sm border border-white/15",
							children: ["#", film.rank]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 font-mono text-[11px] font-bold text-primary-foreground shadow",
							children: film.score?.toFixed(1)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute inset-x-0 bottom-0 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate font-display text-sm font-semibold text-white drop-shadow",
								children: film.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-0.5 flex items-center justify-between gap-1",
								children: [film.year && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-[10px] text-white/60",
									children: film.year
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-mono text-[9px] uppercase tracking-wide text-live",
									children: cardNote(film)
								})]
							})]
						})
					]
				})
			}, film.slug)), films.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-foreground/10 text-xs text-muted-foreground",
				children: [
					"Not enough ",
					category.title.toLowerCase(),
					" titles on the chart yet."
				]
			})]
		})]
	});
}
function GenreSections() {
	const { data: catalogFilms = [], isLoading } = useQuery({
		queryKey: [
			"films",
			"new-releases",
			100
		],
		queryFn: () => getNewReleaseFilms(100),
		staleTime: 300 * 1e3
	});
	const rows = (0, import_react.useMemo)(() => buildGenreRows(catalogFilms), [catalogFilms]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-12 space-y-10 px-4 lg:px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: "Explore by Genre"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-1 font-display text-3xl",
				children: "Curated Collections"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-xl text-sm text-muted-foreground",
				children: "Chart titles grouped by their genre — every collection only ever contains films that genuinely belong to it."
			})
		] }), isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6",
			children: [...Array(6)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmCardSkeleton, {}, i))
		}) : GENRE_CATEGORIES.map((category, ci) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenreRow, {
			category,
			films: rows[ci] ?? []
		}, category.id))]
	});
}
function QuoteBanner() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mt-16 px-4 lg:px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass-dark relative overflow-hidden rounded-3xl px-8 py-20 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-0 opacity-30",
					style: { backgroundImage: "radial-gradient(circle at 20% 20%, rgba(82,183,136,.35), transparent 50%), radial-gradient(circle at 80% 80%, rgba(45,106,79,.4), transparent 50%)" }
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "relative font-serif text-3xl leading-tight md:text-5xl",
					children: [
						"“The only ranking that moves",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", { className: "hidden md:block" }),
						" as fast as culture.”"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "relative mt-6 text-[10px] uppercase tracking-[0.3em] text-cream/60",
					children: "— Lumière Editorial"
				})
			]
		})
	});
}
function Home() {
	const { data: trendingFilms = [] } = useQuery({
		queryKey: ["trending", "films"],
		queryFn: () => getTrendingFilms(20),
		staleTime: 300 * 1e3
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hero, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Top100Section, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PulseRow, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorialInsight, { films: trendingFilms.slice(0, 3) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenreSections, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuoteBanner, {})
	] });
}
//#endregion
export { Home as component };
