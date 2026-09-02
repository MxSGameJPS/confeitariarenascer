export function formatCommandCode(orderNumber) {
  const parsed = Number(orderNumber);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return "C?";
  return `C${parsed}`;
}
