/**
 * Cookie option shapes used by Supabase SSR (setAll) and Next response.cookies.set.
 */

export type CookieOptions = {
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

export type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};
