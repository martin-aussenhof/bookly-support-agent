import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-cookie";

/**
 * Guarantees every request carries a session cookie.
 *
 * Doing it here rather than in the page means the id exists *before* the server
 * component renders, so the first paint can already include the restored
 * conversation — no client-side fetch, no empty-then-populated flash.
 */
export function middleware(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  const id = crypto.randomUUID();

  // Set it on the *request* too, so the page rendering this same request sees
  // it rather than having to wait for the next round trip.
  request.cookies.set(SESSION_COOKIE, id);
  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE, id, sessionCookieOptions);
  return response;
}

/**
 * Pages only. API routes are excluded deliberately: the chat routes read and
 * rotate the cookie themselves, and letting middleware mint one first meant a
 * DELETE emitted two Set-Cookie headers and "reset" a session it had just
 * created. A request that reaches the API without a cookie is a client that
 * never loaded the page, and gets a clean 400 instead.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
