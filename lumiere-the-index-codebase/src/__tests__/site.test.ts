import { describe, it, expect } from "vitest";
import { SITE_URL, sitePath, canonicalShareUrl, titleSocialMeta } from "@/lib/site";

/**
 * The canonical-domain contract: every externally visible URL points at
 * lumiereindex.com, never a deployment URL (Vercel preview / project domain)
 * or a stale placeholder domain.
 */
describe("site identity", () => {
  it("resolves to the canonical production origin", () => {
    expect(SITE_URL).toBe("https://lumiereindex.com");
  });

  it("builds absolute site paths on the canonical origin", () => {
    expect(sitePath("/top-100")).toBe("https://lumiereindex.com/top-100");
    expect(sitePath("top-100")).toBe("https://lumiereindex.com/top-100");
    expect(sitePath("/")).toBe("https://lumiereindex.com/");
  });
});

describe("canonicalShareUrl", () => {
  it("rewrites a deployment-domain URL to the canonical origin, preserving path", () => {
    const url = canonicalShareUrl("https://lumiere-index.vercel.app/films/mickey-17?utm=x");
    expect(url).toBe("https://lumiereindex.com/films/mickey-17?utm=x");
  });

  it("rewrites localhost URLs to the canonical origin", () => {
    const url = canonicalShareUrl("http://localhost:8080/tv-100");
    expect(url).toBe("https://lumiereindex.com/tv-100");
  });

  it("keeps a canonical URL unchanged", () => {
    const url = canonicalShareUrl("https://lumiereindex.com/top-100");
    expect(url).toBe("https://lumiereindex.com/top-100");
  });
});

describe("title sharing metadata", () => {
  it("keeps deep links, titles, and artwork specific to each title", () => {
    const first = titleSocialMeta(
      "Fight Club",
      "1999 film",
      "/screen/movie/550",
      "https://image.tmdb.org/t/p/w780/fight.jpg",
    );
    const second = titleSocialMeta("Superman", "2025 film", "/films/superman", null);
    expect(first).toContainEqual({
      property: "og:url",
      content: "https://lumiereindex.com/screen/movie/550",
    });
    expect(first).toContainEqual({
      name: "twitter:image",
      content: "https://image.tmdb.org/t/p/w780/fight.jpg",
    });
    expect(second).toContainEqual({
      property: "og:image",
      content: "https://lumiereindex.com/og-culture-v2.png",
    });
    expect(second).toContainEqual({ property: "og:title", content: "Superman · Lumière Index" });
  });
});
