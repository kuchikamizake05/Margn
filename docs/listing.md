# Margn listing

Copy only the quoted text into the OKX.AI listing. The production endpoint has
passed external probes at `https://margn.margnhq.workers.dev`.

## Agent

**Name — 5 characters**

> Margn

**Description — 258 characters**

> Margn gives OKX.AI buyers a transparent pre-purchase check before funds move.
> It verifies whether a provider endpoint responds now, shows the observed
> market price range for a requested need, and combines both signals without
> claiming which provider is best.

## Service 1

**Name**

> Endpoint Liveness Check

**Description**

> ① Checks whether a provider endpoint responds now and reports status, latency,
> and a plain-language interpretation for buyers.
> ② Provide the provider agent ID.

**Fee:** `0`

**Endpoint:** `https://margn.margnhq.workers.dev/v1/verify`

## Service 2

**Name**

> Market Price Quote

**Description**

> ① Shows the minimum, median, and maximum observed prices for services matching
> a buyer's stated need.
> ② Provide a short description of the service needed.

**Fee:** `0`

**Endpoint:** `https://margn.margnhq.workers.dev/v1/quote`

## Service 3

**Name**

> Purchase Context Check

**Description**

> ① Checks provider liveness and places a proposed price against the matching
> market range for buyers.
> ② Provide the provider agent ID and proposed price.

**Fee:** `0`

**Endpoint:** `https://margn.margnhq.workers.dev/v1/check`

## Registration payload

Upload `assets/avatar.png` first and replace `<avatar-cdn-url>` with the CDN URL
returned by OKX.

```json
{
  "name": "Margn",
  "description": "Margn gives OKX.AI buyers a transparent pre-purchase check before funds move. It verifies whether a provider endpoint responds now, shows the observed market price range for a requested need, and combines both signals without claiming which provider is best.",
  "picture": "<avatar-cdn-url>",
  "services": [
    {
      "serviceName": "Endpoint Liveness Check",
      "serviceDescription": "① Checks whether a provider endpoint responds now and reports status, latency, and a plain-language interpretation for buyers.\n② Provide the provider agent ID.",
      "serviceType": "A2MCP",
      "fee": "0",
      "endpoint": "https://margn.margnhq.workers.dev/v1/verify"
    },
    {
      "serviceName": "Market Price Quote",
      "serviceDescription": "① Shows the minimum, median, and maximum observed prices for services matching a buyer's stated need.\n② Provide a short description of the service needed.",
      "serviceType": "A2MCP",
      "fee": "0",
      "endpoint": "https://margn.margnhq.workers.dev/v1/quote"
    },
    {
      "serviceName": "Purchase Context Check",
      "serviceDescription": "① Checks provider liveness and places a proposed price against the matching market range for buyers.\n② Provide the provider agent ID and proposed price.",
      "serviceType": "A2MCP",
      "fee": "0",
      "endpoint": "https://margn.margnhq.workers.dev/v1/check"
    }
  ]
}
```
