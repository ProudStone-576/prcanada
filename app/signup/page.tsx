import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { signupAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <div className="container auth">
      <div className="stock auth__card">
        <h1>Create your account</h1>
        <p className="muted small">Your answers are encrypted and only you can see them. You can export or delete everything at any time.</p>
        <AuthForm
          action={signupAction}
          submit="Create account"
          fields={[
            { name: "name", label: "First name (optional)", autoComplete: "given-name" },
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters. A short sentence works well." },
          ]}
        >
          <label className="check">
            <input type="checkbox" name="consent" required />
            <span>
              I agree to the <Link href="/terms">terms</Link> and to PRPath Canada storing my immigration details as described in the{" "}
              <Link href="/privacy">privacy policy</Link>. I understand this is information, not legal advice.
            </span>
          </label>
        </AuthForm>
        <p className="small">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
