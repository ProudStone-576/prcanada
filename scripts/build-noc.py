"""Build lib/data/noc-2021.json from Statistics Canada's official NOC 2021 V1.0 CSV files.

Sources (Open Government Licence - Canada):
  https://www.statcan.gc.ca/en/subjects/standard/noc/2021/indexV1/noc-2021-v1.0-classification-structure.csv
  https://www.statcan.gc.ca/en/subjects/standard/noc/2021/indexV1/noc-2021-v1.0-elements.csv

Usage: python3 scripts/build-noc.py <structure.csv> <elements.csv> <downloaded-on YYYY-MM-DD>
"""
import csv, json, sys, collections

structure, elements, downloaded = sys.argv[1], sys.argv[2], sys.argv[3]
lead, groups = {}, {}
for r in csv.DictReader(open(structure, encoding="utf-8-sig")):
    code = r["Code - NOC 2021 V1.0"].strip()
    if r["Hierarchical structure"] == "Unit Group":
        lead[code] = (r["Class title"].strip(), r["Class definition"].strip())
    elif r["Hierarchical structure"] in ("Broad Category", "Major Group"):
        groups[code] = r["Class title"].strip()

el = collections.defaultdict(lambda: collections.defaultdict(list))
for r in csv.DictReader(open(elements, encoding="utf-8-sig")):
    el[r["Code - NOC 2021 V1.0"].strip()][r["Element Type Label English"].strip()].append(r["Element Description English"].strip())

units = []
for code, (title, definition) in sorted(lead.items()):
    e = el[code]
    duties = [d.rstrip(". ").strip() for d in e["Main duties"] if not d.lower().startswith("this group performs") and not d.lower().endswith("following duties:")]
    units.append({
        "code": code,
        "title": title,
        "teer": int(code[1]),
        "broad": groups.get(code[0], ""),
        "major": groups.get(code[:2], ""),
        "lead": definition,
        "duties": [d for d in duties if d],
        "examples": e["Illustrative example(s)"],
        "requirements": e["Employment requirements"],
        "exclusions": e["Exclusion(s)"],
    })

out = {
    "version": "NOC 2021 V1.0",
    "source": "https://www.statcan.gc.ca/en/subjects/standard/noc/2021/indexV1",
    "downloadedAt": downloaded,
    "units": units,
}
json.dump(out, open("lib/data/noc-2021.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(units), "unit groups;", sum(len(u["duties"]) for u in units), "duties")
