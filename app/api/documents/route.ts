import { NextResponse } from "next/server";
import { audit, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { extractFields } from "@/lib/documents/extract";
import { pdfText } from "@/lib/documents/pdf-text";
import { saveDocument } from "@/lib/documents/store";
import { DOC_TYPE_KEYS, MAX_BYTES, MAX_DOCS, sniffMime, type DocMeta, type DocType } from "@/lib/documents/types";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  // Same-origin only: browsers send Origin on POST; reject cross-site form posts.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ error: "Cross-site upload refused." }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "Files must be 10 MB or smaller." }, { status: 413 });

  const form = await request.formData();
  if (form.get("consent") !== "on") return NextResponse.json({ error: "Please confirm you agree to us storing and reading this document." }, { status: 400 });
  const docType = String(form.get("docType") ?? "") as DocType;
  if (!DOC_TYPE_KEYS.includes(docType)) return NextResponse.json({ error: "Choose what kind of document this is." }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be 10 MB or smaller." }, { status: 413 });

  const count = await db.document.count({ where: { userId: user.id } });
  if (count >= MAX_DOCS) return NextResponse.json({ error: `You can store up to ${MAX_DOCS} documents. Delete some first.` }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return NextResponse.json({ error: "Upload a PDF, PNG or JPEG file." }, { status: 415 });

  let text: string | null = null;
  let textStatus: DocMeta["textStatus"] = mime === "application/pdf" ? "no_text" : "image";
  if (mime === "application/pdf") {
    try {
      text = await pdfText(bytes);
      textStatus = text ? "extracted" : "no_text";
    } catch (e) {
      // Log the failure type only, never document content.
      console.error("[documents] PDF text extraction failed:", (e as Error).name);
      textStatus = "failed";
    }
  }
  const meta: DocMeta = {
    filename: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document",
    text,
    textStatus,
    suggested: text ? extractFields(docType, text) : { notes: [] },
    confirmed: {},
  };
  const { id } = await saveDocument(user.id, docType, mime, bytes, meta);
  await audit("document_uploaded", user.id);
  return NextResponse.json({ id, textStatus });
}
