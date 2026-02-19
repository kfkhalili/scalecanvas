import { createServerClientInstance } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createServerClientInstance();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email ?? user.id}
      </p>
      <SignOutButton />
      <Link href="/">Home</Link>
    </main>
  );
}

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        const { createServerClientInstance } = await import(
          "@/lib/supabase/server"
        );
        const supabase = await createServerClientInstance();
        await supabase.auth.signOut();
        redirect("/login");
      }}
    >
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
