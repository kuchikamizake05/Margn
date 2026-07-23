import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const endpointDir = resolve(scriptDir, "..");
const repositoryDir = resolve(endpointDir, "..");
const inputPath = resolve(
  repositoryDir,
  "research",
  "marketplace-scan",
  "agents-2026-07-23T1955.json"
);
const outputPath = resolve(endpointDir, "data", "market-snapshot.json");

const raw = JSON.parse(await readFile(inputPath, "utf8"));
const services = [];

for (const agent of Object.values(raw.agents ?? {})) {
  for (const service of agent.services ?? []) {
    const fee = Number(service.feeAmount);
    if (!Number.isFinite(fee) || fee < 0 || service.feeAmount === "") {
      continue;
    }

    const endpoint =
      typeof service.endpoint === "string" && service.endpoint.trim() !== ""
        ? service.endpoint.trim()
        : null;
    const searchText = [
      agent.name,
      agent.profileDescription,
      ...(agent.categoryName ?? []),
      service.serviceName,
      service.serviceDescription
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("en-US");

    services.push({
      agent_id: String(agent.agentId),
      agent_name: String(agent.name ?? `Agent ${agent.agentId}`),
      service_name: String(service.serviceName ?? "Unnamed service"),
      service_type: String(service.serviceType ?? "unknown"),
      fee,
      endpoint,
      sold_count: Number(agent.soldCount ?? 0),
      feedback_rate:
        typeof agent.feedbackRate === "number" ? agent.feedbackRate : null,
      security_rate:
        typeof agent.securityRate === "number" ? agent.securityRate : null,
      search_text: searchText
    });
  }
}

services.sort(
  (left, right) =>
    left.agent_id.localeCompare(right.agent_id, "en", { numeric: true }) ||
    left.service_name.localeCompare(right.service_name)
);

const capturedAt = String(raw.scanned_at ?? "");
const snapshot = {
  captured_at: /^\d{4}-\d{2}-\d{2}T/.test(capturedAt)
    ? `${capturedAt}+07:00`
    : capturedAt,
  source: `union ${raw.queries?.length ?? 0} query onchainos agent search`,
  services
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");

console.log(
  `Wrote ${services.length} priced services to ${outputPath} from ${inputPath}`
);
