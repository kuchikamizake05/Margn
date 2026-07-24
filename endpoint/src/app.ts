export interface MarketService {
  agent_id: string;
  agent_name: string;
  service_name: string;
  service_type: string;
  fee: number;
  endpoint: string | null;
  sold_count: number;
  feedback_rate: number | null;
  security_rate: number | null;
  search_text: string;
}

export interface MarketSnapshot {
  captured_at: string;
  source: string;
  services: MarketService[];
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

interface AppDependencies {
  snapshot: MarketSnapshot;
  fetchFn?: FetchLike;
  now?: () => number;
  timeoutMs?: number;
}

interface VerifyResult {
  agent_id: string;
  agent_name: string;
  service_name: string;
  endpoint: string | null;
  alive: boolean;
  http_status: number | null;
  interpretation: string;
  latency_ms: number;
  probed_at: string;
  error?: {
    code: string;
    message: string;
  };
}

const RESPONSE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "get",
  "in",
  "latest",
  "of",
  "on",
  "please",
  "the",
  "to",
  "with"
]);

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: RESPONSE_HEADERS
  });
}

function error(code: string, message: string): {
  error: { code: string; message: string };
} {
  return { error: { code, message } };
}

async function readJsonObject(
  request: Request
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {
        ok: false,
        response: json(error("INVALID_BODY", "Request body must be a JSON object."))
      };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: json(error("INVALID_JSON", "Request body must contain valid JSON."))
    };
  }
}

function normalizeAgentId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const normalized = String(value).trim().replace(/^#/, "");
  return /^[A-Za-z0-9_-]{1,64}$/.test(normalized) ? normalized : null;
}

function selectProbeTarget(
  snapshot: MarketSnapshot,
  agentId: string
): MarketService | null {
  const candidates = snapshot.services
    .filter(
      (service) =>
        service.agent_id === agentId &&
        service.service_type.toUpperCase() === "A2MCP" &&
        Boolean(service.endpoint)
    )
    .sort(
      (left, right) =>
        left.fee - right.fee ||
        left.service_name.localeCompare(right.service_name)
    );

  return candidates[0] ?? null;
}

function isSafePublicHttpsEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hostname === ""
  ) {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.includes("[") ||
    hostname.includes("]")
  ) {
    return false;
  }

  const octets = hostname.split(".").map(Number);
  if (
    octets.length === 4 &&
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
  ) {
    const [first = 0, second = 0] = octets;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }

  return true;
}

function interpretStatus(status: number): Pick<
  VerifyResult,
  "alive" | "interpretation"
> {
  if (status === 402) {
    return {
      alive: true,
      interpretation: "healthy - endpoint is live and asking for payment"
    };
  }
  if (status === 200) {
    return {
      alive: true,
      interpretation: "live - endpoint responded but did not ask for payment"
    };
  }
  if (status >= 400 && status < 500) {
    return {
      alive: true,
      interpretation: `suspicious - endpoint responded with HTTP ${status}`
    };
  }
  if (status >= 500) {
    return {
      alive: false,
      interpretation: `unhealthy - upstream responded with HTTP ${status}`
    };
  }
  return {
    alive: true,
    interpretation: `reachable - endpoint responded with HTTP ${status}`
  };
}

function baseVerifyResult(
  service: MarketService,
  now: () => number,
  startedAt: number
): Omit<VerifyResult, "alive" | "http_status" | "interpretation"> {
  const finishedAt = now();
  return {
    agent_id: service.agent_id,
    agent_name: service.agent_name,
    service_name: service.service_name,
    endpoint: service.endpoint,
    latency_ms: Math.max(0, finishedAt - startedAt),
    probed_at: new Date(finishedAt).toISOString()
  };
}

async function verifyAgent(
  snapshot: MarketSnapshot,
  agentId: string,
  fetchFn: FetchLike,
  now: () => number,
  timeoutMs: number
): Promise<VerifyResult | { error: { code: string; message: string } }> {
  const service = selectProbeTarget(snapshot, agentId);
  if (!service || !service.endpoint) {
    return error(
      "AGENT_NOT_FOUND",
      "Agent has no probeable A2MCP endpoint in the current snapshot."
    );
  }

  const startedAt = now();
  if (!isSafePublicHttpsEndpoint(service.endpoint)) {
    return {
      ...baseVerifyResult(service, now, startedAt),
      alive: false,
      http_status: null,
      interpretation: "unreachable - endpoint URL is not safe to probe",
      error: {
        code: "UNSAFE_ENDPOINT",
        message: "Only public HTTPS endpoints from the snapshot may be probed."
      }
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchFn(service.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Margn-Liveness-Probe/1.0"
      },
      body: JSON.stringify({ probe: true, source: "margn" }),
      redirect: "manual",
      signal: controller.signal
    });
    const interpretation = interpretStatus(response.status);
    return {
      ...baseVerifyResult(service, now, startedAt),
      ...interpretation,
      http_status: response.status
    };
  } catch {
    if (timedOut) {
      return {
        ...baseVerifyResult(service, now, startedAt),
        alive: false,
        http_status: null,
        interpretation: `unreachable - probe timed out after ${timeoutMs}ms`,
        error: {
          code: "UPSTREAM_TIMEOUT",
          message: "The upstream endpoint did not respond before the deadline."
        }
      };
    }
    return {
      ...baseVerifyResult(service, now, startedAt),
      alive: false,
      http_status: null,
      interpretation: "unreachable - endpoint did not respond",
      error: {
        code: "UPSTREAM_UNREACHABLE",
        message: "The upstream endpoint could not be reached."
      }
    };
  } finally {
    clearTimeout(timeout);
  }
}

function tokenize(value: string): string[] {
  return [
    ...new Set(
      value
        .toLocaleLowerCase("en-US")
        .normalize("NFKD")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .split(/\s+/)
        .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    )
  ];
}

// Below this many matches the quote range is too thin to be meaningful, so we
// relax the token requirement rather than return a near-empty sample.
const MIN_QUOTE_SAMPLE = 5;

function matchingServices(
  snapshot: MarketSnapshot,
  need: string
): MarketService[] {
  const tokens = tokenize(need);
  if (tokens.length === 0) {
    return [];
  }

  const priced = snapshot.services.filter(
    (service) => Number.isFinite(service.fee) && service.fee >= 0
  );
  const scored = priced.map((service) => {
    const haystack = service.search_text.toLocaleLowerCase("en-US");
    return {
      service,
      hits: tokens.filter((token) => haystack.includes(token)).length
    };
  });

  // Prefer services that match ALL tokens; a single shared word like "crypto"
  // otherwise pulls in hundreds of unrelated services and blows the range.
  // Relax the threshold only when an all-tokens match is too thin to be useful.
  const majority = Math.max(1, Math.ceil(tokens.length / 2));
  for (const required of [tokens.length, majority]) {
    const hits = scored
      .filter((entry) => entry.hits >= required)
      .map((entry) => entry.service);
    if (hits.length >= MIN_QUOTE_SAMPLE || required === majority) {
      return hits;
    }
  }
  return [];
}

function median(sortedValues: number[]): number {
  const middle = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) {
    return sortedValues[middle] ?? 0;
  }
  return ((sortedValues[middle - 1] ?? 0) + (sortedValues[middle] ?? 0)) / 2;
}

function buildQuote(snapshot: MarketSnapshot, need: string) {
  const matches = matchingServices(snapshot, need);
  if (matches.length === 0) {
    return {
      need,
      matches: 0,
      low_sample: true,
      price_min: null,
      price_median: null,
      price_max: null,
      snapshot_date: snapshot.captured_at.slice(0, 10),
      note: "no matching priced services in snapshot; liveness is never cached"
    };
  }

  const prices = matches.map((service) => service.fee).sort((a, b) => a - b);
  const lowSample = matches.length < MIN_QUOTE_SAMPLE;
  return {
    need,
    matches: matches.length,
    low_sample: lowSample,
    price_min: prices[0] ?? null,
    price_median: median(prices),
    price_max: prices.at(-1) ?? null,
    snapshot_date: snapshot.captured_at.slice(0, 10),
    note: lowSample
      ? `only ${matches.length} matching service(s) — treat this range as indicative, not representative; liveness is never cached`
      : "prices from snapshot; liveness is never cached"
  };
}

function pricePosition(price: number, marketMedian: number | null): string {
  if (marketMedian === null) {
    return "no market comparison available";
  }
  if (price === marketMedian) {
    return "at median";
  }
  if (marketMedian === 0) {
    return price === 0 ? "at median" : "above a zero-price median";
  }
  if (price === 0) {
    return "free; below median";
  }

  const rawRatio =
    price > marketMedian ? price / marketMedian : marketMedian / price;
  const ratio = Number(rawRatio.toFixed(rawRatio >= 10 ? 1 : 2));
  return `${ratio}x ${price > marketMedian ? "above" : "below"} median`;
}

export function createApp(dependencies: AppDependencies): {
  fetch(request: Request): Promise<Response>;
} {
  const {
    snapshot,
    fetchFn = fetch,
    now = Date.now,
    timeoutMs = 5_000
  } = dependencies;

  return {
    async fetch(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url);
        if (request.method !== "POST") {
          return json(
            error("METHOD_NOT_ALLOWED", "Use POST for Margn service endpoints."),
            405
          );
        }

        if (!["/v1/verify", "/v1/quote", "/v1/check"].includes(url.pathname)) {
          return json(error("NOT_FOUND", "Route not found."), 404);
        }

        const parsed = await readJsonObject(request);
        if (!parsed.ok) {
          return parsed.response;
        }

        if (url.pathname === "/v1/quote") {
          const need =
            typeof parsed.value.need === "string" ? parsed.value.need.trim() : "";
          if (tokenize(need).length === 0) {
            return json(error("INVALID_NEED", "need must contain searchable text."));
          }
          return json(buildQuote(snapshot, need));
        }

        const agentId = normalizeAgentId(parsed.value.agentId);
        if (!agentId) {
          return json(
            error("INVALID_AGENT_ID", "agentId must be a non-empty string or number.")
          );
        }

        const verification = await verifyAgent(
          snapshot,
          agentId,
          fetchFn,
          now,
          timeoutMs
        );
        if (url.pathname === "/v1/verify" || "error" in verification) {
          return json(verification);
        }

        const price = parsed.value.price;
        if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
          return json(
            error("INVALID_PRICE", "price must be a finite number greater than or equal to 0.")
          );
        }

        const service = selectProbeTarget(snapshot, agentId);
        const quote = buildQuote(snapshot, service?.service_name ?? "");
        return json({
          ...verification,
          price,
          market_matches: quote.matches,
          market_low_sample: quote.low_sample,
          market_min: quote.price_min,
          market_median: quote.price_median,
          market_max: quote.price_max,
          price_position: pricePosition(price, quote.price_median),
          snapshot_date: quote.snapshot_date,
          note: quote.note
        });
      } catch {
        return json(
          error(
            "INTERNAL_ERROR",
            "Margn could not process the request, but no upstream payment was attempted."
          )
        );
      }
    }
  };
}
