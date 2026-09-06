import { n as getFilmDetail } from "./apiClient-BWlqrju0.mjs";
import { c as createFileRoute, s as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/films._slug-NxLzfcCV.js
var $$splitErrorComponentImporter = () => import("./films._slug-PPSTvxsG.mjs");
var $$splitComponentImporter = () => import("./films._slug-e9ryJiav.mjs");
var Route = createFileRoute("/films/$slug")({
	head: ({ params }) => ({ meta: [
		{ title: `${(params?.slug ?? "").replace(/-/g, " ")} — Lumière The Index` },
		{
			name: "description",
			content: `Live cultural index score and audience sentiment for film ${params?.slug}.`
		},
		{
			property: "og:title",
			content: `${(params?.slug ?? "").replace(/-/g, " ")} — Lumière The Index`
		},
		{
			property: "og:description",
			content: `Live cultural index score and audience sentiment for film ${params?.slug}.`
		},
		{
			property: "og:type",
			content: "video.movie"
		},
		{
			name: "twitter:card",
			content: "summary_large_image"
		},
		{
			name: "twitter:title",
			content: `${(params?.slug ?? "").replace(/-/g, " ")} — Lumière The Index`
		},
		{
			name: "twitter:description",
			content: `Live cultural index score and audience sentiment for film ${params?.slug}.`
		}
	] }),
	loader: async ({ context, params }) => {
		await context.queryClient.prefetchQuery({
			queryKey: [
				"film",
				"detail",
				params.slug
			],
			queryFn: () => getFilmDetail(params.slug)
		});
	},
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent")
});
//#endregion
export { Route as t };
