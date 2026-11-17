import { NocFinder } from "@/components/NocFinder";
import { NOC } from "@/lib/noc/server";
import { SRC } from "@/lib/sources";

export const metadata = { title: "NOC finder", description: "Find the National Occupational Classification codes that match the duties you actually perform, compared with the official NOC 2021 descriptions." };

export default function NocPage() {
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Find your NOC code</h1>
        <p>
          Immigration programs decide your occupation by your duties, not your job title. Describe your work and we&apos;ll compare it with all {NOC.units.length} official{" "}
          <a href={SRC.noc} target="_blank" rel="noopener noreferrer">{NOC.version}</a> descriptions from Statistics Canada.
        </p>
      </header>
      <NocFinder />
    </div>
  );
}
