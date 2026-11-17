import { requireUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { changePasswordAction, deleteAccountAction } from "@/app/actions/auth";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="container app-main">
      <header className="page-head">
        <h1>Your account</h1>
        <p>Signed in as {user.email}. Member since {user.createdAt.toLocaleDateString("en-CA")}.</p>
      </header>
      <div className="dash">
        <div className="dash__col">
          <section className="stock panel">
            <h2>Change password</h2>
            <AuthForm
              action={changePasswordAction}
              submit="Change password"
              fields={[
                { name: "current", label: "Current password", type: "password", autoComplete: "current-password" },
                { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters. Other devices will be signed out." },
              ]}
            />
          </section>
        </div>
        <div className="dash__col">
          <section className="stock panel">
            <h2>Your data</h2>
            <p className="small" style={{ marginBottom: "var(--space-md)" }}>Download everything we hold about you: your answers, recorded scores, scenarios, reminders and sign-in activity.</p>
            <a className="btn btn--card" href="/api/export" download>Download my data</a>
          </section>
          <section className="stock panel">
            <h2>Delete your account</h2>
            <p className="small" style={{ marginBottom: "var(--space-md)" }}>This permanently deletes your account, answers, scores, scenarios and reminders right away. It can&apos;t be undone.</p>
            <AuthForm action={deleteAccountAction} tone="danger" submit="Delete everything" fields={[{ name: "confirm", label: "Type your email address to confirm", type: "email", autoComplete: "off" }]} />
          </section>
        </div>
      </div>
    </div>
  );
}
