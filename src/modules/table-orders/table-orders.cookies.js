import { createHash, randomBytes } from "node:crypto";

export const TABLE_CUSTOMER_COOKIE = "renascer_table_customer";

export function createTableCustomerToken() {
  return randomBytes(32).toString("base64url");
}

export function hashTableCustomerToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export const tableCustomerCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
};
