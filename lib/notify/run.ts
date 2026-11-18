import "server-only";
import { db } from "../db";
import { listDocuments } from "../documents/store";
import { sendMail } from "../mail";
import { loadProfile } from "../profile/store";
import { buildNotices } from "./build";
import { pruneRateEvents } from "../ratelimit";
import { runRetention } from "../retention";

/** Create due reminders for every user; email them to people who opted in. */
export async function runNotifications(on = new Date()) {
  const users = await db.user.findMany({ select: { id: true, email: true, emailReminders: true } });
  let created = 0;
  let emailed = 0;
  for (const u of users) {
    const [{ profile }, deadlines, docs] = await Promise.all([
      loadProfile(u.id),
      db.deadline.findMany({ where: { userId: u.id, dismissedAt: null } }),
      listDocuments(u.id),
    ]);
    const notices = buildNotices(profile, deadlines.map((d) => ({ id: d.id, title: d.title, dueDate: d.dueDate.toISOString().slice(0, 10) })), docs, on);
    for (const n of notices) {
      const existing = await db.notification.findUnique({ where: { userId_key: { userId: u.id, key: n.key } } });
      if (existing) continue;
      const row = await db.notification.create({ data: { userId: u.id, key: n.key, kind: n.kind, title: n.title, body: n.body, href: n.href, dueDate: new Date(n.dueDate + "T00:00:00Z") } });
      created++;
      if (u.emailReminders) {
        const base = process.env.APP_URL ?? "http://localhost:3000";
        const sent = await sendMail({ to: u.email, subject: `PRPath Canada: ${n.title}`, text: `${n.body}\n\nOpen your dashboard: ${base}${n.href}\n\nYou get these emails because you turned on email reminders. Turn them off in your account settings.` });
        if (sent) {
          await db.notification.update({ where: { id: row.id }, data: { emailedAt: new Date() } });
          emailed++;
        }
      }
    }
  }
  await pruneRateEvents();
  const retention = await runRetention(on);
  return { users: users.length, created, emailed, retention };
}
