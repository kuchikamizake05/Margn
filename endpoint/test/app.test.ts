import { describe, expect, it, vi } from "vitest";

import { createApp, type MarketSnapshot } from "../src/app";

const snapshot: MarketSnapshot = {
  captured_at: "2026-07-23T12:55:23Z",
  source: "test fixture",
  services: [
    {
      agent_id: "3152",
      agent_name: "Example News",
      service_name: "Crypto News Feed",
      service_type: "A2MCP",
      fee: 0.55,
      endpoint: "https://news.example.test/api",
      sold_count: 1,
      feedback_rate: 0,
      security_rate: 2,
      search_text: "crypto news feed latest headlines market"
    },
    {
      agent_id: "2013",
      agent_name: "Trusted News",
      service_name: "Latest Crypto News",
      service_type: "A2MCP",
      fee: 0.01,
      endpoint: "https://trusted.example.test/news",
      sold_count: 1670,
      feedback_rate: 100,
      security_rate: 5,
      search_text: "latest crypto news headlines"
    },
    {
      agent_id: "5634",
      agent_name: "Market Wire",
      service_name: "Crypto News",
      service_type: "A2MCP",
      fee: 0.05,
      endpoint: "https://wire.example.test/news",
      sold_count: 1,
      feedback_rate: 100,
      security_rate: 5,
      search_text: "crypto news market wire"
    },
    {
      agent_id: "9999",
      agent_name: "Unsafe",
      service_name: "Unsafe Probe",
      service_type: "A2MCP",
      fee: 0.1,
      endpoint: "http://127.0.0.1/admin",
      sold_count: 0,
      feedback_rate: null,
      security_rate: null,
      search_text: "unsafe probe"
    }
  ]
};

function post(path: string, body: unknown): Request {
  return new Request(`https://margn.example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("Margn API", () => {
  it("verifies a known agent with a live 402 endpoint", async () => {
    const fetchFn = vi.fn(async () => new Response("payment required", { status: 402 }));
    const app = createApp({ snapshot, fetchFn, now: () => 1_750_000_000_000 });

    const response = await app.fetch(post("/v1/verify", { agentId: "3152" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      agent_id: "3152",
      service_name: "Crypto News Feed",
      alive: true,
      http_status: 402,
      interpretation: "healthy - endpoint is live and asking for payment"
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://news.example.test/api",
      expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) })
    );
  });

  it("returns a clean error when the agent is unknown", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    const response = await app.fetch(post("/v1/verify", { agentId: "missing" }));

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AGENT_NOT_FOUND" }
    });
  });

  it("rejects malformed JSON without returning 500", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });
    const request = new Request("https://margn.example.test/v1/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });

    const response = await app.fetch(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_JSON" }
    });
  });

  it("blocks an unsafe endpoint from the snapshot", async () => {
    const fetchFn = vi.fn();
    const app = createApp({ snapshot, fetchFn });

    const response = await app.fetch(post("/v1/verify", { agentId: "9999" }));

    expect(fetchFn).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      alive: false,
      interpretation: "unreachable - endpoint URL is not safe to probe",
      error: { code: "UNSAFE_ENDPOINT" }
    });
  });

  it("turns an upstream failure into a clean unreachable result", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("network failed");
    });
    const app = createApp({ snapshot, fetchFn });

    const response = await app.fetch(post("/v1/verify", { agentId: "3152" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      alive: false,
      http_status: null,
      interpretation: "unreachable - endpoint did not respond",
      error: { code: "UPSTREAM_UNREACHABLE" }
    });
  });

  it("enforces the probe timeout", async () => {
    const fetchFn = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );
    const app = createApp({ snapshot, fetchFn, timeoutMs: 5 });

    const response = await app.fetch(post("/v1/verify", { agentId: "3152" }));

    await expect(response.json()).resolves.toMatchObject({
      alive: false,
      interpretation: "unreachable - probe timed out after 5ms",
      error: { code: "UPSTREAM_TIMEOUT" }
    });
  });

  it("quotes the min, median, and max matching prices", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    const response = await app.fetch(post("/v1/quote", { need: "crypto news" }));

    await expect(response.json()).resolves.toMatchObject({
      need: "crypto news",
      matches: 3,
      price_min: 0.01,
      price_median: 0.05,
      price_max: 0.55,
      snapshot_date: "2026-07-23",
      note: "prices from snapshot; liveness is never cached"
    });
  });

  it("rejects an empty quote need cleanly", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    const response = await app.fetch(post("/v1/quote", { need: "  " }));

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_NEED" }
    });
  });

  it("combines liveness with market price position", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 402 }));
    const app = createApp({ snapshot, fetchFn });

    const response = await app.fetch(
      post("/v1/check", { agentId: "3152", price: 0.55 })
    );
    const body = await response.json();

    expect(body).toMatchObject({
      agent_id: "3152",
      alive: true,
      price: 0.55,
      market_matches: 3,
      market_median: 0.05,
      price_position: "11x above median"
    });
  });

  it("returns method and route errors without throwing", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    const methodResponse = await app.fetch(
      new Request("https://margn.example.test/v1/verify")
    );
    const routeResponse = await app.fetch(post("/unknown", {}));

    expect(methodResponse.status).toBe(405);
    expect(routeResponse.status).toBe(404);
  });
});
