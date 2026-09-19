import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

/**
 * AdSlot rendering contract (SSR render in node — effects never run, which is
 * exactly the disabled-state guarantee: no script loading, no observers).
 */
async function renderSlot(env: Record<string, string | boolean>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as never);
  const { AdSlot } = await import("@/components/lumiere/AdSlot");
  return renderToString(<AdSlot placement="top100-after-20" />);
}

describe("AdSlot rendering", () => {
  it("renders NOTHING — empty output, zero DOM — while advertising is disabled", async () => {
    const html = await renderSlot({
      VITE_ADS_ENABLED: "false",
      VITE_SHOW_AD_SLOTS: "false",
      PROD: false,
    });
    expect(html).toBe("");
  });

  it("renders nothing for an unknown placement id", async () => {
    vi.resetModules();
    const { AdSlot } = await import("@/components/lumiere/AdSlot");
    expect(renderToString(<AdSlot placement="does-not-exist" />)).toBe("");
  });

  it("renders the dev slot preview box when VITE_SHOW_AD_SLOTS=true in a dev build", async () => {
    const html = await renderSlot({
      VITE_ADS_ENABLED: "false",
      VITE_SHOW_AD_SLOTS: "true",
      PROD: false,
    });
    // SSR renders text nodes with comment separators between them, so
    // assert the label and id independently.
    expect(html).toContain("AD SLOT");
    expect(html).toContain("top100-after-20");
  });

  it("never renders the dev preview in a production build, even with the flag set", async () => {
    const html = await renderSlot({
      VITE_ADS_ENABLED: "true",
      VITE_SHOW_AD_SLOTS: "true",
      PROD: true,
    });
    expect(html).not.toContain("AD SLOT ·");
    // Real surface: labelled, identified, reserved — but no <ins> creative
    // and no script activity while consent is unresolved.
    expect(html).toContain('data-ad-slot="top100-after-20"');
    expect(html).toContain('aria-label="Advertisement"');
    expect(html).not.toContain("<ins");
  });

  it("renders no creative while consent is unresolved (no window consent signal)", async () => {
    const html = await renderSlot({
      VITE_ADS_ENABLED: "true",
      VITE_SHOW_AD_SLOTS: "false",
      PROD: false,
    });
    expect(html).not.toContain("<ins");
    expect(html).toContain('data-ad-status="blocked"');
  });
});
