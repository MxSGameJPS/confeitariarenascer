const COMMAND_PATTERN = /^C[1-9][0-9]{0,11}$/;
const DELIVERY_PATTERN = /^DV[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function normalizeCommandDigits(value) {
  const digits = value.replace(/^0+/, "");
  if (!digits || digits.length > 12) return null;
  return `C${digits}`;
}

function normalizeBridgeCode(value) {
  const raw = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) throw new Error("Digite o número da comanda ou o código do delivery.");

  if (/^[0-9]+$/.test(raw)) {
    const command = normalizeCommandDigits(raw);
    if (command && COMMAND_PATTERN.test(command)) return command;
  }

  if (/^C[0-9]+$/.test(raw)) {
    const command = normalizeCommandDigits(raw.slice(1));
    if (command && COMMAND_PATTERN.test(command)) return command;
  }

  if (DELIVERY_PATTERN.test(raw)) return raw;

  throw new Error("Código inválido. Use o número da comanda, C105 ou um delivery DVXXXXXXXX.");
}

module.exports = { normalizeBridgeCode, COMMAND_PATTERN, DELIVERY_PATTERN };
