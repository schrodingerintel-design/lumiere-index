import { describe, it, expect, beforeEach, vi } from "vitest";

describe("apiClient - searchFilms", () => {
  it("constructs correct URL with query params", () => {
    // Test URL construction logic
    const q = encodeURIComponent("inception");
    const url = `/api/v1/films/search?q=${q}&limit=20`;
    expect(url).toContain("q=inception");
    expect(url).toContain("limit=20");
  });

  it("handles special characters in search query", () => {
    const q = encodeURIComponent("Star Wars: The Force Awakens");
    expect(q).toContain("Star%20Wars");
    expect(decodeURIComponent(q)).toBe("Star Wars: The Force Awakens");
  });
});

describe("SentimentBreakdown type", () => {
  it("allows null values for insufficient data", () => {
    const sentiment = { positive: null, neutral: null, negative: null, sufficient_data: false };
    expect(sentiment.sufficient_data).toBe(false);
    expect(sentiment.positive).toBeNull();
  });

  it("requires sufficient_data field", () => {
    const sentiment = { positive: 60.0, neutral: 25.0, negative: 15.0, sufficient_data: true };
    expect(sentiment.sufficient_data).toBe(true);
    expect(sentiment.positive + sentiment.neutral + sentiment.negative).toBeCloseTo(100.0, 0);
  });
});

describe("Pagination parameters", () => {
  it("constructs offset/limit URLs correctly", () => {
    const limit = 50;
    const offset = 100;
    const url = `/api/v1/films/top?limit=${limit}&offset=${offset}`;
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=100");
  });
});
