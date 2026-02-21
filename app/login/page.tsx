"use client";

import { SignInButtons } from "@/components/chat/SignInButtons";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const error = searchParams.get("error");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">ScaleCanvas</h1>
      <p className="text-muted-foreground">Sign in to continue</p>
      {error === "auth_callback_error" && (
        <p className="text-destructive text-sm" role="alert">
          Sign-in failed. Please try again.
        </p>
      )}
      <SignInButtons redirectTo={redirect} />
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
