import { AppError } from "@/src/shared/errors/app-error";

const MAX_ROWS = 10000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function invalid(message) {
  throw new AppError(message, { statusCode: 400, code: "GEMASTER_IMPORT_INVALID" });
}

function parseDelimited(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === ";" && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (quoted) invalid("CSV inválido: aspas não foram fechadas.");

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function parsePrice(raw, lineNumber) {
  const value = String(raw ?? "").trim();
  if (!value || value.toUpperCase() === "NULL") return null;

  const normalized = value.includes(",") && !value.includes(".")
    ? value.replace(",", ".")
    : value;
  const price = Number(normalized);
  if (!Number.isFinite(price) || price < 0 || price > 999999.99) {
    invalid(`Preço inválido na linha ${lineNumber}.`);
  }
  return Number(price.toFixed(2));
}

export async function parseGemasterCsvFile(file) {
  if (!(file instanceof File) || file.size === 0) invalid("Selecione o CSV exportado do GeMaster.");
  if (file.size > MAX_FILE_SIZE) invalid("O CSV do GeMaster deve ter no máximo 5 MB.");

  const rawText = (await file.text()).replace(/^\uFEFF/, "");
  const rows = parseDelimited(rawText);
  if (!rows.length) invalid("O CSV do GeMaster está vazio.");

  const first = rows[0].map((value) => value.trim().toLowerCase());
  const hasHeader = first[0] === "codigoproduto" || first.includes("produto");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length > MAX_ROWS) invalid(`O CSV excede o limite de ${MAX_ROWS} produtos.`);

  const seenCodes = new Set();
  const normalized = [];

  dataRows.forEach((columns, index) => {
    const lineNumber = index + (hasHeader ? 2 : 1);
    if (columns.length !== 6) invalid(`Linha ${lineNumber}: esperadas 6 colunas separadas por ponto e vírgula.`);

    const [codeRaw, referenceRaw, nameRaw, priceRaw, typeRaw, situationRaw] = columns;
    const externalCode = String(codeRaw ?? "").trim();
    const externalReference = String(referenceRaw ?? "").trim() || null;
    const name = String(nameRaw ?? "").trim();
    const typeProduct = String(typeRaw ?? "N").trim().toUpperCase() || "N";
    const situation = Number(String(situationRaw ?? "1").trim());

    if (!/^[0-9]{1,64}$/.test(externalCode)) invalid(`Código GeMaster inválido na linha ${lineNumber}.`);
    if (seenCodes.has(externalCode)) invalid(`Código GeMaster duplicado no CSV: ${externalCode}.`);
    if (!name || name.length > 140) invalid(`Nome de produto inválido na linha ${lineNumber}.`);
    if (!Number.isInteger(situation)) invalid(`Situação inválida na linha ${lineNumber}.`);

    seenCodes.add(externalCode);
    normalized.push({
      external_code: externalCode,
      external_reference: externalReference,
      name,
      price: parsePrice(priceRaw, lineNumber),
      type_product: typeProduct,
      situation,
    });
  });

  const activeRows = normalized.filter((row) => row.situation === 1);
  if (!activeRows.length) invalid("O CSV não possui produtos ativos para importar.");
  return activeRows;
}
