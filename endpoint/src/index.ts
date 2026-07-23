import snapshot from "../data/market-snapshot.json";

import { createApp, type MarketSnapshot } from "./app";

const app = createApp({ snapshot: snapshot as MarketSnapshot });

export default {
  fetch(request: Request): Promise<Response> {
    return app.fetch(request);
  }
};
