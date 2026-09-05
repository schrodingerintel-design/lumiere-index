//#region node_modules/.nitro/vite/services/ssr/assets/apiClient-OpsbjiRR.js
/**
* Lumière API Client
* Provides typed fetch wrappers for:
*  1. Local FastAPI backend  (VITE_API_BASE_URL)
*  2. TMDB via backend proxy (key never exposed to browser)
*/
var API_BASE = "http://localhost:8000";
var TMDB_IMG = "https://image.tmdb.org/t/p";
async function apiFetch(path, init) {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers ?? {}
		}
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`API ${res.status}: ${text || res.statusText}`);
	}
	return res.json();
}
var getTopFilms = (limit = 10, offset = 0) => apiFetch(`/api/v1/films/top?limit=${limit}&offset=${offset}`);
/** Recently released films, highest index score first (home page + Top 100). */
var getNewReleaseFilms = (limit = 100, offset = 0) => apiFetch(`/api/v1/films/new-releases?limit=${limit}&offset=${offset}&year_window=2`);
var getRisingFilms = (limit = 10, offset = 0) => apiFetch(`/api/v1/films/rising?limit=${limit}&offset=${offset}`);
var getNewEntries = (limit = 100, offset = 0) => apiFetch(`/api/v1/films/new-entries?limit=${limit}&offset=${offset}`);
var getFilmDetail = (slug) => apiFetch(`/api/v1/films/${slug}`);
var searchFilms = (q, limit = 20) => apiFetch(`/api/v1/films/search?q=${encodeURIComponent(q)}&limit=${limit}`);
/** Fetch films trending by audience engagement velocity. */
var getTrendingFilms = (limit = 20) => apiFetch(`/api/v1/trending/films?limit=${limit}`);
var getLiveStats = () => apiFetch("/api/v1/stats/live");
var subscribeNewsletter = (email) => apiFetch("/api/v1/newsletter/subscribe", {
	method: "POST",
	body: JSON.stringify({ email })
});
var searchTmdbMovie = (title, year) => apiFetch(`/api/v1/tmdb/search/movie?query=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}`);
var getTmdbMovieVideos = (tmdbId) => apiFetch(`/api/v1/tmdb/movie/${tmdbId}/videos`);
var getTmdbMovieDetails = (tmdbId) => apiFetch(`/api/v1/tmdb/movie/${tmdbId}`);
var getTmdbWatchProviders = (tmdbId) => apiFetch(`/api/v1/tmdb/movie/${tmdbId}/watch/providers`);
var getTmdbUpcoming = (page = 1) => apiFetch(`/api/v1/tmdb/movie/upcoming?page=${page}`);
var getTmdbNowPlaying = (page = 1) => apiFetch(`/api/v1/tmdb/movie/now_playing?page=${page}`);
var tmdbPosterUrl = (path, size = "w500") => path ? `${TMDB_IMG}/${size}${path}` : null;
var tmdbBackdropUrl = (path, size = "w1280") => path ? `${TMDB_IMG}/${size}${path}` : null;
//#endregion
export { tmdbBackdropUrl as _, getNewReleaseFilms as a, getTmdbMovieVideos as c, getTmdbWatchProviders as d, getTopFilms as f, subscribeNewsletter as g, searchTmdbMovie as h, getNewEntries as i, getTmdbNowPlaying as l, searchFilms as m, getFilmDetail as n, getRisingFilms as o, getTrendingFilms as p, getLiveStats as r, getTmdbMovieDetails as s, TMDB_IMG as t, getTmdbUpcoming as u, tmdbPosterUrl as v };
