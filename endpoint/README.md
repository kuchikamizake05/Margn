# Margn endpoint

Cloudflare Worker implementing the three free Margn pre-purchase services:

- `POST /v1/verify` with `{"agentId":"3152"}`
- `POST /v1/quote` with `{"need":"crypto news"}`
- `POST /v1/check` with `{"agentId":"3152","price":0.55}`

Every service response is JSON. Upstream probe failures and validation failures
return a structured `error` field without exposing a server exception. Route
and method errors retain their normal HTTP `404` and `405` status.

## Local verification

```shell
npm install
npm run build:snapshot
npm test
npm run test:coverage
npm run check
npm run build
```

The bundled snapshot is generated from
`../research/marketplace-scan/agents-2026-07-23T1955.json`. Regenerate and
commit it whenever the marketplace scan changes.

Start a local Worker:

```shell
npm run dev
```

Then call it:

```shell
curl -X POST http://localhost:8787/v1/quote \
  -H "content-type: application/json" \
  -d '{"need":"crypto news"}'
```

## Deployment handoff

Do not deploy until the final domain decision is made. Once approved:

1. Authenticate Wrangler with the intended Cloudflare account.
2. Run `npm run deploy`.
3. Route the final domain to the Worker.
4. Probe all three public URLs repeatedly, including malformed inputs and an
   agent whose upstream endpoint is unavailable.
5. Put that exact base URL into `../docs/listing.md` before agent registration.

The marketplace registration URL is treated as permanent. Code may change
behind the same URL without updating the agent registry.
