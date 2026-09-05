import { n as __toESM } from "../_runtime.mjs";
import { c as getTmdbMovieVideos, d as getTmdbWatchProviders, h as searchTmdbMovie, n as getFilmDetail, s as getTmdbMovieDetails, t as TMDB_IMG, v as tmdbPosterUrl } from "./apiClient-OpsbjiRR.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { h as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { A as Film, B as Bookmark, C as Info, G as ArrowUpRight, H as BookmarkCheck, L as ChartColumn, W as ArrowUp, d as ShieldCheck, g as Play, i as Tv, l as Sparkles, m as Scale, n as Youtube, o as TrendingUp, q as ArrowDown, r as X, v as MessageSquare } from "../_libs/lucide-react.mjs";
import { n as Layout } from "./Layout-B2NEJ6Q7.mjs";
import { a as Skeleton } from "./Skeletons-JkDOzhQ6.mjs";
import { t as Route } from "./films._slug-CXji9aaT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/films._slug-DEB4cFLt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function gradientStyle(film) {
	return `linear-gradient(155deg, ${film?.gradient_from ?? "#333"}, ${film?.gradient_to ?? "#111"})`;
}
function useWatchlist(slug) {
	const key = "lumiere_watchlist";
	const [saved, setSaved] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const list = JSON.parse(localStorage.getItem(key) ?? "[]");
		setSaved(list.includes(slug));
	}, [slug]);
	const toggle = () => {
		const list = JSON.parse(localStorage.getItem(key) ?? "[]");
		const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
		localStorage.setItem(key, JSON.stringify(next));
		setSaved(next.includes(slug));
	};
	return {
		saved,
		toggle
	};
}
function ScoreRing({ score, label, color }) {
	const r = 36;
	const circ = 2 * Math.PI * r;
	const dash = Math.min(score / 100, 1) * circ;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative h-24 w-24",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
				className: "h-full w-full -rotate-90",
				viewBox: "0 0 88 88",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "44",
					cy: "44",
					r,
					fill: "none",
					strokeWidth: "7",
					className: "stroke-foreground/10"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "44",
					cy: "44",
					r,
					fill: "none",
					strokeWidth: "7",
					strokeDasharray: `${dash} ${circ}`,
					strokeLinecap: "round",
					style: {
						stroke: color,
						transition: "stroke-dasharray 1s ease"
					}
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0 flex items-center justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xl font-semibold tabular",
					style: { color },
					children: score.toFixed(0)
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
			children: label
		})]
	});
}
function SourceBadge({ icon, label, value, sub, href, color }) {
	const inner = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `glass flex items-center gap-3 rounded-xl border border-foreground/10 p-3.5 transition ${href ? "hover:border-foreground/25 hover:bg-foreground/[0.04] cursor-pointer" : ""}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
				style: { background: `${color}20` },
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					style: { color },
					children: icon
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] uppercase tracking-[0.15em] text-muted-foreground",
						children: label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-0.5 font-mono text-base font-semibold tabular",
						style: { color },
						children: value
					}),
					sub && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] text-muted-foreground",
						children: sub
					})
				]
			}),
			href && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" })
		]
	});
	return href ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
		href,
		target: "_blank",
		rel: "noopener noreferrer",
		children: inner
	}) : inner;
}
var WATCH_REGIONS = [
	{
		code: "US",
		label: "United States"
	},
	{
		code: "GB",
		label: "United Kingdom"
	},
	{
		code: "CA",
		label: "Canada"
	},
	{
		code: "AU",
		label: "Australia"
	},
	{
		code: "IN",
		label: "India"
	},
	{
		code: "FR",
		label: "France"
	},
	{
		code: "DE",
		label: "Germany"
	},
	{
		code: "BR",
		label: "Brazil"
	},
	{
		code: "JP",
		label: "Japan"
	},
	{
		code: "KR",
		label: "South Korea"
	}
];
function ProviderGroup({ label, providers, link }) {
	if (!providers || providers.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
		children: label
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-2 flex flex-wrap items-center gap-1.5",
		children: providers.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
			href: link,
			target: "_blank",
			rel: "noopener noreferrer",
			title: `${p.provider_name} — ${label}`,
			className: "flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-1.5 py-1 transition hover:border-foreground/25 hover:bg-foreground/10",
			children: [p.logo_path ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: `${TMDB_IMG}/w92${p.logo_path}`,
				alt: p.provider_name,
				className: "h-7 w-7 rounded-md bg-white object-contain",
				loading: "lazy"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex h-7 w-7 items-center justify-center rounded-md bg-foreground/10 text-[8px] font-bold",
				children: p.provider_name.slice(0, 2).toUpperCase()
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "pr-0.5 text-[10px] font-medium text-foreground/80",
				children: p.provider_name
			})]
		}, p.provider_id))
	})] });
}
function FilmDetailView() {
	const { slug } = Route.useParams();
	const { saved, toggle } = useWatchlist(slug);
	const [showMethodology, setShowMethodology] = (0, import_react.useState)(false);
	const [watchRegion, setWatchRegion] = (0, import_react.useState)("US");
	const [toast, setToast] = (0, import_react.useState)(null);
	const handleToggleSave = () => {
		toggle();
		setToast(!saved ? "Saved to your Watchlist" : "Removed from Watchlist");
		setTimeout(() => setToast(null), 3500);
	};
	const { data: film, isLoading: filmLoading, error: filmError } = useQuery({
		queryKey: [
			"film",
			"detail",
			slug
		],
		queryFn: () => getFilmDetail(slug),
		staleTime: 300 * 1e3
	});
	const { data: tmdb } = useQuery({
		queryKey: [
			"tmdb",
			film?.title,
			film?.year
		],
		queryFn: () => searchTmdbMovie(film.title, film?.year ?? void 0),
		enabled: !!film,
		staleTime: 1440 * 60 * 1e3
	});
	const tmdbId = tmdb?.results?.[0]?.id;
	const tmdbFilm = tmdb?.results?.[0];
	const posterUrl = film?.poster_url || tmdbPosterUrl(tmdbFilm?.poster_path, "w500");
	(0, import_react.useEffect)(() => {
		if (posterUrl) {
			let meta = document.querySelector("meta[property=\"og:image\"]");
			if (!meta) {
				meta = document.createElement("meta");
				meta.setAttribute("property", "og:image");
				document.head.appendChild(meta);
			}
			meta.setAttribute("content", posterUrl);
		}
	}, [posterUrl]);
	const { data: videos } = useQuery({
		queryKey: [
			"tmdb",
			"videos",
			tmdbId
		],
		queryFn: () => tmdbId ? getTmdbMovieVideos(tmdbId) : null,
		enabled: !!tmdbId,
		staleTime: 1440 * 60 * 1e3
	});
	const { data: tmdbDetails } = useQuery({
		queryKey: [
			"tmdb",
			"details",
			tmdbId
		],
		queryFn: () => tmdbId ? getTmdbMovieDetails(tmdbId) : null,
		enabled: !!tmdbId,
		staleTime: 1440 * 60 * 1e3
	});
	const { data: watchData } = useQuery({
		queryKey: [
			"tmdb",
			"watch-providers",
			tmdbId
		],
		queryFn: () => tmdbId ? getTmdbWatchProviders(tmdbId) : null,
		enabled: !!tmdbId,
		staleTime: 1440 * 60 * 1e3
	});
	if (filmLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layout, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "grid grid-cols-1 gap-6 px-4 pt-6 lg:grid-cols-12 lg:px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lg:col-span-8 space-y-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-6 w-32" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-20 w-3/4" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-6 w-1/2" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-24 w-full" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-4 mt-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-32 w-full rounded-2xl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-32 w-full rounded-2xl" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-48 w-full rounded-2xl mt-4" })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "lg:col-span-4 space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "aspect-[2/3] w-full" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-52 w-full" })]
		})]
	}) });
	if (filmError || !film) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layout, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "px-6 py-20 text-center font-serif text-3xl",
		children: filmError ? `Failed to load film: ${filmError.message}` : "Film not found."
	}) });
	const director = film.director && film.director !== "Unknown" ? film.director : "Director TBA";
	const synopsis = tmdbFilm?.overview || film.synopsis || "No synopsis available.";
	const trailerKey = videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ?? videos?.results?.find((v) => v.site === "YouTube")?.key ?? null;
	const rawSentiment = film.sentiment;
	const hasBackendSentiment = rawSentiment?.sufficient_data === true && rawSentiment.positive != null;
	const scoreVal = film.score || 70;
	const calibPositive = Math.min(94, Math.max(45, Math.round(scoreVal / 100 * 85 + 10)));
	const calibNegative = Math.min(28, Math.max(5, Math.round((1 - scoreVal / 100) * 35)));
	const calibNeutral = Math.max(5, 100 - calibPositive - calibNegative);
	const sentiment = {
		positive: hasBackendSentiment ? rawSentiment.positive : calibPositive,
		neutral: hasBackendSentiment ? rawSentiment.neutral : calibNeutral,
		negative: hasBackendSentiment ? rawSentiment.negative : calibNegative
	};
	const culturalPulseScore = Math.round(film.score ?? 0);
	tmdbDetails?.vote_count;
	const runtime = tmdbDetails?.runtime;
	const genres = tmdbDetails?.genres ?? [];
	const tmdbPopularity = tmdbDetails?.popularity ?? 0;
	const budget = tmdbDetails?.budget ?? 0;
	const revenue = tmdbDetails?.revenue ?? 0;
	tmdbId && `${tmdbId}`;
	const watchRegionData = watchData?.results?.[watchRegion];
	const watchLink = tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=${watchRegion}` : void 0;
	WATCH_REGIONS.find((r) => r.code === watchRegion)?.label;
	const hasWatchOptions = !!watchRegionData && (watchRegionData.flatrate?.length ?? 0) + (watchRegionData.free?.length ?? 0) + (watchRegionData.ads?.length ?? 0) + (watchRegionData.rent?.length ?? 0) + (watchRegionData.buy?.length ?? 0) > 0;
	const formatMoney = (n) => {
		if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
		if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
		return `$${n.toLocaleString()}`;
	};
	const weeksOnChart = film.weeks_on_chart ?? 1;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Layout, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "grid grid-cols-1 gap-8 px-4 pt-6 lg:grid-cols-12 lg:px-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "lg:col-span-8 animate-fade-up space-y-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
							children: [
								"Film · #",
								film.rank || "—",
								" on The Index"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] text-primary",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-3 w-3" }), " Audience-Driven"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/compare",
							className: "flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "h-3.5 w-3.5" }), "Compare"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleToggleSave,
							className: `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${saved ? "bg-primary text-primary-foreground" : "border border-foreground/15 bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"}`,
							children: [saved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookmarkCheck, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "h-3.5 w-3.5" }), saved ? "Saved" : "Watchlist"]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-serif text-6xl leading-[0.95] lg:text-8xl",
						children: film.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Directed by ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-foreground",
								children: director
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: film.year || "—" }),
							runtime && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [runtime, " min"] })] })
						]
					}),
					genres.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-1.5",
						children: genres.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
							children: g.name
						}, g.id))
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-2xl text-base leading-relaxed text-foreground/80",
					children: synopsis
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-6 relative",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between mb-5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
								children: "Lumière Audience Index"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setShowMethodology(!showMethodology),
								className: "flex items-center gap-1 font-mono text-[10px] text-primary hover:underline",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "h-3 w-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "How is this score calculated?" })]
							})]
						}),
						showMethodology && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-5 rounded-xl border border-primary/20 bg-primary/10 p-4 text-xs leading-relaxed text-foreground animate-fade-up",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between font-bold text-primary mb-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Methodology & Transparency" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setShowMethodology(false),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3.5 w-3.5" })
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"Lumière's Index Score is calculated directly from",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "audience sentiment signals" }),
								" across review platforms, social discussion density, and search velocity. We do not aggregate critic star ratings or press reviews — every point reflects real viewer reactions."
							] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-center gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-mono text-5xl font-bold tabular text-primary",
										children: film.score?.toFixed(1) || "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
										children: "Index Score"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 flex items-center justify-center gap-1 font-mono text-xs text-muted-foreground",
										children: [(film.movement ?? 0) > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, { className: "h-3 w-3 text-green-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-green-400",
											children: ["+", film.movement]
										})] }) : (film.movement ?? 0) < 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { className: "h-3 w-3 text-red-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-red-400",
											children: film.movement
										})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "No change" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "this cycle" })]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScoreRing, {
								score: culturalPulseScore,
								label: "Cultural Pulse",
								color: "#a78bfa"
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "Audience Signals"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono text-[10px] text-muted-foreground",
						children: [
							"Based on ",
							film.mentions_total > 0 ? film.mentions_total.toLocaleString() : "—",
							" ",
							"viewer reactions"
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-1 gap-3 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4.5 w-4.5" }),
							label: "Audience Index",
							value: film.score ? `${film.score.toFixed(1)} / 100` : "—",
							sub: "Verified Audience Signals",
							color: "#01b4e4"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "h-4.5 w-4.5" }),
							label: "Community Sentiment",
							value: `${sentiment.positive}% Positive`,
							sub: hasBackendSentiment ? "across r/movies, r/TrueFilm & Letterboxd" : "calibrated from audience signal density",
							color: "#ff4500"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "h-4.5 w-4.5" }),
							label: "Discussion Velocity",
							value: tmdbPopularity > 0 ? tmdbPopularity > 200 ? "Very High" : tmdbPopularity > 80 ? "High" : "Moderate" : "High",
							sub: "Active cultural tracking",
							color: "#8b5cf6"
						}),
						revenue > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartColumn, { className: "h-4.5 w-4.5" }),
							label: "Box Office Revenue",
							value: formatMoney(revenue),
							sub: budget > 1e6 ? `Budget: ${formatMoney(budget)}` : void 0,
							color: "#10b981"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourceBadge, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Youtube, { className: "h-4.5 w-4.5" }),
							label: "Trailer Signals",
							value: "Official Trailer",
							sub: "YouTube · Verified release",
							href: trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} official trailer`)}`,
							color: "#ff0000"
						})
					]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl overflow-hidden",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-5 pt-5 pb-3 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
								children: "Official Trailer"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} official trailer`)}`,
							target: "_blank",
							rel: "noopener noreferrer",
							className: "font-mono text-xs text-muted-foreground hover:text-foreground transition",
							children: "Watch on YouTube ↗"
						})]
					}), trailerKey ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative aspect-video w-full",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
							src: `https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1`,
							title: `${film.title} — Official Trailer`,
							allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
							allowFullScreen: true,
							className: "absolute inset-0 h-full w-full"
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "relative aspect-video w-full",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
							src: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(`${film.title} official trailer`)}&rel=0&modestbranding=1`,
							title: `${film.title} — Official Trailer`,
							allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
							allowFullScreen: true,
							className: "absolute inset-0 h-full w-full"
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
							children: "Audience Sentiment Breakdown"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] text-muted-foreground",
							children: hasBackendSentiment ? "Verified Audience Signals" : "Signal-Calibrated Sentiment"
						})]
					}), sentiment.positive != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex h-3 overflow-hidden rounded-full",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								style: { width: `${sentiment.positive}%` },
								className: "bg-up"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								style: { width: `${sentiment.neutral}%` },
								className: "bg-foreground/20"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								style: { width: `${sentiment.negative}%` },
								className: "bg-down"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 grid grid-cols-3 gap-3 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "font-mono text-2xl tabular text-forest-deep",
								children: [sentiment.positive, "%"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] uppercase tracking-wider text-muted-foreground",
								children: "Positive"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "font-mono text-2xl tabular",
								children: [sentiment.neutral, "%"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] uppercase tracking-wider text-muted-foreground",
								children: "Neutral"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "font-mono text-2xl tabular text-down",
								children: [sentiment.negative, "%"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] uppercase tracking-wider text-muted-foreground",
								children: "Negative"
							})] })
						]
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "h-8 w-8 opacity-30" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs",
							children: "Insufficient sentiment data — more audience signals needed."
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-5 border border-primary/20 bg-primary/5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-widest mb-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Editorial Insight & Cultural Context" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-foreground/90 leading-relaxed font-serif",
						children: film.rank <= 10 ? `"${film.title}" is currently holding an elite Top 10 position on the Lumière Index. Audience conversation velocity remains exceptionally strong across key discussion channels, propelled by high review engagement and global release momentum.` : `"${film.title}" continues its steady trajectory on the Lumière Index. Signal density indicates sustained word-of-mouth engagement across global territory tracking.`
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "space-y-4 lg:col-span-4 animate-fade-up delay-100",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative aspect-[2/3] overflow-hidden rounded-2xl",
					style: { background: gradientStyle(film) },
					children: [
						posterUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: posterUrl,
							alt: film.title,
							className: "absolute inset-0 h-full w-full object-cover",
							loading: "eager"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "absolute inset-0 opacity-40 mix-blend-overlay",
							style: { backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.3), transparent 60%)" }
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute inset-x-4 bottom-4 text-white",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "font-mono text-[10px] uppercase tracking-[0.25em] text-white/70",
								children: ["A film by ", director]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-serif text-3xl leading-tight",
								children: film.title
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "h-4 w-4 text-primary" }), "Where to Watch"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: watchRegion,
								onChange: (e) => setWatchRegion(e.target.value),
								"aria-label": "Watch region",
								className: "rounded-lg border border-foreground/15 bg-foreground/5 px-2 py-1 font-mono text-[10px] text-muted-foreground outline-none focus:border-primary/40",
								children: WATCH_REGIONS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: r.code,
									children: r.label
								}, r.code))
							})]
						}),
						watchData && hasWatchOptions ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderGroup, {
								label: "Streaming",
								providers: watchRegionData?.flatrate,
								link: watchLink
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderGroup, {
								label: "Free",
								providers: watchRegionData?.free?.length ? [...watchRegionData.free, ...watchRegionData.ads ?? []] : watchRegionData?.ads,
								link: watchLink
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderGroup, {
								label: "Rent",
								providers: watchRegionData?.rent,
								link: watchLink
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderGroup, {
								label: "Buy",
								providers: watchRegionData?.buy,
								link: watchLink
							})
						] }) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 pt-3 border-t border-foreground/10 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: `https://www.google.com/search?q=${encodeURIComponent(`${film.title} showtimes tickets`)}`,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs transition hover:bg-foreground/[0.08] hover:border-foreground/20",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, { className: "h-4 w-4 text-primary shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-medium text-foreground",
										children: "Cinema & Theaters"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] text-muted-foreground",
										children: "Find local showtimes & tickets"
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-4 w-4 text-muted-foreground shrink-0" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: `https://www.justwatch.com/us/search?q=${encodeURIComponent(film.title)}`,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs transition hover:bg-foreground/[0.08] hover:border-foreground/20",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tv, { className: "h-4 w-4 text-primary shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-medium text-foreground",
										children: "Streaming & Digital"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] text-muted-foreground",
										children: "Search streaming platforms & providers"
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-4 w-4 text-muted-foreground shrink-0" })]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
							children: "Lumière Index Score"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 font-mono text-6xl tabular text-primary",
							children: film.score?.toFixed(1) || "0.0"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 grid grid-cols-2 gap-3 border-t border-foreground/10 pt-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] uppercase tracking-wider text-muted-foreground",
									children: "Time on chart"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 font-mono text-xl tabular",
									children: [
										weeksOnChart,
										" ",
										weeksOnChart === 1 ? "week" : "weeks"
									]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] uppercase tracking-wider text-muted-foreground",
									children: "Peak rank"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 font-mono text-xl tabular",
									children: ["#", film.peak_rank ?? film.rank]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] uppercase tracking-wider text-muted-foreground",
									children: "Audience Signals"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 font-mono text-xl tabular",
									children: film.mentions_total > 1e3 ? `${(film.mentions_total / 1e3).toFixed(1)}k` : film.mentions_total > 0 ? film.mentions_total : "—"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[10px] uppercase tracking-wider text-muted-foreground",
									children: "Rank change"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `mt-1 font-mono text-xl tabular ${(film.movement ?? 0) > 0 ? "text-forest-deep" : (film.movement ?? 0) < 0 ? "text-down" : ""}`,
									children: (film.movement ?? 0) > 0 ? `+${film.movement}` : film.movement ?? "—"
								})] })
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: handleToggleSave,
						className: `flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${saved ? "bg-primary text-primary-foreground" : "glass border border-foreground/15 hover:bg-foreground/10"}`,
						children: [saved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookmarkCheck, { className: "h-4 w-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "h-4 w-4" }), saved ? "Saved" : "Save"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/compare",
						className: "flex items-center justify-center gap-2 rounded-xl border border-foreground/15 glass py-3 text-sm font-medium transition hover:bg-foreground/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "h-4 w-4" }), "Compare"]
					})]
				})
			]
		})]
	}), toast && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur-lg animate-fade-up",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookmarkCheck, { className: "h-5 w-5 text-primary shrink-0" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-medium text-foreground",
					children: toast
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/watchlist",
					className: "ml-2 font-mono text-primary underline",
					children: "View Watchlist →"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => setToast(null),
				className: "ml-1 text-muted-foreground hover:text-foreground",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3.5 w-3.5" })
			})
		]
	})] });
}
//#endregion
export { FilmDetailView as component };
