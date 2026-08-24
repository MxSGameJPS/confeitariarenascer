import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const N = 32768;
const R = 8;
const P = 1;
const MAX_MEMORY = 64 * 1024 * 1024;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });

  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    Buffer.from(derivedKey).toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") return false;

  const [algorithm, nValue, rValue, pValue, saltValue, hashValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;

  const cost = Number(nValue);
  const blockSize = Number(rValue);
  const parallelization = Number(pValue);

  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelization)) {
    return false;
  }

  const expected = Buffer.from(hashValue, "base64url");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: MAX_MEMORY,
  }));

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
