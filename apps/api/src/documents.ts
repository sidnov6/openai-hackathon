import path from "node:path";
import type { DocumentRecord } from "@mainhaus/contracts";
import { newId, sha256 } from "./ids.js";

export const ACCEPTED_POLICY_MEDIA = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"] as const;
export const MAX_POLICY_BYTES = 20 * 1024 * 1024;

export type ExtractedDocument = { record: DocumentRecord; anchoredText: string };

function mediaTypeFor(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf" as const;
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const;
  if (extension === ".md" || extension === ".markdown") return "text/markdown" as const;
  if (extension === ".txt") return "text/plain" as const;
  throw new Error("Only DOCX, PDF, Markdown, and plain-text policy documents are accepted");
}

function textSections(text: string, markdown: boolean) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  if (!normalized) return [];
  if (markdown) {
    const chunks = normalized.split(/(?=^#{1,6}\s+)/m).map((section) => section.trim()).filter(Boolean);
    return chunks.length ? chunks : [normalized];
  }
  const formFeedPages = normalized.split(/\f/).map((section) => section.trim()).filter(Boolean);
  if (formFeedPages.length > 1) return formFeedPages;
  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length > 8_000 && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function extractPolicyFile(policyId: string, fileName: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  if (!/^policy-(00[1-9]|01\d|020)$/.test(policyId)) throw new Error("Policy ID must be policy-001 through policy-020");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_POLICY_BYTES) throw new Error("Policy file is empty or exceeds the 20 MB limit");
  const mediaType = mediaTypeFor(fileName);
  const version = sha256(bytes);
  let units: string[] = [];
  let extractionStatus: DocumentRecord["extractionStatus"] = "complete";
  const missingParts: string[] = [];

  if (mediaType === "application/pdf") {
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new Error("The file extension is PDF but its signature is not");
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: bytes });
      const result = await parser.getText();
      await parser.destroy();
      units = result.pages.map((page) => page.text.trim());
      const unreadable = units.flatMap((text, index) => text ? [] : [index + 1]);
      if (unreadable.length) {
        extractionStatus = unreadable.length === units.length ? "ocr_required" : "partial";
        missingParts.push(`Unreadable or image-only pages: ${unreadable.join(", ")}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF extraction failed";
      return {
        record: {
          id: newId("doc"), policyId, mode: "fictional_demo", version, fileName, mediaType,
          pageOrSectionCount: 0, extractionStatus: "failed",
          coverage: { processed: 0, total: 0, unreadable: [], complete: false },
          missingParts: [message],
        },
        anchoredText: "",
      };
    }
  } else if (mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error("The file extension is DOCX but its ZIP signature is not");
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    units = textSections(result.value, false);
    if (result.messages.length) missingParts.push(...result.messages.map((message) => message.message));
  } else {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    units = textSections(decoded, mediaType === "text/markdown");
  }

  const readableUnits = units.filter(Boolean);
  const unreadable = units.flatMap((text, index) => text ? [] : [index + 1]);
  const marker = mediaType === "application/pdf" ? "PAGE" : "SECTION";
  const anchoredText = units.map((text, index) => `[[${marker} ${index + 1}]]\n${text}`).join("\n\n");
  const complete = units.length > 0 && unreadable.length === 0;
  if (units.length === 0 && extractionStatus === "complete") extractionStatus = "failed";

  return {
    record: {
      id: newId("doc"), policyId, mode: "fictional_demo", version, fileName, mediaType,
      pageOrSectionCount: units.length,
      extractionStatus,
      coverage: { processed: readableUnits.length, total: units.length, unreadable, complete },
      missingParts: units.length ? missingParts : ["No readable text was extracted"],
    },
    anchoredText,
  };
}
