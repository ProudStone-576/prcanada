import { NextResponse } from "next/server";
import { audit, currentUser } from "@/lib/auth";
import { getDocumentFile } from "@/lib/documents/store";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const doc = await getDocumentFile(user.id, id);
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await audit("document_downloaded", user.id);
  return new NextResponse(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${doc.meta.filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
