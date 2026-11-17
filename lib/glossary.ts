/** Plain-language definitions shown in tooltips. Keep each under about 40 words. */
export const GLOSSARY = {
  crs: "Comprehensive Ranking System. The points score IRCC uses to rank people in the Express Entry pool. IRCC invites the highest-ranked people in each round to apply for permanent residence.",
  express_entry: "IRCC's online system for three federal economic programs: the Canadian Experience Class, the Federal Skilled Worker Program and the Federal Skilled Trades Program. Some provincial streams also use it.",
  clb: "Canadian Language Benchmarks (CLB) for English and Niveaux de compétence linguistique canadiens (NCLC) for French. Your test scores are converted to these levels, from 1 to 12, for each of the four abilities.",
  noc: "National Occupational Classification. Every job in Canada has a five-digit NOC code. Your code is decided by the duties you actually do, not your job title.",
  teer: "Training, Education, Experience and Responsibilities. The second digit of a NOC code, from 0 to 5. Express Entry counts work in TEER 0, 1, 2 and 3 as skilled.",
  eca: "Educational Credential Assessment. A report from an IRCC-designated organization saying what your foreign education is worth in Canada. Needed for foreign education to earn points.",
  pgwp: "Post-Graduation Work Permit. An open work permit some graduates of eligible Canadian programs can get after studying. It cannot be extended in most cases.",
  maintained: "If you apply to extend or change your permit before it expires, you can usually stay in Canada under the same conditions until IRCC decides. This used to be called implied status.",
  dli: "Designated Learning Institution. A school approved by a province or territory to host international students. Only DLIs can accept study permit holders.",
  lmia: "Labour Market Impact Assessment. A decision from Employment and Social Development Canada (ESDC) that lets an employer hire a foreign worker for a specific job.",
  pnp: "Provincial Nominee Program. Provinces and territories nominate people who fit their needs. A nomination through an Express Entry-aligned stream adds 600 CRS points.",
  ita: "Invitation to Apply. The message IRCC sends from an Express Entry round inviting you to submit a full permanent residence application, usually within 60 days.",
  pr: "Permanent residence. You can live, work and study anywhere in Canada with no end date, but you are not a citizen and cannot vote.",
  lmi: "Labour market integration factor. Since November 3, 2026, CRS gives points for either your Canadian work experience or a qualifying high-wage job offer, whichever scores higher, never both.",
  high_wage: "IRCC lists occupations whose national median wage is at least 1.3, 1.5 or 2 times the average median wage. The level comes from your NOC code, not your own salary.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
