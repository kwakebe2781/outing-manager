import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = process.cwd();
const read = path => readFileSync(resolve(root, path), "utf8");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const html = read("index.html");
const worker = read("worker/src/index.js");
const cloud = read("goplan-cloud.js");
const sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));
const config = read("config.js");

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(duplicates.length === 0, "Duplicate HTML IDs: " + [...new Set(duplicates)].join(", "));

const idRefs = [...html.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
const missingRefs = [...new Set(idRefs.filter(id => !ids.includes(id)))];
assert(missingRefs.length === 0, "Missing direct $('id') references: " + missingRefs.join(", "));

const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1]))
  .map(match => match[2])
  .filter(source => source.trim());
assert(inlineScripts.length === 1, "Expected exactly one inline application script.");
for (const source of inlineScripts) {
  try { new Function(source); }
  catch (error) { failures.push("Inline app script syntax: " + error.message); }
}
assert(html.includes('src="./config.js"') && html.includes('src="./goplan-cloud.js"'), "Cloud config/integration scripts are not included.");
assert(html.includes("window.GoPlanApp="), "GoPlanApp bridge is missing.");
assert(cloud.includes("/api/plani/chat") && cloud.includes("/api/places/search"), "PLANI and Places API clients are missing.");
assert(cloud.includes("/api/sync") && cloud.includes("/api/push/register"), "Cloud sync or push client is missing.");
assert(worker.includes("verifyGoogleIdToken") && worker.includes("SYNC_CONFLICT"), "Backend token verification or revision conflict handling is missing.");
assert(worker.includes("api/plani/chat") && worker.includes("api/places/search"), "Backend PLANI/Places routes are missing.");

for (const icon of manifest.icons || []) {
  const file = icon.src.replace(/^\.\//, "");
  assert(existsSync(resolve(root, file)), "Missing manifest icon: " + file);
}
const shellMatch = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
assert(!!shellMatch, "Service-worker APP_SHELL was not found.");
if (shellMatch) {
  const paths = [...shellMatch[1].matchAll(/['"](\.\/[^'"]+)['"]/g)].map(match => match[1].replace(/^\.\//, ""));
  for (const path of paths) assert(existsSync(resolve(root, path)), "Missing service-worker cache asset: " + path);
}

assert(!/OPENAI_API_KEY\s*[:=]\s*["'][^"']+/.test(html + cloud + config), "An OpenAI API key appears in client-side files.");
assert(!/GOOGLE_MAPS_API_KEY\s*[:=]\s*["'][^"']+/.test(html + cloud + config), "A Google Maps API key appears in client-side files.");
assert(sw.includes("addEventListener('push'"), "Push event handler is missing from service worker.");
assert(sw.includes("addEventListener('notificationclick'"), "Notification click handler is missing.");
assert(worker.includes("scheduled(controller") && worker.includes("sendPlanReminders"), "Scheduled monitoring/reminders handler is missing.");

if (failures.length) {
  console.error("GoPlan checks failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}
console.log("GoPlan static checks passed.");
console.log("HTML IDs: " + ids.length + " (unique)");
console.log("Direct app element references: " + new Set(idRefs).size + " (all found)");
console.log("Manifest and service-worker assets: present");
console.log("Inline app, cloud module and worker source: structurally checked");
