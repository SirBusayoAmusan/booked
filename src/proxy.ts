import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/business", "/onboarding", "/settings", "/admin"];

// Refreshes the Supabase session cookie and does an optimistic redirect for
// signed-out visitors. Real authorisation happens in pages, routes and RLS.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Remember an affiliate code (?a=code) for 30 days so checkout can credit it.
  const aff = request.nextUrl.searchParams.get("a");
  const withAffiliate = (res: NextResponse) => {
    if (aff && /^[A-Za-z0-9_-]{2,40}$/.test(aff)) {
      res.cookies.set("booked_aff", aff, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    }
    return res;
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return withAffiliate(response);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return withAffiliate(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|api/|r/|b/).*)"],
};
