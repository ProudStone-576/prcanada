import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { resetPasswordAction } from "@/app/actions/auth";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="container auth">
      <div className="stock auth__card">
        <h1>Choose a new password</h1>
        {token ? (
          <AuthForm
            action={resetPasswordAction}
            submit="Save new password"
            hidden={{ token }}
            fields={[
              { name: "password", label: "New password", type: "password", autoComplete: "new-password", hint: "At least 10 characters." },
              { name: "confirm", label: "Type it again", type: "password", autoComplete: "new-password" },
            ]}
          />
        ) : (
          <p>This link is missing its code. <Link href="/forgot-password">Ask for a new reset link</Link>.</p>
        )}
      </div>
    </div>
  );
}
