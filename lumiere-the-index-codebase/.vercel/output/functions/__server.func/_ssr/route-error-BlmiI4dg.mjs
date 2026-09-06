import { u as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { n as Layout } from "./Layout-CBXeDHAE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-error-BlmiI4dg.js
var import_jsx_runtime = require_jsx_runtime();
function RouteError({ error, reset }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layout, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex flex-col items-center justify-center px-4 py-20 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-serif text-4xl",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 max-w-md text-sm text-muted-foreground",
				children: "This section failed to load. You can try again or go back home."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 flex gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => {
						reset();
						window.location.reload();
					},
					className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
					children: "Try again"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground",
					children: "Go home"
				})]
			})
		]
	}) });
}
//#endregion
export { RouteError as t };
