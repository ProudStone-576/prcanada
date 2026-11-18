export const UPDATE_KINDS = ["crs", "express_entry_draw", "category", "pnp", "stream_status", "work_permit", "pgwp", "fees", "processing_times", "community", "law", "other"] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

export const KIND_LABEL: Record<UpdateKind, string> = {
  crs: "CRS points",
  express_entry_draw: "Express Entry draw",
  category: "Category-based selection",
  pnp: "Provincial nominee program",
  stream_status: "Stream opened, paused or closed",
  work_permit: "Work permit policy",
  pgwp: "PGWP",
  fees: "Fees",
  processing_times: "Processing times",
  community: "Community or regional program",
  law: "Law or regulation",
  other: "Other",
};
