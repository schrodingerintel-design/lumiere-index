import { n as __toESM } from "../_runtime.mjs";
import { f as getTopFilms, g as subscribeNewsletter, h as searchTmdbMovie, m as searchFilms, v as tmdbPosterUrl } from "./apiClient-B3VnLWzJ.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { d as useNavigate, u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { i as Root, n as Overlay, r as Portal, t as Content } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { A as Film, B as Bookmark, C as Info, E as Hash, R as Calendar, S as LoaderCircle, _ as Moon, a as Trophy, b as Menu, c as Sun, d as ShieldCheck, k as Flame, l as Sparkles, m as Scale, p as Search, r as X, w as House } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/Layout-Dneaa4IB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SearchBox({ className, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onOpen,
		className: `flex min-h-11 items-center gap-2 rounded-full border border-foreground/20 bg-background/85 px-4 py-2.5 text-sm text-muted-foreground backdrop-blur transition hover:border-primary/60 hover:text-foreground cursor-pointer ${className}`,
		"aria-label": "Search films",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "truncate",
			children: "Search films…"
		})]
	});
}
var NAV_ITEMS = [
	{
		to: "/",
		label: "Home",
		icon: House
	},
	{
		to: "/top-100",
		label: "Top 100",
		icon: Trophy
	},
	{
		to: "/rising",
		label: "Rising",
		icon: Flame
	},
	{
		to: "/watchlist",
		label: "Watchlist",
		icon: Bookmark
	},
	{
		to: "/new-entries",
		label: "New Entries",
		icon: Sparkles
	},
	{
		to: "/trending",
		label: "Trending Topics",
		icon: Hash
	},
	{
		to: "/genres",
		label: "By Genre",
		icon: Film
	},
	{
		to: "/calendar",
		label: "Now & Next",
		icon: Calendar
	},
	{
		to: "/compare",
		label: "Compare Films",
		icon: Scale
	},
	{
		to: "/about",
		label: "About Index",
		icon: Info
	}
];
function SidebarContent({ onNavigate, onSearch }) {
	const [email, setEmail] = (0, import_react.useState)("");
	const [submitted, setSubmitted] = (0, import_react.useState)(false);
	const subscribe = useMutation({
		mutationFn: subscribeNewsletter,
		onSuccess: () => setSubmitted(true)
	});
	const handleSubscribe = (e) => {
		e.preventDefault();
		if (!email.trim()) return;
		subscribe.mutate(email.trim());
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col gap-6 p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/",
				onClick: onNavigate,
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-display text-2xl leading-none",
					children: ["Lumière", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-primary",
						children: "."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "The Index"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchBox, {
				className: "md:hidden w-full",
				onOpen: () => {
					onSearch?.();
					onNavigate?.();
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "flex flex-col gap-1 overflow-y-auto pr-1",
				children: NAV_ITEMS.map(({ to, label, icon: Icon }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to,
					onClick: onNavigate,
					activeOptions: { exact: to === "/" },
					activeProps: { className: "bg-primary/10 text-primary font-medium" },
					className: "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "h-4 w-4 opacity-70 group-hover:opacity-100" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })]
				}, to))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-auto space-y-4 pt-2 border-t border-foreground/10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "space-y-2",
					onSubmit: handleSubscribe,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
						children: "The Weekly Dispatch"
					}), submitted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-forest-deep font-mono",
						children: "✓ Subscribed to dispatch"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "email",
						value: email,
						onChange: (e) => setEmail(e.target.value),
						placeholder: "your@email.com",
						required: true,
						className: "w-full rounded-md border border-foreground/15 bg-background/60 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary transition"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: subscribe.isPending,
						className: "w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60",
						children: subscribe.isPending ? "Subscribing…" : "Subscribe"
					})] })]
				})
			})
		]
	});
}
function Sidebar() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
		className: "glass-flat fixed left-4 top-4 bottom-4 z-40 hidden w-64 overflow-hidden rounded-2xl lg:block",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarContent, {})
	});
}
function MobileSidebar({ open, onClose, onSearch }) {
	if (!open) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 lg:hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0 bg-foreground/30 backdrop-blur-sm",
			onClick: onClose
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass-dark absolute left-2 top-2 bottom-2 w-72 overflow-hidden rounded-2xl animate-fade-up",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: onClose,
				className: "absolute right-3 top-3 z-10 rounded-full p-1.5 hover:bg-foreground/10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarContent, {
				onNavigate: onClose,
				onSearch
			})]
		})]
	});
}
var STORAGE_KEY = "lumiere_theme";
function getInitialTheme() {
	if (typeof window === "undefined") return "dark";
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function useTheme() {
	const [theme, setTheme] = (0, import_react.useState)(getInitialTheme);
	(0, import_react.useEffect)(() => {
		const root = document.documentElement;
		if (theme === "light") {
			root.classList.add("light");
			root.classList.remove("dark");
		} else {
			root.classList.add("dark");
			root.classList.remove("light");
		}
		localStorage.setItem(STORAGE_KEY, theme);
	}, [theme]);
	return {
		theme,
		toggle: (0, import_react.useCallback)(() => {
			setTheme((prev) => prev === "dark" ? "light" : "dark");
		}, [])
	};
}
var topLinks = NAV_ITEMS.filter((item) => item.to !== "/" && item.to !== "/watchlist" && item.to !== "/genres" && item.to !== "/calendar" && item.to !== "/about").map(({ to, label }) => ({
	to,
	label
}));
function TopNav({ onMenu, onSearch }) {
	const { theme, toggle } = useTheme();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: "sticky top-0 z-30 px-3 pt-3 lg:px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass mx-auto flex h-13 min-h-11 items-center justify-between rounded-full px-2.5 sm:px-3 lg:px-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onMenu,
							"aria-label": "Open navigation menu",
							className: "flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-foreground/10 active:bg-foreground/15 lg:hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "h-5 w-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							className: "font-display text-lg lg:hidden",
							children: ["Lumière", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary",
								children: "."
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
							className: "hidden items-center gap-4 lg:flex",
							children: topLinks.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: l.to,
								className: "text-[13px] uppercase tracking-wider text-foreground/70 transition hover:text-foreground",
								activeProps: { className: "text-primary font-medium" },
								children: l.label
							}, l.to))
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onSearch,
					"aria-label": "Search films",
					className: "mx-1 flex h-11 items-center gap-2 rounded-full border border-foreground/20 bg-background/85 px-3.5 text-sm text-muted-foreground backdrop-blur transition hover:border-primary/60 hover:text-foreground md:mr-1 md:w-44 md:justify-start lg:w-52",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-4 w-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden truncate md:inline",
						children: "Search films…"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: toggle,
						className: "flex h-11 w-11 items-center justify-center rounded-full text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground",
						"aria-label": `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
						children: theme === "dark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "h-4.5 w-4.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "h-4.5 w-4.5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						title: "Signal engine ramping up — rankings derived from 86,000+ audience signals across Reddit, Letterboxd, news & social channels. Live ingestion is active; data volume grows with each sync cycle.",
						className: "hidden xl:flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] text-primary font-mono transition-all hover:bg-primary/20 cursor-help",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Audience Signal Engine" })]
					})]
				})
			]
		})
	});
}
function FilmPosterThumbnail({ film, className = "h-12 w-9" }) {
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
	const poster = film.poster_url || tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w342");
	const gradient = `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `relative shrink-0 overflow-hidden rounded-md bg-ink ${className}`,
		children: poster ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: poster,
			alt: film.title,
			className: "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
			loading: "lazy",
			decoding: "async"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-full w-full",
			style: { background: gradient }
		})
	});
}
/** Returns `value` only after it has been stable for `delay` ms. */
function useDebouncedValue(value, delay = 250) {
	const [debounced, setDebounced] = (0, import_react.useState)(value);
	(0, import_react.useEffect)(() => {
		const t = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(t);
	}, [value, delay]);
	return debounced;
}
/** True when any result title contains the query — mirrors the backend's
*  ilike direct-match. When false, the results came from the fuzzy fallback,
*  so the UI tells the user there was no exact match. */
function hasExactMatch(results, query) {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return results.some((f) => f.title.toLowerCase().includes(q));
}
function SearchModal({ open, onClose }) {
	const [query, setQuery] = (0, import_react.useState)("");
	const [highlighted, setHighlighted] = (0, import_react.useState)(0);
	const inputRef = (0, import_react.useRef)(null);
	const navigate = useNavigate();
	const debounced = useDebouncedValue(query.trim(), 250);
	const { data, isFetching, isError } = useQuery({
		queryKey: [
			"films",
			"search",
			debounced
		],
		queryFn: () => searchFilms(debounced),
		enabled: debounced.length >= 2,
		staleTime: 3e4
	});
	const { data: popular = [] } = useQuery({
		queryKey: [
			"films",
			"top",
			10
		],
		queryFn: () => getTopFilms(10),
		staleTime: 300 * 1e3
	});
	const results = data ?? [];
	const exact = hasExactMatch(results, debounced);
	const showFuzzyNote = debounced.length >= 2 && results.length > 0 && !exact;
	const closeAndClear = () => {
		setQuery("");
		setHighlighted(0);
		onClose();
	};
	const pickSuggestion = (title) => {
		setQuery(title);
		setHighlighted(0);
		inputRef.current?.focus();
	};
	const handleKeyDown = (e) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlighted((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlighted((h) => Math.max(h - 1, 0));
		} else if (e.key === "Enter") {
			const target = results[Math.min(highlighted, results.length - 1)];
			if (target) {
				e.preventDefault();
				navigate({
					to: "/films/$slug",
					params: { slug: target.slug }
				});
				closeAndClear();
			}
		}
	};
	(0, import_react.useEffect)(() => {
		if (!open) {
			setQuery("");
			setHighlighted(0);
		}
	}, [open]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
		open,
		onOpenChange: (o) => {
			if (!o) onClose();
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Portal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, { className: "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content, {
			"aria-label": "Search films",
			className: "fixed left-1/2 top-[12vh] z-50 w-full max-w-xl -translate-x-1/2 px-4 outline-none animate-fade-up",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "overflow-hidden rounded-2xl border border-foreground/15 bg-surface shadow-2xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative border-b border-foreground/10",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								ref: inputRef,
								type: "text",
								value: query,
								onChange: (e) => {
									setQuery(e.target.value);
									setHighlighted(0);
								},
								onKeyDown: handleKeyDown,
								placeholder: "Search films…",
								"aria-label": "Search films",
								className: "w-full border-0 bg-transparent py-4 pl-12 pr-12 text-base outline-none placeholder:text-muted-foreground"
							}),
							query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setQuery("");
									setHighlighted(0);
									inputRef.current?.focus();
								},
								className: "absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground",
								"aria-label": "Clear search",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" })
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "max-h-80 overflow-y-auto",
						children: debounced.length >= 2 ? isFetching && results.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), "Searching…"]
						}) : isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-5 py-4 text-sm text-down",
							children: "Search failed — please try again."
						}) : results.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-5 py-6 text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, { className: "mx-auto h-6 w-6 opacity-30" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 text-sm text-muted-foreground",
									children: [
										"No films match “",
										debounced,
										"”."
									]
								}),
								popular.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70",
									children: "Try one of these instead"
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [showFuzzyNote && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "border-b border-foreground/10 bg-primary/5 px-5 py-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-primary",
								children: [
									"No exact match for “",
									debounced,
									"” — showing similar results."
								]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "py-1",
							role: "listbox",
							children: results.map((film, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								role: "option",
								"aria-selected": i === highlighted,
								onMouseEnter: () => setHighlighted(i),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/films/$slug",
									params: { slug: film.slug },
									onClick: closeAndClear,
									className: `flex min-h-12 items-center gap-3 px-5 py-2.5 transition ${i === highlighted ? "bg-foreground/10" : ""}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilmPosterThumbnail, { film }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "truncate text-sm font-medium",
												children: film.title
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "truncate text-xs text-muted-foreground",
												children: [film.year ?? "Year TBA", film.rank > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
													" · #",
													film.rank,
													" on The Index"
												] })]
											})]
										}),
										film.score > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "shrink-0 font-mono text-xs tabular text-primary",
											children: film.score.toFixed(1)
										})
									]
								})
							}, film.id))
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-5 py-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted-foreground",
								children: debounced.length === 1 ? "Type at least 2 characters to search." : "Start typing to search the index."
							}), debounced.length === 0 && popular.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-3 w-3" }), "Popular searches"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 flex flex-wrap gap-2",
									children: popular.slice(0, 8).map((film) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => pickSuggestion(film.title),
										className: "rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/90 transition hover:border-primary/50 hover:text-primary",
										children: film.title
									}, film.slug))
								})]
							})]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-t border-foreground/10 px-5 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] uppercase tracking-wider text-muted-foreground",
							children: "Search the Lumière Index"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 text-[10px] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
									className: "rounded border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-mono",
									children: "↑↓"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Navigate" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
									className: "rounded border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-mono",
									children: "↵"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Select" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
									className: "rounded border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-mono",
									children: "Esc"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Close" })
							]
						})]
					})
				]
			})
		})] })
	});
}
var COMPANY_LINKS = [
	{
		to: "/about",
		label: "About"
	},
	{
		to: "/methodology",
		label: "Methodology"
	},
	{
		to: "/privacy",
		label: "Privacy Policy"
	},
	{
		to: "/terms",
		label: "Terms & Conditions"
	}
];
var EXPLORE_LINKS = [
	{
		to: "/top-100",
		label: "The Top 100"
	},
	{
		to: "/rising",
		label: "Rising Now"
	},
	{
		to: "/new-entries",
		label: "New Entries"
	},
	{
		to: "/trending",
		label: "Trending Topics"
	},
	{
		to: "/calendar",
		label: "Now & Next"
	},
	{
		to: "/compare",
		label: "Compare Films"
	}
];
function Footer() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
		className: "mt-16 border-t border-foreground/10 px-4 pb-16 pt-12 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-3xl text-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-2xl leading-snug text-foreground sm:text-3xl",
					children: "The Index doesn't ask critics. It measures what audiences are actually doing — watching, posting, arguing, and turning films into culture."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground",
					children: "0% critic weight · 100% audience signal"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "sm:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							className: "font-display text-2xl leading-none",
							children: ["Lumière", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-primary",
								children: "."
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground",
							children: "The cultural momentum index for cinema. The official Top 100 is refreshed daily; Rising Now tracks short-term momentum between snapshots."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						"aria-label": "Company",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
							children: "Company"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-4 space-y-2.5 text-sm",
							children: COMPANY_LINKS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: l.to,
								className: "text-foreground/70 transition hover:text-primary",
								children: l.label
							}) }, l.to))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						"aria-label": "Explore",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
							children: "Explore"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-4 space-y-2.5 text-sm",
							children: EXPLORE_LINKS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: l.to,
								className: "text-foreground/70 transition hover:text-primary",
								children: l.label
							}) }, l.to))
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-12 flex flex-col gap-2 border-t border-foreground/10 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
					"© ",
					(/* @__PURE__ */ new Date()).getFullYear(),
					" Lumière — The Index. All rights reserved."
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono",
					children: "0% critic weight · audience-driven · daily official Index"
				})]
			})
		]
	});
}
function Layout({ children }) {
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	const [searchOpen, setSearchOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-screen",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grain-overlay",
				"aria-hidden": true
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sidebar, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobileSidebar, {
				open: menuOpen,
				onClose: () => setMenuOpen(false),
				onSearch: () => setSearchOpen(true)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lg:pl-72",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TopNav, {
						onMenu: () => setMenuOpen(true),
						onSearch: () => setSearchOpen(true)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "pb-12",
						children
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Footer, {})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchModal, {
				open: searchOpen,
				onClose: () => setSearchOpen(false)
			})
		]
	});
}
//#endregion
export { Layout as n, FilmPosterThumbnail as t };
