/**
 * The conversation handle.
 *
 * httpOnly so page scripts cannot read or forge it: the browser no longer
 * chooses which conversation it is talking to, which is what lets the server
 * treat the session id as trustworthy enough to key stored transcripts on.
 */
export const SESSION_COOKIE = "bookly_session";

/** Long enough that "I'll come back to this tomorrow" works. */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;
