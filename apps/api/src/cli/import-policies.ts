import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config.js";
import { extractPolicyFile } from "../documents.js";
import { Store } from "../store.js";

const args = process.argv.slice(2);
const directoryArg = args.find((arg) => !arg.startsWith("--"));
const requireAll = args.includes("--require-all");

if (!directoryArg) {
  console.error("Usage: pnpm import:policies -- <directory> [--require-all]");
  process.exit(1);
}

const directory = path.resolve(directoryArg);
if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
  console.error(`Policy directory not found: ${directory}`);
  process.exit(1);
}

const config = loadConfig();
const store = new Store(config.databasePath);
const candidates = fs.readdirSync(directory).filter((name) => /^(?:policy-|DE-RA-)(00[1-9]|01\d|020)(?:[^/]*)\.(docx|pdf|md|markdown|txt)$/i.test(name));
const grouped = new Map<string, string[]>();
for (const fileName of candidates) {
  const number = fileName.match(/^(?:policy-|DE-RA-)(00[1-9]|01\d|020)/i)?.[1];
  const policyId = `policy-${number}`;
  grouped.set(policyId, [...(grouped.get(policyId) ?? []), fileName]);
}

if ([...grouped.values()].some((files) => files.length > 1)) {
  const duplicates = [...grouped].filter(([, files]) => files.length > 1).map(([id, files]) => `${id}: ${files.join(", ")}`);
  console.error(`Duplicate policy files are not allowed:\n${duplicates.join("\n")}`);
  process.exit(1);
}

if (requireAll && grouped.size !== 20) {
  const missing = Array.from({ length: 20 }, (_, index) => `policy-${String(index + 1).padStart(3, "0")}`).filter((id) => !grouped.has(id));
  console.error(`Readiness requires exactly 20 files. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

let imported = 0;
let failed = 0;
for (const [policyId, [fileName]] of grouped) {
  const fullPath = path.join(directory, fileName!);
  const bytes = fs.readFileSync(fullPath);
  const extracted = await extractPolicyFile(policyId, fileName!, bytes);
  store.saveDocument(extracted.record, extracted.anchoredText);
  const link = store.listPolicyLinks().find((candidate) => candidate.policyId === policyId);
  if (!link) {
    console.error(`${policyId}: no reserved mapping slot`);
    failed += 1;
    continue;
  }
  const ready = extracted.record.extractionStatus === "complete" || extracted.record.extractionStatus === "partial";
  store.bindDocument({ ...link, documentId: extracted.record.id, documentVersion: extracted.record.version, status: ready ? "ready" : "awaiting_document" });
  const extension = path.extname(fileName!);
  const archiveDirectory = path.join(config.uploadDir, "policies", policyId);
  fs.mkdirSync(archiveDirectory, { recursive: true });
  fs.copyFileSync(fullPath, path.join(archiveDirectory, `${extracted.record.version}${extension}`));
  console.log(`${policyId}: ${extracted.record.extractionStatus}, coverage ${extracted.record.coverage.processed}/${extracted.record.coverage.total}, version ${extracted.record.version.slice(0, 12)}`);
  if (ready) imported += 1;
  else failed += 1;
}

const links = store.listPolicyLinks();
store.close();
console.log(`Imported ${imported}; failed ${failed}; ready ${links.filter((link) => link.status === "ready").length}/20.`);
if (failed || (requireAll && imported !== 20)) process.exitCode = 1;
