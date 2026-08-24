export const STAFF_SESSION_COOKIE = "renascer_staff_session";

export function setStaffSessionCookie(response, session) {
  const expires = new Date(session.expiresAt);

  response.cookies.set(STAFF_SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export function clearStaffSessionCookie(response) {
  response.cookies.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
