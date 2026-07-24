import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryDir = resolve(scriptDir, "..", "..");
const listingPath = resolve(repositoryDir, "docs", "listing.md");
const avatarPath = resolve(repositoryDir, "assets", "avatar.png");
const productionOrigin = "https://margn.margnhq.workers.dev";

const markdown = await readFile(listingPath, "utf8");
const jsonBlock = markdown.match(/```json\s+([\s\S]+?)\s+```/);
if (!jsonBlock?.[1]) {
  throw new Error("docs/listing.md must contain one JSON registration payload.");
}

const listing = JSON.parse(jsonBlock[1]);
const failures = [];

if (
  typeof listing.name !== "string" ||
  listing.name.length < 3 ||
  listing.name.length > 25 ||
  /test/i.test(listing.name)
) {
  failures.push("Agent name must be 3-25 characters and must not contain 'test'.");
}

if (
  typeof listing.description !== "string" ||
  listing.description.length === 0 ||
  listing.description.length > 500
) {
  failures.push("Agent description must contain 1-500 characters.");
}

if (!Array.isArray(listing.services) || listing.services.length !== 3) {
  failures.push("Exactly three services must be registered together.");
}

const prohibited = /(github|tech[- ]?stack|disclaimer|example prompt)/i;
for (const [index, service] of (listing.services ?? []).entries()) {
  const label = `Service ${index + 1}`;
  if (!service.serviceName || typeof service.serviceName !== "string") {
    failures.push(`${label} must have a name.`);
  }

  const lines =
    typeof service.serviceDescription === "string"
      ? service.serviceDescription.split("\n")
      : [];
  if (lines.length !== 2) {
    failures.push(`${label} description must contain exactly two lines.`);
  }
  for (const [lineIndex, line] of lines.entries()) {
    if (line.length === 0 || line.length > 200) {
      failures.push(`${label} line ${lineIndex + 1} must contain 1-200 characters.`);
    }
  }
  if (prohibited.test(service.serviceDescription ?? "")) {
    failures.push(`${label} description contains prohibited listing content.`);
  }
  if (
    service.serviceType !== "A2MCP" ||
    !/^\d+(?:\.\d{1,6})?$/.test(service.fee) ||
    Number(service.fee) !== 0
  ) {
    failures.push(`${label} must be a free A2MCP service with fee "0".`);
  }
  if (
    !new Set([
      `${productionOrigin}/v1/verify`,
      `${productionOrigin}/v1/quote`,
      `${productionOrigin}/v1/check`
    ]).has(service.endpoint)
  ) {
    failures.push(`${label} endpoint must use the approved production Worker.`);
  }
}

const avatar = await readFile(avatarPath);
const pngSignature = "89504e470d0a1a0a";
if (avatar.subarray(0, 8).toString("hex") !== pngSignature) {
  failures.push("assets/avatar.png is not a valid PNG.");
} else {
  const width = avatar.readUInt32BE(16);
  const height = avatar.readUInt32BE(20);
  if (width !== height) {
    failures.push(`Avatar must be square; found ${width}x${height}.`);
  }
  console.log(`Avatar: ${width}x${height}, ${avatar.length} bytes`);
}

console.log(`Agent name: ${listing.name.length}/25 characters`);
console.log(`Agent description: ${listing.description.length}/500 characters`);
for (const [index, service] of (listing.services ?? []).entries()) {
  const lengths = service.serviceDescription.split("\n").map((line) => line.length);
  console.log(`Service ${index + 1} description lines: ${lengths.join("/")} of 200`);
}

if (failures.length > 0) {
  throw new Error(`Listing validation failed:\n- ${failures.join("\n- ")}`);
}

console.log("Listing validation passed.");
