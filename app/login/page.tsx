"use client";

import { createBrowserClientInstance } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function getCallbackUrl(nextPath: string): string {
  if (typeof window === "undefined") return "";
  const base = `${window.location.origin}/auth/callback`;
  const next = nextPath.startsWith("/") ? nextPath : "/dashboard";
  return `${base}?next=${encodeURIComponent(next)}`;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const error = searchParams.get("error");
  const supabase = createBrowserClientInstance();

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: getCallbackUrl(redirect) },
    });
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getCallbackUrl(redirect) },
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">FAANG-Trainer</h1>
      <p className="text-muted-foreground">Sign in to continue</p>
      {error === "auth_callback_error" && (
        <p className="text-destructive text-sm" role="alert">
          Sign-in failed. Please try again.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={signInWithGitHub} type="button">
          Sign in with GitHub
        </Button>
        <Button onClick={signInWithGoogle} variant="outline" type="button">
          Sign in with Google
        </Button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
