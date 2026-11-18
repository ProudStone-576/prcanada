import "server-only";

/** Text from a text-based PDF. Scanned PDFs and images have no text layer and return null. */
export async function pdfText(buf: Buffer, maxPages = 20): Promise<string | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const parts: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      line += item.str ?? "";
      if (item.hasEOL) {
        parts.push(line);
        line = "";
      } else line += " ";
    }
    if (line.trim()) parts.push(line);
  }
  await task.destroy();
  const text = parts.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  return text.length > 20 ? text.slice(0, 100_000) : null;
}
