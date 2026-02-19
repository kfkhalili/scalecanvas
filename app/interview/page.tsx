import { createServerClientInstance } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InterviewLanding } from "@/components/interview/InterviewLanding";

export default async function InterviewPage() {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">Interview</h1>
      <InterviewLanding />
      <Link href="/dashboard">Dashboard</Link>
    </main>
  );
}
