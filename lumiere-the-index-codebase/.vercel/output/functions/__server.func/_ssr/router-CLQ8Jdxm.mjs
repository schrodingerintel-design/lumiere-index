import { n as __toESM } from "../_runtime.mjs";
import { a as getNewReleaseFilms, i as getNewEntries, o as getRisingFilms, p as getTrendingFilms, r as getLiveStats } from "./apiClient-B3VnLWzJ.mjs";
import { r as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as createRouter, c as createFileRoute, l as createRootRouteWithContext, n as Scripts, o as Outlet, r as HeadContent, s as lazyRouteComponent, u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { r as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { t as Route$14 } from "./films._slug-Cl--7Fs7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-CLQ8Jdxm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-B1SfJ8DO.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The page you're looking for doesn't exist or has been moved."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							reset();
							window.location.reload();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$13 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "Lumière The Index — The films the world can't stop talking about" },
			{
				name: "description",
				content: "The daily cultural momentum ranking for cinema — the 100 films the world can't stop talking about."
			},
			{
				name: "author",
				content: "Lumière"
			},
			{
				property: "og:title",
				content: "Lumière The Index"
			},
			{
				property: "og:description",
				content: "The films the world can't stop talking about."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Libre+Franklin:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$13.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
	});
}
var $$splitErrorComponentImporter$12 = () => import("./watchlist-BNMfxlgY.mjs");
var $$splitComponentImporter$12 = () => import("./watchlist-S6D6uZiQ.mjs");
var Route$12 = createFileRoute("/watchlist")({
	head: () => ({ meta: [{ title: "My Watchlist — Lumière The Index" }, {
		name: "description",
		content: "Saved films and cultural intelligence watchlist."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$12, "errorComponent")
});
var $$splitErrorComponentImporter$11 = () => import("./trending-pzKQf4VQ.mjs");
var $$splitComponentImporter$11 = () => import("./trending-DIy7FG8z.mjs");
var Route$11 = createFileRoute("/trending")({
	head: () => ({ meta: [{ title: "Trending Topics — Lumière The Index" }, {
		name: "description",
		content: "Films generating the most audience conversation right now — ranked by real viewer signal velocity."
	}] }),
	loader: async ({ context }) => {
		await context.queryClient.prefetchQuery({
			queryKey: ["trending", "films"],
			queryFn: () => getTrendingFilms(20)
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$11, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$11, "errorComponent")
});
var $$splitErrorComponentImporter$10 = () => import("./top-100-CfvCMc2Y.mjs");
var $$splitComponentImporter$10 = () => import("./top-100-Bn7-aVit.mjs");
var Route$10 = createFileRoute("/top-100")({
	head: () => ({ meta: [{ title: "Top 100 — Lumière The Index" }, {
		name: "description",
		content: "The 100 films currently generating the strongest cultural momentum across audience conversation, attention and visibility."
	}] }),
	loader: async ({ context }) => {
		await context.queryClient.prefetchQuery({
			queryKey: [
				"films",
				"new-releases",
				100
			],
			queryFn: () => getNewReleaseFilms(100)
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$10, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$10, "errorComponent")
});
var $$splitErrorComponentImporter$9 = () => import("./terms-DsskianW.mjs");
var $$splitComponentImporter$9 = () => import("./terms-BG_1WPrS.mjs");
var Route$9 = createFileRoute("/terms")({
	head: () => ({ meta: [{ title: "Terms & Conditions — Lumière The Index" }, {
		name: "description",
		content: "The terms and conditions governing use of Lumière: The Index."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$9, "errorComponent")
});
var $$splitErrorComponentImporter$8 = () => import("./rising-D8hoMX9u.mjs");
var $$splitComponentImporter$8 = () => import("./rising-CozCvWVp.mjs");
var Route$8 = createFileRoute("/rising")({
	head: () => ({ meta: [{ title: "Top 10 Rising Films — Lumière The Index" }, {
		name: "description",
		content: "The top 10 films climbing the Lumière Index fastest right now."
	}] }),
	loader: async ({ context }) => {
		await context.queryClient.prefetchQuery({
			queryKey: ["films", "rising"],
			queryFn: () => getRisingFilms()
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$8, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$8, "errorComponent")
});
var $$splitErrorComponentImporter$7 = () => import("./privacy-CFLEHQf_.mjs");
var $$splitComponentImporter$7 = () => import("./privacy-B_ABzMYN.mjs");
var Route$7 = createFileRoute("/privacy")({
	head: () => ({ meta: [{ title: "Privacy Policy — Lumière The Index" }, {
		name: "description",
		content: "How Lumière collects, uses, protects, and processes information when you use the Index."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$7, "errorComponent")
});
var $$splitErrorComponentImporter$6 = () => import("./new-entries-Bucgu6Cz.mjs");
var $$splitComponentImporter$6 = () => import("./new-entries-BlDaCyU0.mjs");
var Route$6 = createFileRoute("/new-entries")({
	head: () => ({ meta: [{ title: "New Entries — Lumière The Index" }, {
		name: "description",
		content: "Movies that just hit theaters, released in the last month."
	}] }),
	loader: async ({ context }) => {
		await context.queryClient.prefetchQuery({
			queryKey: ["films", "new-entries"],
			queryFn: () => getNewEntries()
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$6, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$6, "errorComponent")
});
var $$splitErrorComponentImporter$5 = () => import("./methodology-CITDvzjL.mjs");
var $$splitComponentImporter$5 = () => import("./methodology-oRDuMT4u.mjs");
var Route$5 = createFileRoute("/methodology")({
	head: () => ({ meta: [{ title: "Index Methodology — Lumière The Index" }, {
		name: "description",
		content: "How the Lumière Index measures cultural momentum from audience interest, social conversation, media presence, and availability."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$5, "errorComponent")
});
var $$splitErrorComponentImporter$4 = () => import("./genres-dzRRZ2t2.mjs");
var $$splitComponentImporter$4 = () => import("./genres-BeIYPBrY.mjs");
var Route$4 = createFileRoute("/genres")({
	head: () => ({ meta: [{ title: "Browse by Genre — Lumière The Index" }, {
		name: "description",
		content: "Explore index analytics and top films grouped by movie genres."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$4, "errorComponent")
});
var $$splitErrorComponentImporter$3 = () => import("./compare-BSa9AYuc.mjs");
var $$splitComponentImporter$3 = () => import("./compare-CEZgbI_I.mjs");
var Route$3 = createFileRoute("/compare")({
	head: () => ({ meta: [{ title: "Compare Films — Lumière The Index" }, {
		name: "description",
		content: "Head-to-head comparison of two films across cultural scores, sentiment, and engagement signals."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$3, "errorComponent")
});
var $$splitErrorComponentImporter$2 = () => import("./calendar-DgXaceFF.mjs");
var $$splitComponentImporter$2 = () => import("./calendar-Cobex5Br.mjs");
var Route$2 = createFileRoute("/calendar")({
	head: () => ({ meta: [{ title: "Now & Next — Lumière The Index" }, {
		name: "description",
		content: "Movies in theaters and coming soon — films tracked on the Index, plus the full TMDB release calendar."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$2, "errorComponent")
});
/** "Now in theaters" only counts films released within this window — old re-releases never qualify. */
/** Fetch several TMDB pages and merge them into one deduped list. */
var $$splitErrorComponentImporter$1 = () => import("./about-BsCgS4rw.mjs");
var $$splitComponentImporter$1 = () => import("./about-5NSraOdo.mjs");
var Route$1 = createFileRoute("/about")({
	head: () => ({ meta: [{ title: "About The Index — Lumière The Index" }, {
		name: "description",
		content: "Lumière: The Index is a real-time cultural ranking platform tracking the movies and series capturing global attention."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$1, "errorComponent")
});
var $$splitErrorComponentImporter = () => import("./routes-CVbByMdk.mjs");
var $$splitComponentImporter = () => import("./routes-CFgEKg0M.mjs");
var Route = createFileRoute("/")({
	head: () => ({ meta: [{ title: "Lumière The Index — The films the world can't stop talking about" }, {
		name: "description",
		content: "The daily cultural momentum ranking for cinema. The 100 films currently generating the strongest audience conversation, attention and visibility."
	}] }),
	loader: async ({ context }) => {
		const { queryClient } = context;
		await Promise.all([
			queryClient.prefetchQuery({
				queryKey: ["stats", "live"],
				queryFn: getLiveStats
			}),
			queryClient.prefetchQuery({
				queryKey: [
					"films",
					"new-releases",
					100
				],
				queryFn: () => getNewReleaseFilms(100)
			}),
			queryClient.prefetchQuery({
				queryKey: ["trending", "films"],
				queryFn: () => getTrendingFilms(20)
			})
		]);
	},
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent")
});
var WatchlistRoute = Route$12.update({
	id: "/watchlist",
	path: "/watchlist",
	getParentRoute: () => Route$13
});
var TrendingRoute = Route$11.update({
	id: "/trending",
	path: "/trending",
	getParentRoute: () => Route$13
});
var Top100Route = Route$10.update({
	id: "/top-100",
	path: "/top-100",
	getParentRoute: () => Route$13
});
var TermsRoute = Route$9.update({
	id: "/terms",
	path: "/terms",
	getParentRoute: () => Route$13
});
var RisingRoute = Route$8.update({
	id: "/rising",
	path: "/rising",
	getParentRoute: () => Route$13
});
var PrivacyRoute = Route$7.update({
	id: "/privacy",
	path: "/privacy",
	getParentRoute: () => Route$13
});
var NewEntriesRoute = Route$6.update({
	id: "/new-entries",
	path: "/new-entries",
	getParentRoute: () => Route$13
});
var MethodologyRoute = Route$5.update({
	id: "/methodology",
	path: "/methodology",
	getParentRoute: () => Route$13
});
var GenresRoute = Route$4.update({
	id: "/genres",
	path: "/genres",
	getParentRoute: () => Route$13
});
var CompareRoute = Route$3.update({
	id: "/compare",
	path: "/compare",
	getParentRoute: () => Route$13
});
var CalendarRoute = Route$2.update({
	id: "/calendar",
	path: "/calendar",
	getParentRoute: () => Route$13
});
var AboutRoute = Route$1.update({
	id: "/about",
	path: "/about",
	getParentRoute: () => Route$13
});
var rootRouteChildren = {
	IndexRoute: Route.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$13
	}),
	AboutRoute,
	CalendarRoute,
	CompareRoute,
	GenresRoute,
	MethodologyRoute,
	NewEntriesRoute,
	PrivacyRoute,
	RisingRoute,
	TermsRoute,
	Top100Route,
	TrendingRoute,
	WatchlistRoute,
	FilmsSlugRoute: Route$14.update({
		id: "/films/$slug",
		path: "/films/$slug",
		getParentRoute: () => Route$13
	})
};
var routeTree = Route$13._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient({ defaultOptions: { queries: {
			staleTime: 300 * 1e3,
			gcTime: 1800 * 1e3,
			refetchOnWindowFocus: false,
			retry: 1
		} } }) },
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadDelay: 50,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
