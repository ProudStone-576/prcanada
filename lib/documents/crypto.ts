import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { decryptJson, encryptJson } from "../crypto";

/** Envelope encryption: a fresh 256-bit key per file, itself encrypted with the app key. */
export function encryptFile(plain: Buffer) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const content = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { wrappedKey: encryptJson(key.toString("base64")), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), content };
}

export function decryptFile(row: { wrappedKey: string; iv: string; tag: string; content: Uint8Array }): Buffer {
  const key = Buffer.from(decryptJson<string>(row.wrappedKey), "base64");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(row.iv, "base64"));
  d.setAuthTag(Buffer.from(row.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(row.content)), d.final()]);
}
