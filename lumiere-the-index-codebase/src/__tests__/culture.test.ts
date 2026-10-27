import { describe, expect, it } from "vitest";
import { parseLibrary } from "@/lib/library";
import { CULTURE, safeExternal, mergeScreenCredits } from "@/lib/catalog";

describe("saved culture", () => {
  it("retains distinct movie, TV and person identities", () => {
    const entries = [
      { key: "movie:10", title: "Movie", path: "/screen/movie/10", category: "Film" },
      { key: "tv:10", title: "Series", path: "/screen/tv/10", category: "TV" },
      { key: "person:10", title: "Person", path: "/people/10", category: "People" },
    ];
    expect(parseLibrary(JSON.stringify(entries))).toEqual(entries);
  });
  it("rejects untrusted destinations and malformed stored metadata", () => {
    const base = { key: "item", title: "Title", category: "Games" };
    expect(
      parseLibrary(
        JSON.stringify([
          { ...base, path: "javascript:alert(1)" },
          { ...base, path: "https://example.com" },
          { ...base, path: "/culture/hades", subtitle: { invalid: true } },
          { ...base, path: "/culture/hades", image: "https://tracking.example.com/a.png" },
          { ...base, path: "/culture/hades" },
        ]),
      ),
    ).toEqual([{ ...base, path: "/culture/hades" }]);
    expect(parseLibrary("broken json")).toEqual([]);
  });
});

describe("culture identity and sources", () => {
  it("has no dead-end related-profile links or duplicate identities", () => {
    const identities = new Set(CULTURE.map((entry) => entry.slug));
    expect(identities.size).toBe(CULTURE.length);
    for (const entry of CULTURE) {
      expect(identities.has(entry.related)).toBe(true);
      expect(entry.wiki).toBeTruthy();
    }
  });
  it("only exposes HTTPS official-site links", () => {
    expect(safeExternal("javascript:alert(1)")).toBeUndefined();
    expect(safeExternal("http://example.com")).toBeUndefined();
    expect(safeExternal("https://example.com")).toBe("https://example.com/");
  });
});

describe("combined filmography", () => {
  it("preserves acting and production roles without merging movie and TV identities", () => {
    const credits = mergeScreenCredits([
      { id: 10, media_type: "movie", title: "Film", poster_path: null, character: "Lead" },
      { id: 10, media_type: "movie", title: "Film", poster_path: null, job: "Producer" },
      { id: 10, media_type: "tv", name: "Series", poster_path: null, character: "Guest" },
    ]);
    expect(credits).toHaveLength(2);
    expect(credits[0]).toMatchObject({ character: "Lead", job: "Producer" });
    expect(credits[1].media_type).toBe("tv");
  });
});
