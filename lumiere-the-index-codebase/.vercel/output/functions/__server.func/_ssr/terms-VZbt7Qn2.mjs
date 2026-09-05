import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { t as StaticPage } from "./StaticPage-QTqdYbAA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/terms-VZbt7Qn2.js
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
function Terms() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(StaticPage, {
		eyebrow: "Legal",
		title: "Terms & Conditions",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Welcome to Lumière: The Index. These Terms & Conditions (“Terms”) govern your access to and use of Lumière products, websites, applications, and services (collectively, the “Service”). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, please do not use the Service." }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "1.",
				title: "Use of the Service",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Service provides rankings, charts, analytics, and discovery features based on publicly available entertainment signals. You may use the Service for personal, non-commercial purposes unless otherwise agreed in writing." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "2.",
				title: "The Index and Rankings",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Lumière Index reflects cultural momentum derived from multiple audience and public signals. Rankings are provided for informational purposes and do not constitute editorial endorsement or professional advice." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Lumière rankings are designed to reflect audience and cultural signals rather than paid influence. Titles cannot purchase higher rankings. Sponsored content, partnerships, or promotional placements, when available, are always clearly identified." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "3.",
				title: "Intellectual Property",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "All content within the Service — including rankings, charts, data presentations, branding, and design — is owned by or licensed to Lumière and is protected by applicable intellectual property laws. You may not copy, reproduce, distribute, or create derivative works from the Service except as expressly permitted." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "4.",
				title: "Acceptable Use",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "You agree not to:" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "list-inside list-disc space-y-1 font-mono text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Use the Service for any unlawful purpose." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Attempt to manipulate rankings, scores, or public signal data." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Access the Service through automated means that exceed reasonable usage limits." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Interfere with the security or operation of the Service." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Misrepresent your identity or affiliation." })
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "5.",
				title: "Disclaimer of Warranties",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The Service is provided “as is” and “as available.” While we work to keep rankings accurate and current, Lumière makes no warranties, express or implied, regarding the completeness, accuracy, or availability of the Service or any information it contains." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "6.",
				title: "Limitation of Liability",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "To the maximum extent permitted by law, Lumière shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service or reliance on any ranking, score, or other information provided." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				num: "7.",
				title: "Changes to These Terms",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "We may update these Terms from time to time. When significant changes occur, we will update the effective date and provide notice where required. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				num: "8.",
				title: "Contact",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "If you have questions about these Terms, contact us at privacy@lumiere.com." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "© Lumière. All rights reserved."
				})]
			})
		]
	});
}
//#endregion
export { Terms as component };
