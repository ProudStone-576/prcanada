import "server-only";
import { db } from "../db";
import { decryptJson, encryptJson } from "../crypto";
import { encryptFile, decryptFile } from "./crypto";
import type { StoredDoc } from "./checks";
import type { DocMeta, DocType, Mime } from "./types";

export async function saveDocument(userId: string, docType: DocType, mime: Mime, bytes: Buffer, meta: DocMeta) {
  const enc = encryptFile(bytes);
  return db.document.create({
    data: { userId, docType, mime, size: bytes.length, ...enc, content: new Uint8Array(enc.content), meta: encryptJson(meta), consentAt: new Date() },
    select: { id: true },
  });
}

/** Metadata for every document the user owns, decrypted, without file bytes. */
export async function listDocuments(userId: string): Promise<Array<StoredDoc & { mime: string; size: number }>> {
  const rows = await db.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, docType: true, mime: true, size: true, meta: true, createdAt: true },
  });
  return rows.map((r) => ({ id: r.id, docType: r.docType as DocType, mime: r.mime, size: r.size, createdAt: r.createdAt.toISOString().slice(0, 10), meta: decryptJson<DocMeta>(r.meta) }));
}

export async function getDocumentFile(userId: string, id: string) {
  const row = await db.document.findFirst({ where: { id, userId } });
  if (!row) return null;
  return { mime: row.mime, bytes: decryptFile(row), meta: decryptJson<DocMeta>(row.meta) };
}

export async function getDocumentMeta(userId: string, id: string) {
  const row = await db.document.findFirst({ where: { id, userId }, select: { id: true, docType: true, meta: true } });
  return row ? { id: row.id, docType: row.docType as DocType, meta: decryptJson<DocMeta>(row.meta) } : null;
}

export async function updateDocumentMeta(userId: string, id: string, docType: DocType, meta: DocMeta) {
  return db.document.updateMany({ where: { id, userId }, data: { docType, meta: encryptJson(meta) } });
}

/** Deleting the row destroys the file's own key, so the encrypted bytes can never be read again. */
export async function deleteDocument(userId: string, id: string) {
  return db.document.deleteMany({ where: { id, userId } });
}
