import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { markAllReadAction } from "@/app/actions/notifications";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const [items, me] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailReminders: true } }),
  ]);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Notifications</h1>
        <p>
          Reminders 90, 30, 7 and 1 days before your deadlines, and reviewed immigration updates. Email reminders are {me.emailReminders ? "on" : "off"}; change that in your <Link href="/account">account</Link>.
        </p>
      </header>
      {unread > 0 && (
        <form action={markAllReadAction} style={{ marginBottom: "var(--space-lg)" }}>
          <button type="submit" className="btn btn--card btn--sm">Mark all as read</button>
        </form>
      )}
      {items.length === 0 ? (
        <div className="empty">
          <p>No notifications yet. Add your permit expiry and test dates in the assessment, and reminders will appear here as they get close.</p>
          <Link href="/assessment?step=status" className="btn btn--ink">Add your dates</Link>
        </div>
      ) : (
        <ul className="list" style={{ maxWidth: 820 }}>
          {items.map((n) => (
            <li key={n.id}>
              <div className="row">
                <strong style={{ fontWeight: n.readAt ? 400 : 600 }}>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}</strong>
                <span className={n.readAt ? "tag" : "tag tag--soon"}>{n.readAt ? (n.kind === "update" ? "Update" : "Reminder") : "New"}</span>
              </div>
              <span className="small muted">{n.body}</span>
              <span className="small muted fig">{n.createdAt.toISOString().slice(0, 10)}{n.emailedAt ? ", also emailed" : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
