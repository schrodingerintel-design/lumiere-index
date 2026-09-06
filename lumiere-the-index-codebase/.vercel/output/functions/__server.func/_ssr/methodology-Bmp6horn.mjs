import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { d as ShieldCheck, x as Lock } from "../_libs/lucide-react.mjs";
import { t as StaticPage } from "./StaticPage--X0OkaFD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/methodology-Bmp6horn.js
var import_jsx_runtime = require_jsx_runtime();
function Section({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: "font-serif text-2xl text-foreground",
		children: title
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-3 space-y-3",
		children
	})] });
}
function List({ items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "list-inside list-disc space-y-1 font-mono text-sm",
		children: items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: i }, i))
	});
}
function Methodology() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StaticPage, {
		eyebrow: "Lumière Index Methodology",
		title: "How The Index Measures Cultural Momentum",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-serif text-xl text-foreground/90",
				children: "The Lumière Index is a real-time ranking system designed to measure the cultural impact and momentum of movies and television shows."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Entertainment is no longer shaped by a single factor. A movie's influence can come from theaters, streaming platforms, online communities, social conversations, search behavior, media coverage, and audience engagement. The Lumière Index combines multiple signals to create a broader understanding of what is capturing global attention." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "What Does The Index Measure?",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Lumière Index measures cultural momentum. It does not simply rank:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"The highest-grossing films.",
						"The highest-rated films.",
						"The most-reviewed films."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Instead, it identifies the movies and shows generating the strongest overall attention and conversation. A film can rise because it is:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Newly released.",
						"Creating global discussion.",
						"Trending online.",
						"Being rediscovered.",
						"Driving audience engagement.",
						"Becoming culturally significant."
					] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Ranking Signals",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Lumière Index evaluates multiple categories of signals." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-foreground/10 bg-background/40 p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-lg text-foreground",
								children: "Audience Interest"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm",
								children: "Measures how actively audiences are discovering and engaging with a title. Signals may include:"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
								"Search interest.",
								"Platform activity.",
								"Audience interactions.",
								"Viewing trends."
							] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-foreground/10 bg-background/40 p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-lg text-foreground",
								children: "Social Conversation"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm",
								children: "Measures the level and momentum of public discussion. Signals may include:"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
								"Social media discussions.",
								"Community conversations.",
								"Viral moments.",
								"Audience reactions."
							] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-foreground/10 bg-background/40 p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-lg text-foreground",
								children: "Media Presence"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm",
								children: "Measures how strongly a title is appearing across entertainment coverage. Signals may include:"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
								"News coverage.",
								"Industry announcements.",
								"Interviews.",
								"Editorial attention."
							] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-foreground/10 bg-background/40 p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-serif text-lg text-foreground",
								children: "Availability & Visibility"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm",
								children: "Measures how accessible and discoverable a title is. Signals may include:"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
								"Streaming availability.",
								"New releases.",
								"Major platform appearances.",
								"Regional availability."
							] })
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Real-Time Movement",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Index is designed to reflect change. Rankings can move based on:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"New releases.",
						"Trending conversations.",
						"Audience discoveries.",
						"Major announcements.",
						"Cultural events."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "A movie's position today may not be the same tomorrow because culture constantly changes." })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Index Score",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Every title receives a Lumière Index Score representing its current cultural momentum. The score is generated through Lumière's ranking system using multiple data inputs and signals." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The score is not a review score. It does not represent whether a movie is “good” or “bad.” It represents how strongly a title is impacting culture at a given moment." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl border border-primary/20 bg-primary/5 p-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 font-serif text-xl font-medium text-primary",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-5 w-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "How the Index Score (0–100) is Calculated" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-3 space-y-2 font-mono text-xs text-foreground/80",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							"• ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Weighted Signal Volume:" }),
							" Every mention counts by source weight (Reddit, Letterboxd, news, YouTube, TikTok, Wikipedia, Google Trends), with engagement log-scaled so genuine reach outranks spam."
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							"• ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Recency Decay:" }),
							" Fresh conversation is weighted higher via a 24-hour half-life over a 48-hour rolling window."
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							"• ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Sentiment Multiplier:" }),
							" Average audience sentiment adjusts the score up to ±25%, rewarding films people actually feel strongly about."
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							"• ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Relative Normalization:" }),
							" Scores are normalized so top-performing releases sit near 97.8 and everything else ranks relative to them. Recalculated every 15 minutes."
						] })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Independence & Transparency",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière rankings are designed to reflect audience and cultural signals rather than paid influence. Titles cannot purchase higher rankings. Sponsored content, partnerships, or promotional placements, when available, will always be clearly identified." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-sm text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4 text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "0% critic weight — rankings are driven entirely by audience signals." })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Continuous Improvement",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Lumière Index is constantly evolving. As entertainment habits change, our methodology will continue improving to better represent how audiences discover, discuss, and experience stories. Our goal is simple: to build the world's most trusted measurement of entertainment culture." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "© Lumière"
				})]
			})
		]
	});
}
//#endregion
export { Methodology as component };
