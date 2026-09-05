import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as Layout } from "./Layout-BTCUhU4D.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/StaticPage-QTqdYbAA.js
var import_jsx_runtime = require_jsx_runtime();
function StaticPage({ eyebrow, title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layout, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mx-auto max-w-3xl px-4 pb-8 pt-6 lg:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: eyebrow
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-2 font-serif text-4xl leading-tight lg:text-5xl",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 space-y-6 leading-relaxed text-foreground/80",
				children
			})
		]
	}) });
}
//#endregion
export { StaticPage as t };
