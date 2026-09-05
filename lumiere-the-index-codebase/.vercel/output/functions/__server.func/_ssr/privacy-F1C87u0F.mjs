import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as StaticPage } from "./StaticPage-QTqdYbAA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/privacy-F1C87u0F.js
var import_jsx_runtime = require_jsx_runtime();
function Section({ num, title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
		className: "font-serif text-xl text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mr-2 font-mono text-sm text-primary",
			children: num
		}), title]
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
function Privacy() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StaticPage, {
		eyebrow: "Legal",
		title: "Privacy Policy",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-xs uppercase tracking-wider text-muted-foreground",
				children: "Effective Date: September 1st 2026"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "1.",
				title: "Introduction",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Welcome to Lumière (“Lumière”, “The Index”, “we”, “our”, or “us”). This Privacy Policy explains how we collect, use, protect, and process information when you access or use Lumière products, websites, applications, and services." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "By using Lumière, you agree to the practices described in this Privacy Policy." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "2.",
				title: "Information We Collect",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Information You Provide"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "When you use Lumière, we may collect information you voluntarily provide, including:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Name",
						"Email address",
						"Account details",
						"Profile information",
						"Preferences",
						"Saved movies or shows",
						"Feedback and communications with us"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Information Collected Automatically"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "When you use Lumière, we may automatically collect:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Device information",
						"Browser type",
						"Operating system",
						"IP address",
						"General location information",
						"Usage activity",
						"Pages viewed",
						"Search activity",
						"Interaction with features",
						"Performance data"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Entertainment Data"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière may collect, analyze, and process publicly available entertainment information, including:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Movie and television information",
						"Public engagement signals",
						"Industry data",
						"Trending discussions",
						"Publicly available cultural signals"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "This information is used to create rankings, charts, analytics, and discovery features." })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "3.",
				title: "How We Use Information",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "We use collected information to:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
					"Provide and improve Lumière services.",
					"Create personalized experiences.",
					"Maintain and improve ranking systems.",
					"Analyze platform performance.",
					"Understand user behavior.",
					"Prevent abuse and maintain security.",
					"Communicate updates and announcements.",
					"Develop new products and features."
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "4.",
				title: "The Lumière Index and Data Processing",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Lumière Index analyzes multiple signals to understand cultural momentum around movies and shows." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Personal user information is not used to artificially influence rankings." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Rankings are generated using Lumière's methodology and may incorporate publicly available information and aggregated platform data." })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "5.",
				title: "Cookies and Tracking Technologies",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière may use cookies and similar technologies to:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Remember user preferences.",
						"Maintain sessions.",
						"Improve performance.",
						"Understand usage patterns.",
						"Measure engagement."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Users may manage cookie preferences through their browser settings." })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "6.",
				title: "Third-Party Services",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière may use third-party services for:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Hosting.",
						"Analytics.",
						"Authentication.",
						"Payments.",
						"Data processing.",
						"Infrastructure."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "These providers may process information only as necessary to provide their services." })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "7.",
				title: "Data Sharing",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière does not sell personal information." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "We may share information when necessary with:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Service providers.",
						"Legal authorities when required.",
						"Business partners during corporate transactions such as mergers or acquisitions."
					] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "8.",
				title: "Data Security",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "We use reasonable technical and organizational measures to protect user information. However, no online service can guarantee complete security." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "9.",
				title: "Your Rights",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Depending on your location, you may have rights including:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, { items: [
						"Accessing your personal data.",
						"Correcting inaccurate information.",
						"Requesting deletion.",
						"Managing communication preferences.",
						"Objecting to certain processing activities."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Requests can be submitted through our contact channels." })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "10.",
				title: "Children's Privacy",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière is not intended for users below the minimum age required by applicable laws. We do not knowingly collect personal information from children without appropriate authorization." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "11.",
				title: "International Users",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière operates globally. Your information may be processed in countries where our service providers operate. We take reasonable steps to ensure appropriate protection of personal information." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "12.",
				title: "Changes to This Privacy Policy",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "We may update this Privacy Policy periodically." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "When significant changes occur, we will update the effective date and provide additional notice where required." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "13.",
				title: "Contact Us",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "If you have questions regarding this Privacy Policy, contact:" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-mono text-sm",
						children: [
							"Lumière",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							"Email: privacy@lumiere.com",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
							"Website: Theindex.com"
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "© Lumière. All rights reserved."
					})
				]
			})
		]
	});
}
//#endregion
export { Privacy as component };
