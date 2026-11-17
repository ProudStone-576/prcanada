import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { requestResetAction } from "@/app/actions/auth";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <div className="container auth">
      <div className="stock auth__card">
        <h1>Reset your password</h1>
        <p className="muted small">Enter the email you signed up with. We'll send a link that works for 30 minutes.</p>
        <AuthForm action={requestResetAction} submit="Send reset link" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} />
        <p className="small"><Link href="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
