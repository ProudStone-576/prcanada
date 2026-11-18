# Minimal text PDF generator for tests (no deps).
import sys
def pdf(lines, path):
    content = "BT /F1 11 Tf 50 750 Td 14 TL " + " ".join("(%s) '" % l.replace("\\","\\\\").replace("(","\\(").replace(")","\\)") for l in lines) + " ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
      "<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out = "%PDF-1.4\n"; offs = []
    for i,o in enumerate(objs):
        offs.append(len(out)); out += "%d 0 obj\n%s\nendobj\n" % (i+1, o)
    x = len(out)
    out += "xref\n0 %d\n0000000000 65535 f \n" % (len(objs)+1) + "".join("%010d 00000 n \n" % o for o in offs)
    out += "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs)+1, x)
    open(path,"w",encoding="latin-1").write(out)
if __name__ == "__main__":
    pdf(open(sys.argv[1]).read().splitlines(), sys.argv[2])
