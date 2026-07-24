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
  platform_scores: {
    sold_count: number;
    feedback_rate: number | null;
    security_rate: number | null;
  };
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

// Human-facing landing page so clicking the Worker URL in a browser (a GET)
// shows a live product surface instead of the JSON 405 that POST-only routes
// return. Self-contained: inline CSS/JS, same-origin fetch to the real routes.
const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Margn — pre-purchase check for OKX.AI</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 2rem 1.25rem; min-height: 100vh;
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif;
    background: #0d0f14; color: #e7e9ee;
    display: flex; flex-direction: column; align-items: center;
  }
  main { width: 100%; max-width: 640px; }
  h1 { font-size: 1.9rem; margin: 0 0 .25rem; letter-spacing: -.02em; }
  .tag { color: #8b93a7; margin: 0 0 2rem; }
  .card { background: #161923; border: 1px solid #262c3a; border-radius: 12px;
          padding: 1.1rem 1.15rem; margin-bottom: 1rem; }
  .card h2 { font-size: .82rem; text-transform: uppercase; letter-spacing: .08em;
             color: #9aa3b8; margin: 0 0 .1rem; }
  .card p { margin: 0 0 .8rem; color: #8b93a7; font-size: .85rem; }
  label { display: block; font-size: .78rem; color: #9aa3b8; margin: 0 0 .3rem; }
  .field { flex: 1; min-width: 0; }
  .row { display: flex; gap: .6rem; align-items: flex-end; flex-wrap: wrap; }
  input { width: 100%; min-width: 0; background: #0d0f14; border: 1px solid #2d3446;
          color: #e7e9ee; border-radius: 8px; padding: .55rem .7rem; font: inherit; }
  input:focus { outline: 2px solid #5b8cff; outline-offset: 0; border-color: transparent; }
  button { background: #5b8cff; color: #06122e; border: 0; border-radius: 8px;
           padding: .55rem 1rem; font: inherit; font-weight: 600; cursor: pointer; }
  button:hover { background: #77a0ff; }
  button:disabled { opacity: .55; cursor: wait; }
  .result { margin-top: .9rem; }
  .badge { display: inline-block; font-size: .8rem; font-weight: 600;
           padding: .3rem .7rem; border-radius: 999px; }
  .badge.ok { background: #12351f; color: #6ee7a0; }
  .badge.warn { background: #3a2f0e; color: #f4c860; }
  .badge.bad { background: #3a1417; color: #f78a90; }
  .badge.info { background: #1c2740; color: #8fb0ff; }
  details { margin-top: .7rem; }
  summary { cursor: pointer; color: #8b93a7; font-size: .8rem; }
  pre { background: #0b0d12; border: 1px solid #232838; border-radius: 8px;
        padding: .8rem; margin: .6rem 0 0; overflow-x: auto; font-size: .8rem;
        color: #c6ccdc; white-space: pre-wrap; word-break: break-word; }
  footer { color: #6b7285; font-size: .8rem; margin-top: 1.5rem; text-align: center; }
  code { color: #b8c1d9; }
  a { color: #77a0ff; }
  @media (max-width: 460px) {
    .row { flex-direction: column; align-items: stretch; }
    button { width: 100%; }
  }
</style>
</head>
<body>
<main>
  <h1>Margn</h1>
  <p class="tag">A pre-purchase check for OKX.AI buyers — liveness, market price, and the platform's own scores, before you confirm. A layer on top of <code>asp-match</code>, never a replacement.</p>

  <section class="card">
    <h2>verify</h2>
    <p>Live liveness probe of an agent's endpoint. Never cached.</p>
    <div class="row">
      <div class="field">
        <label for="verify-id">Agent ID</label>
        <input id="verify-id" value="1500" />
      </div>
      <button data-run="verify">Probe</button>
    </div>
    <div class="result" id="verify-out"></div>
  </section>

  <section class="card">
    <h2>quote</h2>
    <p>Market price range for a need, from the snapshot.</p>
    <div class="row">
      <div class="field">
        <label for="quote-need">Need</label>
        <input id="quote-need" value="crypto news" />
      </div>
      <button data-run="quote">Quote</button>
    </div>
    <div class="result" id="quote-out"></div>
  </section>

  <section class="card">
    <h2>check</h2>
    <p>Liveness + where a price sits vs the market median.</p>
    <div class="row">
      <div class="field">
        <label for="check-id">Agent ID</label>
        <input id="check-id" value="1500" />
      </div>
      <div class="field">
        <label for="check-price">Price</label>
        <input id="check-price" value="0.1" inputmode="decimal" />
      </div>
      <button data-run="check">Check</button>
    </div>
    <div class="result" id="check-out"></div>
  </section>

  <footer>Machine interface: <code>POST /v1/verify · /v1/quote · /v1/check</code></footer>
</main>
<script>
  const val = (id) => document.getElementById(id).value.trim();
  const bodyFor = {
    verify: () => ({ agentId: val('verify-id') }),
    quote: () => ({ need: val('quote-need') }),
    check: () => ({ agentId: val('check-id'), price: Number(val('check-price')) })
  };
  // Turn a verify/check response into a plain-language status badge; the raw
  // JSON always stays available in a details panel.
  function badgeFor(data) {
    if (data.error) return ['info', data.error.code];
    if (typeof data.alive !== 'boolean') return null;
    if (!data.alive) return ['bad', 'Unreachable'];
    if (/suspicious/i.test(data.interpretation || '')) return ['warn', 'Suspicious'];
    return ['ok', 'Healthy'];
  }
  document.querySelectorAll('button[data-run]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const route = btn.dataset.run;
      const out = document.getElementById(route + '-out');
      btn.disabled = true;
      out.innerHTML = '<span class="badge info">Running…</span>';
      try {
        const res = await fetch('/v1/' + route, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(bodyFor[route]())
        });
        const data = await res.json();
        const badge = badgeFor(data);
        const badgeHtml = badge
          ? '<span class="badge ' + badge[0] + '">' + badge[1] + '</span>'
          : '';
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(data, null, 2);
        out.innerHTML = badgeHtml +
          '<details' + (badge ? '' : ' open') + '><summary>Raw response</summary></details>';
        out.querySelector('details').appendChild(pre);
      } catch (err) {
        out.innerHTML = '<span class="badge bad">Request failed</span>';
      } finally {
        btn.disabled = false;
      }
    });
  });
</script>
</body>
</html>`;

const LANDING_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

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

interface ServiceSummary {
  service_name: string;
  service_type: string;
  fee: number;
}

type ServiceResolution =
  | { ok: true; service: MarketService }
  | { ok: false; payload: Record<string, unknown> };

function serviceSummary(service: MarketService): ServiceSummary {
  return {
    service_name: service.service_name,
    service_type: service.service_type,
    fee: service.fee
  };
}

// Some agents expose 80+ services; dumping all of them is honest but noisy, so
// cap the listed choices and report the true total alongside.
const MAX_LISTED_SERVICES = 15;

function serviceChoices(candidates: MarketService[]): {
  services: ServiceSummary[];
  services_total: number;
} {
  return {
    services: candidates.slice(0, MAX_LISTED_SERVICES).map(serviceSummary),
    services_total: candidates.length
  };
}

function probeableServices(
  snapshot: MarketSnapshot,
  agentId: string
): MarketService[] {
  return snapshot.services
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
}

// Never guess which service to probe. A single-service agent resolves with no
// friction; a multi-service agent (239 in the snapshot) requires an explicit
// serviceName, otherwise we return AMBIGUOUS_SERVICE with the choices so the
// buyer picks — probing the wrong endpoint would be a silent correctness bug.
function resolveService(
  snapshot: MarketSnapshot,
  agentId: string,
  serviceName: string | null
): ServiceResolution {
  const candidates = probeableServices(snapshot, agentId);
  if (candidates.length === 0) {
    return {
      ok: false,
      payload: error(
        "AGENT_NOT_FOUND",
        "Agent has no probeable A2MCP endpoint in the current snapshot."
      )
    };
  }

  if (serviceName) {
    const wanted = serviceName.trim().toLocaleLowerCase("en-US");
    const matched = candidates.filter(
      (service) => service.service_name.toLocaleLowerCase("en-US") === wanted
    );
    if (matched[0]) {
      return { ok: true, service: matched[0] };
    }
    return {
      ok: false,
      payload: {
        ...error(
          "SERVICE_NOT_FOUND",
          "This agent has no probeable service with that name; pick one below."
        ),
        ...serviceChoices(candidates)
      }
    };
  }

  if (candidates.length > 1) {
    return {
      ok: false,
      payload: {
        ...error(
          "AMBIGUOUS_SERVICE",
          "This agent exposes multiple services; pass serviceName to pick one."
        ),
        ...serviceChoices(candidates)
      }
    };
  }

  return { ok: true, service: candidates[0]! };
}

function normalizeServiceName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, 128);
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
    probed_at: new Date(finishedAt).toISOString(),
    platform_scores: {
      sold_count: service.sold_count,
      feedback_rate: service.feedback_rate,
      security_rate: service.security_rate
    }
  };
}

async function verifyAgent(
  snapshot: MarketSnapshot,
  agentId: string,
  serviceName: string | null,
  fetchFn: FetchLike,
  now: () => number,
  timeoutMs: number
): Promise<VerifyResult | Record<string, unknown>> {
  const resolved = resolveService(snapshot, agentId, serviceName);
  if (!resolved.ok) {
    return resolved.payload;
  }
  const service = resolved.service;
  const endpoint = service.endpoint;
  if (!endpoint) {
    return error(
      "AGENT_NOT_FOUND",
      "Agent has no probeable A2MCP endpoint in the current snapshot."
    );
  }

  const startedAt = now();
  if (!isSafePublicHttpsEndpoint(endpoint)) {
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
    const response = await fetchFn(endpoint, {
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

  const minRequired = tokens.length >= 2 ? 2 : 1;
  let fallbackHits: MarketService[] = [];

  for (let required = tokens.length; required >= minRequired; required--) {
    const hits = scored
      .filter((entry) => entry.hits >= required)
      .map((entry) => entry.service);

    if (hits.length >= MIN_QUOTE_SAMPLE) {
      return hits;
    }
    if (hits.length > 0) {
      fallbackHits = hits;
    }
  }

  return fallbackHits;
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
        if (
          (request.method === "GET" || request.method === "HEAD") &&
          url.pathname === "/"
        ) {
          const body = request.method === "HEAD" ? null : LANDING_HTML;
          return new Response(body, { status: 200, headers: LANDING_HEADERS });
        }
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

        const serviceName = normalizeServiceName(parsed.value.serviceName);
        const verification = await verifyAgent(
          snapshot,
          agentId,
          serviceName,
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

        // Compare against the buyer's stated need when given; otherwise fall
        // back to the resolved service name so check still works standalone.
        const need =
          typeof parsed.value.need === "string" ? parsed.value.need.trim() : "";
        let quoteNeed = need;
        if (!quoteNeed) {
          const resolved = resolveService(snapshot, agentId, serviceName);
          quoteNeed = resolved.ok ? resolved.service.service_name : "";
        }
        const quote = buildQuote(snapshot, quoteNeed);
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
