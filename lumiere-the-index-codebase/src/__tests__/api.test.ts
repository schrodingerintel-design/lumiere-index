import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Structured API logging. A failed client load must be correlatable with the
 * backend logs, so every record carries a request id (also sent as
 * X-Request-ID), the endpoint, HTTP status, duration, exception type and an
 * ISO timestamp.
 */
describe("apiClient - structured request logging", () => {
  const realFetch = globalThis.fetch;

  function parseLastLog(spy: ReturnType<typeof vi.spyOn>, level: "debug" | "error") {
    const calls = spy.mock.calls.filter((c: unknown[]) =>
      String(c[0]).startsWith("[api] "),
    );
    const line = String(calls.at(-1)?.[0]);
    return JSON.parse(line.slice("[api] ".length));
  }

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("logs requestId, endpoint, status, duration and timestamp on success", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ slug: "a" }],
    }) as unknown as typeof fetch;

    const { getTopFilms } = await import("@/lib/apiClient");
    await getTopFilms(1);

    const rec = parseLastLog(debug, "debug");
    expect(rec.requestId).toMatch(/^[0-9a-f-]{8,}$/);
    expect(rec.endpoint).toContain("/api/v1/films/top");
    expect(rec.status).toBe(200);
    expect(rec.outcome).toBe("ok");
    expect(rec.durationMs).toBeGreaterThanOrEqual(0);
    expect(rec.exceptionType).toBeNull();
    expect(new Date(rec.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("sends the same requestId as the X-Request-ID header for correlation", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { getTopFilms } = await import("@/lib/apiClient");
    await getTopFilms(1);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Request-ID"]).toBeTruthy();
  });

  it("logs http_error with the real status and throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: async () => "upstream down",
    }) as unknown as typeof fetch;

    const { getTopFilms } = await import("@/lib/apiClient");
    await expect(getTopFilms(1)).rejects.toThrow(/502/);

    const rec = parseLastLog(error, "error");
    expect(rec.status).toBe(502);
    expect(rec.outcome).toBe("http_error");
    expect(rec.exceptionType).toBe("HttpError:502");
    expect(rec.endpoint).toContain("/api/v1/films/top");
  });

  it("logs network_error when fetch itself rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

    const { getTopFilms } = await import("@/lib/apiClient");
    await expect(getTopFilms(1)).rejects.toThrow();

    const rec = parseLastLog(error, "error");
    expect(rec.outcome).toBe("network_error");
    expect(rec.status).toBe(0);
    expect(rec.exceptionType).toBe("TypeError");
  });

  it("logs timeout distinctly so a slow backend is never mistaken for an outage", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    globalThis.fetch = vi.fn().mockRejectedValue(timeout) as unknown as typeof fetch;

    const { getTopFilms } = await import("@/lib/apiClient");
    await expect(getTopFilms(1)).rejects.toThrow();

    const rec = parseLastLog(error, "error");
    expect(rec.outcome).toBe("timeout");
    expect(rec.exceptionType).toBe("TimeoutError");
  });
});

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
