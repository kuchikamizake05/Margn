import { describe, expect, it } from "vitest";

import worker from "../src/index";

describe("bundled Worker", () => {
  it("serves a quote from the generated marketplace snapshot", async () => {
    const request = new Request("https://margn.example.test/v1/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ need: "crypto news" })
    });

    const response = await worker.fetch(request);
    const body = (await response.json()) as {
      need: string;
      matches: number;
      price_min: number;
      price_median: number;
      price_max: number;
      snapshot_date: string;
      note: string;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      need: "crypto news",
      snapshot_date: "2026-07-23",
      note: "prices from snapshot; liveness is never cached"
    });
    expect(body.matches).toBeGreaterThan(0);
    expect(body.price_min).toBeLessThanOrEqual(body.price_median);
    expect(body.price_median).toBeLessThanOrEqual(body.price_max);
  });

  it("contains validation errors without an upstream request", async () => {
    const request = new Request("https://margn.example.test/v1/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "does-not-exist" })
    });

    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AGENT_NOT_FOUND" }
    });
  });
});
