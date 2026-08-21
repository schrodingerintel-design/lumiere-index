import { slugify, cn } from "@/lib/utils";
import { describe, it, expect } from "vitest";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Mickey 17")).toBe("mickey-17");
  });

  it("removes apostrophes", () => {
    expect(slugify("I'm Still Here")).toBe("im-still-here");
  });

  it("collapses multiple separators", () => {
    expect(slugify("  The   Fantastic   Four  ")).toBe("the-fantastic-four");
  });

  it("handles unicode via NFKD normalization", () => {
    expect(slugify("Pokémon")).toBe("pokemon");
    expect(slugify("Amélie")).toBe("amelie");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--Hello--")).toBe("hello");
  });

  it("produces python-slugify compatible output", () => {
    expect(slugify("Avatar Fire and Ash")).toBe("avatar-fire-and-ash");
    expect(slugify("28 Years Later")).toBe("28-years-later");
    expect(slugify("The Fantastic Four First Steps")).toBe("the-fantastic-four-first-steps");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });
});
