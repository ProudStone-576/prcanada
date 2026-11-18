import "server-only";
import { db } from "./db";
import { sendMail } from "./mail";

export const INACTIVE_MONTHS = 24;
export const GRACE_DAYS = 30;
const DAY = 86400_000;

function monthsAgo(on: Date, months: number) {
  const d = new Date(on);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/**
 * Privacy policy retention rule: after 24 months without signing in, we send a
 * notice; 30 days after the notice, if the person still hasn't signed in, the
 * account and everything in it is deleted. Signing in clears the notice.
 */
export async function runRetention(on = new Date()) {
  const cutoff = monthsAgo(on, INACTIVE_MONTHS);
  const toNotify = await db.user.findMany({ where: { lastSeenAt: { lt: cutoff }, retentionNoticeAt: null }, select: { id: true, email: true } });
  let noticed = 0;
  for (const u of toNotify) {
    const base = process.env.APP_URL ?? "http://localhost:3000";
    await sendMail({
      to: u.email,
      subject: "Your PRPath Canada account will be deleted in 30 days",
      text: `You haven't signed in to PRPath Canada for ${INACTIVE_MONTHS} months. As our privacy policy explains, we'll delete your account and everything in it in ${GRACE_DAYS} days unless you sign in.\n\nSign in to keep it: ${base}/login\nOr download your data first from your account page.`,
    });
    await db.user.update({ where: { id: u.id }, data: { retentionNoticeAt: on } });
    noticed++;
  }
  const deleted = await db.user.deleteMany({ where: { lastSeenAt: { lt: cutoff }, retentionNoticeAt: { lt: new Date(on.getTime() - GRACE_DAYS * DAY) } } });
  if (deleted.count) await db.auditLog.create({ data: { action: `retention_deleted:${deleted.count}`, userId: null } });
  return { noticed, deleted: deleted.count };
}
