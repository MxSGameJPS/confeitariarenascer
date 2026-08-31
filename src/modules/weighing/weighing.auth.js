import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/src/shared/errors/app-error";
import { findWeighingDeviceByTokenHash, touchWeighingDevice } from "@/src/modules/weighing/weighing.repository";

export function hashWeighingDeviceToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateWeighingDeviceToken() {
  return `rwp_${randomBytes(32).toString("base64url")}`;
}

export async function requireWeighingDevice(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(rwp_[A-Za-z0-9_-]{40,80})$/);
  if (!match) {
    throw new AppError("Dispositivo de pesagem não autorizado.", { statusCode: 401, code: "WEIGHING_DEVICE_UNAUTHORIZED" });
  }

  const device = await findWeighingDeviceByTokenHash(hashWeighingDeviceToken(match[1]));
  if (!device?.active) {
    throw new AppError("Dispositivo de pesagem não autorizado.", { statusCode: 401, code: "WEIGHING_DEVICE_UNAUTHORIZED" });
  }

  const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  if (!lastSeen || Date.now() - lastSeen > 5 * 60 * 1000) await touchWeighingDevice(device.id);
  return device;
}
