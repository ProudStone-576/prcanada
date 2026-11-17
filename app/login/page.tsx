import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUser()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <div className="container auth">
      <div className="stock auth__card">
        <h1>Sign in</h1>
        <AuthForm
          action={loginAction}
          submit="Sign in"
          hidden={{ next: next ?? "" }}
          fields={[
            { name: "email", label: "Email", type: "email", autoComplete: "email" },
            { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
          ]}
        />
        <p className="small">
          <Link href="/forgot-password">Forgot your password?</Link>
          <br />
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
