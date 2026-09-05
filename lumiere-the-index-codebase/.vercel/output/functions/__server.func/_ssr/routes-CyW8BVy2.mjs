import { n as __toESM } from "../_runtime.mjs";
import { _ as tmdbBackdropUrl, a as getNewReleaseFilms, c as getTmdbMovieVideos, f as getTopFilms, h as searchTmdbMovie, i as getNewEntries, o as getRisingFilms, p as getTrendingFilms, r as getLiveStats, v as tmdbPosterUrl } from "./apiClient-OpsbjiRR.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { A as Film, D as Ghost, F as ChevronRight, I as ChevronLeft, M as ExternalLink, N as Compass, P as CircleAlert, U as Award, W as ArrowUp, a as Trophy, g as Play, h as Rocket, j as Eye, k as Flame, l as Sparkles, o as TrendingUp, q as ArrowDown, s as TrendingDown, t as Zap } from "../_libs/lucide-react.mjs";
import { n as Layout, t as FilmPosterThumbnail } from "./Layout-B2NEJ6Q7.mjs";
import { i as PulseRowSkeleton, n as FilmRowSkeleton, r as HeroSkeleton, t as FilmCardSkeleton } from "./Skeletons-JkDOzhQ6.mjs";
import { t as isNewRelease } from "./filmUtils-rHExeiqm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CyW8BVy2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function gradientStyle$3(film) {
	if (!film) return "#333";
	return `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`;
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
	const { data: stats } = useQuery({
		queryKey: ["stats", "live"],
		queryFn: getLiveStats,
		staleTime: 60 * 1e3
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 lg:p-10 min-h-[420px] lg:min-h-[520px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col justify-center lg:col-span-7 animate-fade-up",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 mb-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "h-3.5 w-3.5" }), "Today's #1 Movie"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs text-white/90",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "relative inline-flex h-2 w-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "live-dot block h-full w-full rounded-full bg-live" })
							}), "Index updating live"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[0.95] text-white drop-shadow-lg line-clamp-3",
						children: activeFilm?.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-wrap items-center gap-x-2 text-sm text-white/70 font-mono",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeFilm?.year ?? "—" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white/30",
								children: "·"
							}),
							tmdbFilm?.release_date && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "1h 45m" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white/30",
								children: "·"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeFilm?.country_origin ?? "" })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 max-w-xl text-sm leading-relaxed text-white/70 line-clamp-3",
						children: activeFilm?.synopsis || tmdbFilm?.overview || "No synopsis available."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex flex-wrap items-center gap-3",
						children: [trailer && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: `https://www.youtube.com/watch?v=${trailer.key}`,
							target: "_blank",
							rel: "noopener noreferrer",
							className: "inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-white border border-white/20 transition hover:bg-white/25",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-4 w-4" }),
								"Watch Trailer",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "h-3 w-3 opacity-50" })
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/films/$slug",
							params: { slug: activeFilm?.slug ?? "" },
							className: "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-4 w-4" }), "Compare this title"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-8 flex items-center gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveIndex((curr) => (curr - 1 + carouselFilms.length) % carouselFilms.length),
								className: "p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-5 w-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex gap-2",
								children: carouselFilms.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setActiveIndex(i),
									className: `h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/50"}`,
									"aria-label": `View ${f.title}`
								}, f.slug))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setActiveIndex((curr) => (curr + 1) % carouselFilms.length),
								className: "p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-5 w-5" })
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hidden lg:flex lg:col-span-5 items-center justify-end animate-fade-up delay-100",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "relative flex items-end gap-5",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
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
								className: "font-serif text-base font-semibold leading-tight text-white drop-shadow",
								children: activeFilm?.title
							})
						})]
					})
				})
			})]
		})]
	});
}
function gradientStyle$2(from, to) {
	return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}
function PosterCard({ film, width = 140 }) {
	const change = film.movement ?? null;
	const isNew = film.prev_rank == null && isNewRelease(film);
	const director = film.director && film.director !== "Unknown" ? film.director : "Director TBA";
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
						className: "rounded-md bg-black/50 border border-white/20 px-2 py-1 font-mono text-xs font-medium text-white backdrop-blur",
						children: ["#", film.rank]
					}), isNew ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-md bg-live px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink",
						children: "New"
					}) : change !== 0 && change !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: `rounded-md px-1.5 py-1 font-mono text-[10px] font-medium ${change > 0 ? "bg-up/90 text-ink" : "bg-down/90 text-white"}`,
						children: [change > 0 ? "▲" : "▼", Math.abs(change)]
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-serif text-lg leading-tight text-white drop-shadow",
						children: film.title
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-2 px-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "truncate text-xs text-muted-foreground",
				children: director
			})
		})]
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
		className: "mt-12 px-4 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 flex items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "New Releases"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-1 font-serif text-3xl",
						children: "The Top 100"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-xl text-sm text-muted-foreground",
						children: "Highest-rated newly released films on the Index, ranked by audience score and viewer sentiment."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex shrink-0 items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "hidden gap-1.5 sm:flex",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => scrollStrip("left"),
							className: "flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
							"aria-label": "Scroll posters left",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-4 w-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => scrollStrip("right"),
							className: "flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
							"aria-label": "Scroll posters right",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-4 w-4" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/top-100",
						className: "shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground",
						children: "Full list →"
					})]
				})]
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-6 text-center text-sm text-muted-foreground",
				children: "Unable to load rankings. Please try again later."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "max-h-[420px] space-y-2 overflow-y-auto pr-1 lg:hidden",
				children: isLoading ? [...Array(10)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "glass rounded-xl p-2 flex items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-8 w-8 bg-foreground/10 animate-pulse rounded" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-14 w-10 bg-foreground/10 animate-pulse rounded-md" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-32 bg-foreground/10 animate-pulse rounded" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-3 w-24 bg-foreground/10 animate-pulse rounded" })]
						})
					]
				}, i)) : films?.slice(0, 10).map((f) => {
					const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: f.slug },
						className: "glass card-lift flex items-center gap-3 rounded-xl p-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-8 w-8 shrink-0 place-items-center font-mono text-sm tabular",
								children: String(f.rank).padStart(2, "0")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
								film: f,
								className: "h-14 w-10"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate font-serif text-base",
									children: f.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate text-xs text-muted-foreground",
									children: director
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-right",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-sm tabular text-primary",
									children: f.score?.toFixed(1)
								}), f.prev_rank == null && isNewRelease(f) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded-md bg-live px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ink",
									children: "New"
								}) : null]
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
					className: "glass rounded-2xl border border-foreground/10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sticky top-0 z-10 grid grid-cols-[60px_60px_1fr_90px_90px] items-center gap-3 border-b border-foreground/10 bg-background/95 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Rank" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Mvmt" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Title" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Weeks" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-right",
								children: "Score"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "max-h-[460px] overflow-y-auto",
						children: isLoading ? [...Array(10)].map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmRowSkeleton, {}, i)) : films?.slice(0, 10).map((f) => {
							const change = f.movement ?? null;
							const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
							const weeks = f.weeks_on_chart ?? 1;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/films/$slug",
								params: { slug: f.slug },
								className: "grid grid-cols-[60px_60px_1fr_90px_90px] items-center gap-3 border-b border-foreground/5 px-4 py-3 transition hover:bg-foreground/[0.03]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-mono text-xl tabular",
										children: String(f.rank).padStart(2, "0")
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: f.prev_rank == null && isNewRelease(f) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink",
										children: "New"
									}) : change !== null && change !== 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: `flex items-center gap-0.5 font-mono text-xs tabular ${change > 0 ? "text-forest-deep" : "text-down"}`,
										children: [change > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-3 w-3" }), Math.abs(change)]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: "—"
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, {
											film: f,
											className: "h-12 w-9"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "truncate font-serif text-base",
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
										className: "text-right font-mono text-sm tabular text-primary font-semibold",
										children: f.score?.toFixed(1)
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
function driverLabel(driver, index, rank) {
	if (index === 0) {
		if (driver === "recency") return `#${String(rank).padStart(2, "0")} Opening Window`;
		if (driver === "momentum") return `#${String(rank).padStart(2, "0")} Momentum Leader`;
		if (driver === "declining") return `#${String(rank).padStart(2, "0")} Fading Signal`;
		return `#${String(rank).padStart(2, "0")} Sustained Dominance`;
	}
	if (driver === "recency") return "New Release Signal";
	if (driver === "momentum") return "Rising Momentum";
	if (driver === "declining") return "Cooling Off";
	if (driver === "engagement") return "Audience Intensity";
	return "Sustained Presence";
}
function DriverIcon({ driver, className }) {
	if (driver === "momentum") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className });
	if (driver === "declining") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingDown, { className });
	if (driver === "recency") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className });
	if (driver === "engagement") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className });
}
function editorialHeadline(top) {
	const driver = top.dominant_driver ?? "attention";
	const delta = top.attention_delta_pct ?? 0;
	const sign = delta >= 0 ? "+" : "";
	const platform = top.top_platform ?? null;
	const rawPlatform = platform ? {
		reddit: "Reddit",
		tiktok: "TikTok",
		youtube: "YouTube",
		news: "news outlets",
		letterboxd: "Letterboxd",
		trends: "Google Trends",
		tmdb: "Audience Signals",
		audience: "Audience Signals"
	}[platform.toLowerCase()] ?? platform : null;
	const platformStr = rawPlatform?.toLowerCase() === "tmdb" ? "Audience Signals" : rawPlatform;
	if (driver === "recency") return `${top.title} opens strong — ${sign}${delta.toFixed(0)}% conversation surge in its first days`;
	if (driver === "momentum") return platformStr ? `${top.title} surging ${sign}${delta.toFixed(0)}% on ${platformStr}` : `${top.title} surging ${sign}${delta.toFixed(0)}% — conversation accelerating`;
	if (driver === "declining") return `${top.title} cools — conversation down ${Math.abs(delta).toFixed(0)}% from peak`;
	if (driver === "engagement") return `${top.title} holds with deep audience engagement — ${top.score.toFixed(1)} Index Score`;
	return `${top.title} anchors the Index — ${sign}${delta.toFixed(0)}% conversation this cycle`;
}
function editorialBody(top) {
	return (top.trend_reason || "").replace(/\bTMDB\b/gi, "Audience Signals");
}
function spotlightCopy(film) {
	const driver = film.dominant_driver ?? "attention";
	const delta = film.attention_delta_pct ?? 0;
	const sign = delta >= 0 ? "+" : "";
	if (driver === "recency") return `Opening window active — ${film.mentions_24h.toLocaleString()} mentions in 24h.`;
	if (driver === "momentum") return `Conversation ${sign}${delta.toFixed(0)}% over 3 days — rapid rise.`;
	if (driver === "declining") return `Signal cooling — conversation down ${Math.abs(delta).toFixed(0)}% from peak.`;
	if (driver === "engagement") return `High audience intensity — ${film.score.toFixed(1)} Index Score holding strong.`;
	return `${film.mentions_24h.toLocaleString()} mentions in 24h — sustained cultural attention.`;
}
function EditorialInsight({ films }) {
	const spotlightFilms = films.slice(0, 3);
	const weekLabel = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric"
	});
	if (spotlightFilms.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mt-12 px-4 lg:px-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-foreground/[0.06] to-primary/5 dark:via-ink/80 p-6 lg:p-8 flex items-center gap-4 text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "h-5 w-5 text-primary shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm",
				children: "Editorial Briefing — signal data loading. Check back shortly as the Index populates."
			})]
		})
	});
	const top = spotlightFilms[0];
	const topDriver = top.dominant_driver ?? "attention";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mt-12 px-4 lg:px-6",
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
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", {
									className: "text-right font-mono",
									children: [
										(top.attention_delta_pct ?? 0) >= 0 ? "+" : "",
										(top.attention_delta_pct ?? 0).toFixed(0),
										"%"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Driver"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-right font-mono capitalize",
									children: topDriver
								}),
								top.top_platform && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-muted-foreground",
									children: "Top platform"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "text-right font-mono capitalize",
									children: top.top_platform.toLowerCase() === "tmdb" || top.top_platform.toLowerCase() === "audience" ? "Audience Signals" : top.top_platform
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] uppercase font-mono text-primary mt-1",
							children: "— Lumière Signal Engine"
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 pt-6 border-t border-foreground/10",
				children: spotlightFilms.map((film, i) => {
					const driver = film.dominant_driver ?? "attention";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/films/$slug",
						params: { slug: film.film_slug },
						className: "group rounded-xl border border-foreground/5 bg-foreground/[0.03] p-4 transition hover:bg-foreground/10",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs font-mono text-primary mb-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: driverLabel(driver, i, film.rank) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DriverIcon, {
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
	const topEntries = newEntries?.slice(0, 4) ?? [];
	const topTrending = trendingFilms?.slice(0, 6) ?? [];
	const maxMentions = Math.max(...topTrending.map((f) => f.mentions_24h), 1);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-12 grid grid-cols-1 gap-4 px-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6",
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
						children: "No trending films yet"
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
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("action") || s.includes("fight") || s.includes("race") || s.includes("war") || t.includes("f1") || t.includes("superman");
		}
	},
	{
		id: "scifi",
		title: "Sci-Fi & Cyberpunk",
		subtitle: "Futuristic visions, space epics, and speculative thrillers",
		icon: Rocket,
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			const t = (f.title || "").toLowerCase();
			return s.includes("sci-fi") || s.includes("future") || s.includes("alien") || s.includes("space") || t.includes("dune") || t.includes("alien");
		}
	},
	{
		id: "indie",
		title: "Indie & Festival Gems",
		subtitle: "Festival darlings, auteur masterworks, and award-season contenders",
		icon: Award,
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			return s.includes("drama") || s.includes("award") || s.includes("festival") || s.includes("substance") || s.includes("anora");
		}
	},
	{
		id: "asian",
		title: "East Asian Cinema",
		subtitle: "Visionary masterpieces, noir thrillers, and acclaimed features",
		icon: Sparkles,
		matches: (f) => {
			const c = (f.country_origin || "").toUpperCase();
			const s = (f.synopsis || "").toLowerCase();
			return c === "KR" || c === "JP" || c === "CN" || c === "HK" || s.includes("korean") || s.includes("japan");
		}
	},
	{
		id: "animation",
		title: "Animation & Anime",
		subtitle: "Visually breathtaking animated features from around the world",
		icon: Film,
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			return s.includes("animat") || s.includes("anime") || s.includes("cartoon");
		}
	},
	{
		id: "thriller",
		title: "Thriller & Suspense",
		subtitle: "Psychological tension, dark mysteries, and suspenseful narratives",
		icon: Ghost,
		matches: (f) => {
			const s = (f.synopsis || "").toLowerCase();
			return s.includes("thriller") || s.includes("mystery") || s.includes("murder") || s.includes("horror") || s.includes("sinners");
		}
	}
];
var ROW_LIMIT = 10;
/**
* Build one ROW_LIMIT-film row per category.
*
* Each film is assigned to AT MOST ONE category:
*   1. Primary match  — the film's synopsis/title satisfies the category's
*      `matches()` predicate. The film is claimed by the first category it
*      matches (categories are processed in order).
*   2. Padding        — once all genuine matches are assigned we deal catalog
*      films round-robin across categories until every row hits ROW_LIMIT,
*      but each padding film is only ever added to ONE row.
*
* This prevents the same blockbuster from appearing in every section.
*/
function buildGenreRows(catalogFilms) {
	const globallyUsed = /* @__PURE__ */ new Set();
	const rows = GENRE_CATEGORIES.map(() => []);
	const inRow = GENRE_CATEGORIES.map(() => /* @__PURE__ */ new Set());
	for (const film of catalogFilms) for (let ci = 0; ci < GENRE_CATEGORIES.length; ci++) if (rows[ci].length < ROW_LIMIT && GENRE_CATEGORIES[ci].matches(film) && !globallyUsed.has(film.slug)) {
		rows[ci].push(film);
		inRow[ci].add(film.slug);
		globallyUsed.add(film.slug);
		break;
	}
	let changed = true;
	while (changed) {
		changed = false;
		for (let ci = 0; ci < GENRE_CATEGORIES.length; ci++) {
			if (rows[ci].length >= ROW_LIMIT) continue;
			for (const film of catalogFilms) {
				if (rows[ci].length >= ROW_LIMIT) break;
				if (!globallyUsed.has(film.slug)) {
					rows[ci].push(film);
					inRow[ci].add(film.slug);
					globallyUsed.add(film.slug);
					changed = true;
				}
			}
		}
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end justify-between gap-3 px-1",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-2.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "truncate font-serif text-xl leading-tight text-foreground",
						children: category.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-xs text-muted-foreground",
						children: category.subtitle
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex shrink-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => scroll("left"),
					className: "flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
					"aria-label": `Scroll ${category.title} left`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-4 w-4" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => scroll("right"),
					className: "flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
					"aria-label": `Scroll ${category.title} right`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-4 w-4" })
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: scrollRef,
			className: "no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 scroll-smooth",
			children: films.map((film) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/films/$slug",
				params: { slug: film.slug },
				className: "card-lift group relative block w-[140px] shrink-0 sm:w-[160px]",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative aspect-[2/3] overflow-hidden rounded-xl bg-ink",
					children: [
						film.poster_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: film.poster_url,
							alt: film.title,
							className: "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
							loading: "lazy"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex h-full w-full items-center justify-center p-3 text-center text-xs font-serif text-white/90",
							style: { background: gradientStyle(film.gradient_from, film.gradient_to) },
							children: film.title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 transition-opacity group-hover:opacity-60" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute top-2 left-2 rounded-full bg-live/90 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-ink shadow-sm",
							children: ["#", film.rank]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute inset-x-0 bottom-0 p-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate font-serif text-sm font-medium text-white drop-shadow",
								children: film.title
							}), film.year && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-mono text-[10px] text-white/70",
								children: film.year
							})]
						})
					]
				})
			}, film.slug))
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
		className: "mt-12 space-y-12 px-4 lg:px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: "Explore by Genre"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-1 font-serif text-3xl",
				children: "Curated Feature Collections"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-muted-foreground",
				children: "Discover feature films segmented by genre, ranked by global audience sentiment and cultural velocity."
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
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EditorialInsight, { films: trendingFilms.slice(0, 3) }),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Top100Section, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PulseRow, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GenreSections, {}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QuoteBanner, {})
	] });
}
//#endregion
export { Home as component };
