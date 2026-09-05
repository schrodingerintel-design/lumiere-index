//#region node_modules/.nitro/vite/services/ssr/assets/filmUtils-rHExeiqm.js
/**
* Returns true if the film's release_date is within `days` days of today
* (before or after). Used to gate the "New Release" badge.
*/
function isNewRelease(film, days = 7) {
	if (!film?.release_date) return false;
	const release = new Date(film.release_date);
	const diffDays = ((/* @__PURE__ */ new Date()).getTime() - release.getTime()) / (1e3 * 60 * 60 * 24);
	return diffDays >= -days && diffDays <= days;
}
//#endregion
export { isNewRelease as t };
