import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/home";
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <Link href="/" className="text-lg font-bold text-primary">
          Booked
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Sign in or start your trial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We email you a sign-in link. No passwords, and we never ask for your social media logins.
        </p>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">That link didn&apos;t work. Try again.</p>}
      <LoginForm next={next} />
    </main>
  );
}
