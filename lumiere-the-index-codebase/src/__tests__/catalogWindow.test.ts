import { describe, expect, it } from "vitest";
import { catalogWindow } from "@/lib/catalog";
describe("catalog capacity", () => {
  it("stops at provider page 500 and preserves the final partial window", async () => {
    const requested: number[] = [];
    const data = await catalogWindow(
      async (page) => {
        requested.push(page);
        return { page, total_pages: 1200, results: [{ id: page }] };
      },
      167,
      60,
    );
    expect(requested).toEqual([499, 500]);
    expect(data.total_pages).toBe(167);
    expect(data.results.map((item) => item.id)).toEqual([499, 500]);
  });
  it("deduplicates overlapping provider pages without losing later titles", async () => {
    const data = await catalogWindow(
      async (page) => ({ page, total_pages: 2, results: [{ id: 1 }, { id: page + 1 }] }),
      1,
      100,
    );
    expect(data.results.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(data.total_pages).toBe(1);
  });
  it("rejects oversized and out-of-range windows before contacting the source", async () => {
    const source = async () => {
      throw new Error("must not run");
    };
    await expect(catalogWindow(source, 501, 20)).rejects.toThrow("Page unavailable");
    await expect(catalogWindow(source, 1, 10000)).rejects.toThrow("Unsupported page size");
  });
});
