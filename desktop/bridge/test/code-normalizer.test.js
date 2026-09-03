const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBridgeCode } = require("../src/code-normalizer");

test("normaliza número simples para comanda física", () => { assert.equal(normalizeBridgeCode("105"), "C105"); });
test("remove zeros à esquerda do número digitado", () => {
  assert.equal(normalizeBridgeCode("00105"), "C105");
  assert.equal(normalizeBridgeCode("C00105"), "C105");
});
test("preserva comanda C válida", () => { assert.equal(normalizeBridgeCode(" c105 "), "C105"); });
test("aceita delivery Renascer", () => { assert.equal(normalizeBridgeCode("dvabcdefgh"), "DVABCDEFGH"); });
test("rejeita códigos inválidos", () => {
  assert.throws(() => normalizeBridgeCode("0"));
  assert.throws(() => normalizeBridgeCode("ABC"));
});
