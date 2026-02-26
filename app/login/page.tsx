import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ redirect?: string; error?: string }> };

/**
 * Sign-in is handled in the left sidebar (SignInButtons). Redirect /login to /
 * so users stay in the app; preserve redirect and error query params.
 */
export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.redirect) q.set("redirect", params.redirect);
  if (params.error) q.set("error", params.error);
  const query = q.toString();
  redirect(query ? `/?${query}` : "/");
}
