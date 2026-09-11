import { createHash, randomUUID } from "node:crypto";

export const newId = (prefix: string) => `${prefix}_${randomUUID()}`;
export const stableId = (prefix: string, value: string) =>
  `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
export const sha256 = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");

