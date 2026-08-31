import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/src/shared/errors/app-error";
import { findBridgeDeviceByTokenHash, touchBridgeDevice } from "@/src/modules/bridge/bridge.repository";

export function hashBridgeDeviceToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateBridgeDeviceToken() {
  return `rbg_${randomBytes(32).toString("base64url")}`;
}

export async function requireBridgeDevice(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(rbg_[A-Za-z0-9_-]{40,80})$/);
  if (!match) {
    throw new AppError("Bridge não autorizado.", { statusCode: 401, code: "BRIDGE_DEVICE_UNAUTHORIZED" });
  }

  const device = await findBridgeDeviceByTokenHash(hashBridgeDeviceToken(match[1]));
  if (!device?.active) {
    throw new AppError("Bridge não autorizado.", { statusCode: 401, code: "BRIDGE_DEVICE_UNAUTHORIZED" });
  }

  const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  if (!lastSeen || Date.now() - lastSeen > 5 * 60 * 1000) await touchBridgeDevice(device.id);
  return device;
}
