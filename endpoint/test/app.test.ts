import { describe, expect, it, vi } from "vitest";

import { createApp, type MarketSnapshot, type MarketService } from "../src/app";

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

  it.each([
    [200, true, "live - endpoint responded but did not ask for payment"],
    [302, true, "reachable - endpoint responded with HTTP 302"],
    [404, true, "suspicious - endpoint responded with HTTP 404"],
    [503, false, "unhealthy - upstream responded with HTTP 503"]
  ])(
    "interprets upstream HTTP %i without inventing a quality score",
    async (status, alive, interpretation) => {
      const app = createApp({
        snapshot,
        fetchFn: vi.fn(async () => new Response(null, { status }))
      });

      const response = await app.fetch(post("/v1/verify", { agentId: "#3152" }));

      await expect(response.json()).resolves.toMatchObject({
        alive,
        http_status: status,
        interpretation
      });
    }
  );

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
      low_sample: true,
      price_min: 0.01,
      price_median: 0.05,
      price_max: 0.55,
      snapshot_date: "2026-07-23"
    });
  });

  it("rejects an empty quote need cleanly", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    const response = await app.fetch(post("/v1/quote", { need: "  " }));

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_NEED" }
    });
  });

  it("returns a transparent empty range when no priced service matches", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    const response = await app.fetch(
      post("/v1/quote", { need: "nonexistent-zebra-capability" })
    );

    await expect(response.json()).resolves.toMatchObject({
      matches: 0,
      price_min: null,
      price_median: null,
      price_max: null,
      note: "no matching priced services in snapshot; liveness is never cached"
    });
  });

  it("calculates an even-sized market median", async () => {
    const evenSnapshot: MarketSnapshot = {
      ...snapshot,
      services: [
        ...snapshot.services,
        {
          ...snapshot.services[0]!,
          agent_id: "7777",
          fee: 0.15,
          endpoint: "https://fourth.example.test/news"
        }
      ]
    };
    const app = createApp({ snapshot: evenSnapshot, fetchFn: vi.fn() });

    const response = await app.fetch(post("/v1/quote", { need: "crypto news" }));

    await expect(response.json()).resolves.toMatchObject({
      matches: 4,
      price_median: 0.1
    });
  });

  it("excludes single-token outliers when a full-token sample exists", async () => {
    // Five services genuinely about "crypto news", plus one priced outlier that
    // only shares the word "crypto". The outlier must not widen the range.
    const base = snapshot.services[0]!;
    const fullMatches: MarketService[] = [0.01, 0.02, 0.03, 0.04, 0.05].map(
      (fee, i) => ({
        ...base,
        agent_id: `full-${i}`,
        fee,
        endpoint: `https://full-${i}.example.test/news`,
        search_text: "crypto news headlines market wire"
      })
    );
    const outlier: MarketService = {
      ...base,
      agent_id: "outlier",
      fee: 66,
      endpoint: "https://outlier.example.test/bot",
      search_text: "crypto trading bot signals"
    };
    const app = createApp({
      snapshot: { ...snapshot, services: [...fullMatches, outlier] },
      fetchFn: vi.fn()
    });

    const response = await app.fetch(post("/v1/quote", { need: "crypto news" }));

    await expect(response.json()).resolves.toMatchObject({
      matches: 5,
      price_min: 0.01,
      price_max: 0.05
    });
  });

  it("flags low_sample when a need matches fewer than five services", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    // The fixture has 3 crypto-news services — below the 5-sample floor.
    const response = await app.fetch(post("/v1/quote", { need: "crypto news" }));

    await expect(response.json()).resolves.toMatchObject({
      matches: 3,
      low_sample: true
    });
  });

  it("does not flag low_sample when the sample is large enough", async () => {
    const base = snapshot.services[0]!;
    const many: MarketService[] = Array.from({ length: 6 }, (_, i) => ({
      ...base,
      agent_id: `m-${i}`,
      fee: 0.01 * (i + 1),
      endpoint: `https://m-${i}.example.test/news`,
      search_text: "crypto news headlines market"
    }));
    const app = createApp({
      snapshot: { ...snapshot, services: many },
      fetchFn: vi.fn()
    });

    await expect(
      app.fetch(post("/v1/quote", { need: "crypto news" })).then((r) => r.json())
    ).resolves.toMatchObject({ matches: 6, low_sample: false });
  });

  it("relaxes to a partial match when a full-token match is too thin", async () => {
    // Only one service matches all of "swap tokens dex"; the rest match one
    // token. Rather than return a single-item range, it relaxes the threshold.
    const base = snapshot.services[0]!;
    const services: MarketService[] = [
      { ...base, agent_id: "s0", fee: 0.1, search_text: "swap tokens dex router" },
      { ...base, agent_id: "s1", fee: 0.2, search_text: "swap tokens aggregator" },
      { ...base, agent_id: "s2", fee: 0.3, search_text: "swap liquidity pool" }
    ];
    const app = createApp({
      snapshot: { ...snapshot, services },
      fetchFn: vi.fn()
    });

    const response = await app.fetch(post("/v1/quote", { need: "swap tokens dex" }));
    const body = (await response.json()) as { matches: number };
    expect(body.matches).toBeGreaterThan(1);
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

  it.each([
    [0.05, "at median"],
    [0.01, "5x below median"],
    [0, "free; below median"]
  ])("describes a proposed price of %s", async (price, pricePosition) => {
    const app = createApp({
      snapshot,
      fetchFn: vi.fn(async () => new Response(null, { status: 402 }))
    });

    const response = await app.fetch(
      post("/v1/check", { agentId: "3152", price })
    );

    await expect(response.json()).resolves.toMatchObject({
      price_position: pricePosition
    });
  });

  it("handles a zero-price market median", async () => {
    const zeroSnapshot: MarketSnapshot = {
      captured_at: snapshot.captured_at,
      source: "zero-price test",
      services: [
        {
          ...snapshot.services[0]!,
          fee: 0,
          service_name: "Free Ping",
          search_text: "free ping"
        }
      ]
    };
    const app = createApp({
      snapshot: zeroSnapshot,
      fetchFn: vi.fn(async () => new Response(null, { status: 402 }))
    });

    const response = await app.fetch(
      post("/v1/check", { agentId: "3152", price: 1 })
    );

    await expect(response.json()).resolves.toMatchObject({
      market_median: 0,
      price_position: "above a zero-price median"
    });
  });

  it("handles a check with no comparable market service", async () => {
    const unmatchedSnapshot: MarketSnapshot = {
      ...snapshot,
      services: [
        {
          ...snapshot.services[0]!,
          service_name: "Invisible",
          search_text: ""
        }
      ]
    };
    const app = createApp({
      snapshot: unmatchedSnapshot,
      fetchFn: vi.fn(async () => new Response(null, { status: 402 }))
    });

    const response = await app.fetch(
      post("/v1/check", { agentId: "3152", price: 1 })
    );

    await expect(response.json()).resolves.toMatchObject({
      market_matches: 0,
      market_median: null,
      price_position: "no market comparison available"
    });
  });

  it.each([
    [{}, "INVALID_AGENT_ID"],
    [{ agentId: [] }, "INVALID_AGENT_ID"],
    [{ agentId: "bad id!" }, "INVALID_AGENT_ID"],
    [{ agentId: "3152", price: -1 }, "INVALID_PRICE"],
    [{ agentId: "3152", price: "0.55" }, "INVALID_PRICE"]
  ])("validates check input %#", async (body, code) => {
    const app = createApp({
      snapshot,
      fetchFn: vi.fn(async () => new Response(null, { status: 402 }))
    });

    const response = await app.fetch(post("/v1/check", body));

    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it.each([null, [], "text", 42])(
    "rejects a non-object JSON body: %j",
    async (body) => {
      const app = createApp({ snapshot, fetchFn: vi.fn() });

      const response = await app.fetch(post("/v1/quote", body));

      await expect(response.json()).resolves.toMatchObject({
        error: { code: "INVALID_BODY" }
      });
    }
  );

  it.each([
    "https://user:secret@example.test/probe",
    "https://localhost/probe",
    "https://service.local/probe",
    "https://service.internal/probe",
    "https://10.0.0.1/probe",
    "https://169.254.1.1/probe",
    "https://172.16.1.1/probe",
    "https://192.168.1.1/probe",
    "https://224.0.0.1/probe",
    "https://[::1]/probe",
    "not a URL"
  ])("blocks unsafe marketplace endpoint %s", async (endpoint) => {
    const unsafeSnapshot: MarketSnapshot = {
      ...snapshot,
      services: [{ ...snapshot.services[0]!, endpoint }]
    };
    const fetchFn = vi.fn();
    const app = createApp({ snapshot: unsafeSnapshot, fetchFn });

    const response = await app.fetch(post("/v1/verify", { agentId: 3152 }));

    expect(fetchFn).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNSAFE_ENDPOINT" }
    });
  });

  it("permits a public HTTPS IP endpoint from the immutable snapshot", async () => {
    const publicIpSnapshot: MarketSnapshot = {
      ...snapshot,
      services: [
        {
          ...snapshot.services[0]!,
          endpoint: "https://8.8.8.8/probe"
        }
      ]
    };
    const fetchFn = vi.fn(async () => new Response(null, { status: 402 }));
    const app = createApp({ snapshot: publicIpSnapshot, fetchFn });

    await app.fetch(post("/v1/verify", { agentId: 3152 }));

    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("returns a clean error for an agent without an A2MCP endpoint", async () => {
    const noEndpointSnapshot: MarketSnapshot = {
      ...snapshot,
      services: [
        {
          ...snapshot.services[0]!,
          service_type: "A2A",
          endpoint: null
        }
      ]
    };
    const app = createApp({ snapshot: noEndpointSnapshot, fetchFn: vi.fn() });

    const response = await app.fetch(post("/v1/verify", { agentId: "3152" }));

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AGENT_NOT_FOUND" }
    });
  });

  it("contains unexpected internal failures in a JSON envelope", async () => {
    const brokenSnapshot = {
      ...snapshot,
      services: null
    } as unknown as MarketSnapshot;
    const app = createApp({ snapshot: brokenSnapshot, fetchFn: vi.fn() });

    const response = await app.fetch(post("/v1/quote", { need: "crypto news" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR" }
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

  it("serves an HTML landing page on GET /", async () => {
    const app = createApp({ snapshot, fetchFn: vi.fn() });

    const response = await app.fetch(new Request("https://margn.example.test/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("<title>Margn");
  });

  it("exposes the platform's own scores on verify", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 402 }));
    const app = createApp({ snapshot, fetchFn });

    const response = await app.fetch(post("/v1/verify", { agentId: "2013" }));
    const body = (await response.json()) as Record<string, any>;

    expect(body.platform_scores).toEqual({
      sold_count: 1670,
      feedback_rate: 100,
      security_rate: 5
    });
  });

  describe("multi-service agents", () => {
    const multi: MarketSnapshot = {
      captured_at: "2026-07-23T12:55:23Z",
      source: "test fixture",
      services: [
        {
          agent_id: "3152",
          agent_name: "Example",
          service_name: "Crypto News Feed",
          service_type: "A2MCP",
          fee: 0.55,
          endpoint: "https://a.example.test/api",
          sold_count: 3,
          feedback_rate: 90,
          security_rate: 4,
          search_text: "crypto news feed"
        },
        {
          agent_id: "3152",
          agent_name: "Example",
          service_name: "Weather Now",
          service_type: "A2MCP",
          fee: 0.02,
          endpoint: "https://b.example.test/api",
          sold_count: 1,
          feedback_rate: 100,
          security_rate: 5,
          search_text: "weather forecast now"
        }
      ]
    };

    it("refuses to guess and returns AMBIGUOUS_SERVICE with choices", async () => {
      const fetchFn = vi.fn();
      const app = createApp({ snapshot: multi, fetchFn });

      const response = await app.fetch(post("/v1/verify", { agentId: "3152" }));
      const body = (await response.json()) as Record<string, any>;

      expect(fetchFn).not.toHaveBeenCalled();
      expect(body.error.code).toBe("AMBIGUOUS_SERVICE");
      expect(body.services).toHaveLength(2);
    });

    it("probes the named service when serviceName is given", async () => {
      const fetchFn = vi.fn(async () => new Response("", { status: 402 }));
      const app = createApp({ snapshot: multi, fetchFn });

      const response = await app.fetch(
        post("/v1/verify", { agentId: "3152", serviceName: "Weather Now" })
      );
      const body = (await response.json()) as Record<string, any>;

      expect(body.service_name).toBe("Weather Now");
      expect(fetchFn).toHaveBeenCalledWith(
        "https://b.example.test/api",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("returns SERVICE_NOT_FOUND for a name the agent does not expose", async () => {
      const app = createApp({ snapshot: multi, fetchFn: vi.fn() });

      const response = await app.fetch(
        post("/v1/verify", { agentId: "3152", serviceName: "Nope" })
      );
      const body = (await response.json()) as Record<string, any>;

      expect(body.error.code).toBe("SERVICE_NOT_FOUND");
    });
  });

  it("check compares against the buyer's stated need", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 402 }));
    const app = createApp({ snapshot, fetchFn });

    const response = await app.fetch(
      post("/v1/check", { agentId: "3152", price: 0.55, need: "crypto news" })
    );
    const body = (await response.json()) as Record<string, any>;

    // "crypto news" matches all three priced news services, not just #3152's own.
    expect(body.market_matches).toBeGreaterThanOrEqual(2);
    expect(typeof body.price_position).toBe("string");
  });
});
