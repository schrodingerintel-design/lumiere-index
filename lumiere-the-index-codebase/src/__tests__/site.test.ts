import { describe, it, expect } from "vitest";
import { SITE_URL, sitePath, canonicalShareUrl } from "@/lib/site";

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
