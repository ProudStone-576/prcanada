"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, requireUser } from "@/lib/auth";
import { deleteDocument, getDocumentMeta, updateDocumentMeta } from "@/lib/documents/store";
import { DOC_TYPE_KEYS, type DocType } from "@/lib/documents/types";
import { loadProfile, storeProfile } from "@/lib/profile/store";
import { languageTestSchema } from "@/lib/profile/schema";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""));

export async function confirmDocumentAction(id: string, input: { docType: string; issuedOn: string; expiresOn: string }) {
  const user = await requireUser();
  const parsed = z.object({ docType: z.enum(DOC_TYPE_KEYS as [DocType, ...DocType[]]), issuedOn: date, expiresOn: date }).safeParse(input);
  if (!parsed.success) return { error: "Check the dates." };
  const doc = await getDocumentMeta(user.id, id);
  if (!doc) return { error: "Not found." };
  doc.meta.confirmed = { ...doc.meta.confirmed, issuedOn: parsed.data.issuedOn || undefined, expiresOn: parsed.data.expiresOn || undefined };
  await updateDocumentMeta(user.id, id, parsed.data.docType, doc.meta);
  revalidatePath("/documents");
  return { error: null };
}

export async function deleteDocumentAction(id: string) {
  const user = await requireUser();
  await deleteDocument(user.id, id);
  await audit("document_deleted", user.id);
  revalidatePath("/documents");
}

/** Copy values the person has seen and approved from a document into their profile. */
export async function applyToProfileAction(id: string, what: "permit_expiry" | "language_scores") {
  const user = await requireUser();
  const doc = await getDocumentMeta(user.id, id);
  if (!doc) return { error: "Not found." };
  const { profile } = await loadProfile(user.id);
  const s = doc.meta.suggested;
  if (what === "permit_expiry") {
    const exp = doc.meta.confirmed.expiresOn ?? s.expiresOn;
    if (!exp) return { error: "No expiry date found in this document." };
    profile.permitExpiryDate = exp;
    if (doc.meta.confirmed.issuedOn ?? s.issuedOn) profile.permitIssueDate = doc.meta.confirmed.issuedOn ?? s.issuedOn;
  } else {
    if (!s.scores || !s.testType) return { error: "No scores found in this document." };
    const t = languageTestSchema.safeParse({ type: s.testType, date: doc.meta.confirmed.issuedOn ?? s.testDate ?? "", ...s.scores });
    if (!t.success) return { error: "Some scores were missing, so we didn't copy them. Enter them on the language step." };
    if (t.data.type === "tef_canada" || t.data.type === "tcf_canada") profile.frenchTest = t.data;
    else profile.englishTest = t.data;
  }
  await storeProfile(user.id, profile);
  await audit("profile_updated_from_document", user.id);
  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return { error: null };
}
