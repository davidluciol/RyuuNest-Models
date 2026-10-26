/**
 * AES-256-CBC + MD5 (EVP_BytesToKey) en JS puro.
 *
 * La ficha de cada serie llega con la lista de capítulos cifrada por el sitio con
 * CryptoJS (AES con frase de paso, sal e IV aleatorios por página). El host no ofrece
 * criptografía, así que aquí se reproduce el mismo formato sin ejecutar nada del sitio.
 */

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function utf8Encode(text) {
  const out = [];
  for (const character of String(text ?? "")) {
    const code = character.codePointAt(0);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

function base64ToBytes(text) {
  const clean = String(text ?? "").replace(/[^A-Za-z0-9+/=]/gu, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const character of clean) {
    if (character === "=") break;
    const value = BASE64_ALPHABET.indexOf(character);
    if (value < 0) continue;
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }
  return out.subarray(0, index);
}

function hexToBytes(text) {
  const clean = String(text ?? "").replace(/[^0-9a-f]/giu, "");
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

function utf8Decode(bytes) {
  let out = "";
  for (let index = 0; index < bytes.length; ) {
    const first = bytes[index];
    index += 1;
    if (first < 0x80) {
      out += String.fromCharCode(first);
      continue;
    }
    let codePoint;
    if (first < 0xe0) {
      codePoint = ((first & 0x1f) << 6) | (bytes[index] & 0x3f);
      index += 1;
    } else if (first < 0xf0) {
      codePoint = ((first & 0x0f) << 12) | ((bytes[index] & 0x3f) << 6) | (bytes[index + 1] & 0x3f);
      index += 2;
    } else {
      codePoint =
        ((first & 0x07) << 18) |
        ((bytes[index] & 0x3f) << 12) |
        ((bytes[index + 1] & 0x3f) << 6) |
        (bytes[index + 2] & 0x3f);
      index += 3;
    }
    out += String.fromCodePoint(codePoint);
  }
  return out;
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// ---------- MD5 ----------

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
  14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_CONSTANTS = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0,
);

function md5(bytes) {
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let chunk = 0; chunk < paddedLength; chunk += 64) {
    const words = new Array(16);
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(chunk + index * 4, true);
    }
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let index = 0; index < 64; index += 1) {
      let f;
      let g;
      if (index < 16) {
        f = (b & c) | (~b & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        g = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * index) % 16;
      }
      const sum = (a + f + MD5_CONSTANTS[index] + words[g]) >>> 0;
      const rotated = ((sum << MD5_SHIFTS[index]) | (sum >>> (32 - MD5_SHIFTS[index]))) >>> 0;
      const next = (b + rotated) >>> 0;
      a = d;
      d = c;
      c = b;
      b = next;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

/** Derivación de OpenSSL (`EVP_BytesToKey`): clave e IV a partir de frase y sal. */
function deriveKey(passphrase, salt, keyLength = 32, ivLength = 16) {
  const out = new Uint8Array(keyLength + ivLength);
  const password = utf8Encode(passphrase);
  let offset = 0;
  let previous = new Uint8Array(0);
  while (offset < out.length) {
    previous = md5(concatBytes(previous, password, salt));
    out.set(previous.subarray(0, Math.min(16, out.length - offset)), offset);
    offset += 16;
  }
  return { key: out.subarray(0, keyLength), iv: out.subarray(keyLength, keyLength + ivLength) };
}

// ---------- AES ----------

function multiply(a, b) {
  let product = 0;
  let left = a;
  let right = b;
  for (let index = 0; index < 8; index += 1) {
    if (right & 1) product ^= left;
    const high = left & 0x80;
    left = (left << 1) & 0xff;
    if (high) left ^= 0x1b;
    right >>= 1;
  }
  return product;
}

function buildSbox() {
  const sbox = new Uint8Array(256);
  const inverse = new Uint8Array(256);
  const affine = (value) =>
    (value ^
      ((value << 1) | (value >> 7)) ^
      ((value << 2) | (value >> 6)) ^
      ((value << 3) | (value >> 5)) ^
      ((value << 4) | (value >> 4)) ^
      0x63) &
    0xff;
  for (let index = 0; index < 256; index += 1) {
    let inverseValue = 0;
    if (index !== 0) {
      for (let candidate = 1; candidate < 256; candidate += 1) {
        if (multiply(index, candidate) === 1) {
          inverseValue = candidate;
          break;
        }
      }
    }
    sbox[index] = affine(inverseValue);
  }
  for (let index = 0; index < 256; index += 1) inverse[sbox[index]] = index;
  return { sbox, inverse };
}

const { sbox: SBOX, inverse: INV_SBOX } = buildSbox();

const RCON = new Uint8Array(16);
let rconValue = 1;
for (let index = 1; index < 16; index += 1) {
  RCON[index] = rconValue;
  rconValue = multiply(rconValue, 2);
}

function multiplyTable(factor) {
  const table = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) table[value] = multiply(value, factor);
  return table;
}

const MUL9 = multiplyTable(9);
const MUL11 = multiplyTable(11);
const MUL13 = multiplyTable(13);
const MUL14 = multiplyTable(14);

function expandKey(key) {
  const nk = key.length / 4;
  const rounds = nk + 6;
  const words = new Uint8Array(16 * (rounds + 1));
  words.set(key);
  const total = 4 * (rounds + 1);
  for (let index = nk; index < total; index += 1) {
    const current = words.subarray(index * 4, index * 4 + 4);
    const temp = new Uint8Array(words.subarray((index - 1) * 4, index * 4));
    if (index % nk === 0) {
      const rotated = new Uint8Array([temp[1], temp[2], temp[3], temp[0]]);
      for (let byte = 0; byte < 4; byte += 1) temp[byte] = SBOX[rotated[byte]];
      temp[0] ^= RCON[index / nk];
    } else if (nk > 6 && index % nk === 4) {
      for (let byte = 0; byte < 4; byte += 1) temp[byte] = SBOX[temp[byte]];
    }
    const source = words.subarray((index - nk) * 4, (index - nk) * 4 + 4);
    for (let byte = 0; byte < 4; byte += 1) current[byte] = source[byte] ^ temp[byte];
  }
  return { words, rounds };
}

function addRoundKey(state, words, round) {
  for (let index = 0; index < 16; index += 1) state[index] ^= words[round * 16 + index];
}

function invShiftRows(state) {
  let temp = state[13];
  state[13] = state[9];
  state[9] = state[5];
  state[5] = state[1];
  state[1] = temp;
  temp = state[2];
  state[2] = state[10];
  state[10] = temp;
  temp = state[6];
  state[6] = state[14];
  state[14] = temp;
  temp = state[3];
  state[3] = state[7];
  state[7] = state[11];
  state[11] = state[15];
  state[15] = temp;
}

function invSubBytes(state) {
  for (let index = 0; index < 16; index += 1) state[index] = INV_SBOX[state[index]];
}

function invMixColumns(state) {
  for (let column = 0; column < 4; column += 1) {
    const offset = column * 4;
    const a = state[offset];
    const b = state[offset + 1];
    const c = state[offset + 2];
    const d = state[offset + 3];
    state[offset] = MUL14[a] ^ MUL11[b] ^ MUL13[c] ^ MUL9[d];
    state[offset + 1] = MUL9[a] ^ MUL14[b] ^ MUL11[c] ^ MUL13[d];
    state[offset + 2] = MUL13[a] ^ MUL9[b] ^ MUL14[c] ^ MUL11[d];
    state[offset + 3] = MUL11[a] ^ MUL13[b] ^ MUL9[c] ^ MUL14[d];
  }
}

function aesCbcDecrypt(ciphertext, key, iv) {
  if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) {
    throw new Error("El texto cifrado no es múltiplo de 16 bytes");
  }
  const { words, rounds } = expandKey(key);
  const out = new Uint8Array(ciphertext.length);
  let previous = new Uint8Array(iv);
  for (let offset = 0; offset < ciphertext.length; offset += 16) {
    const block = new Uint8Array(ciphertext.subarray(offset, offset + 16));
    const state = new Uint8Array(block);
    addRoundKey(state, words, rounds);
    for (let round = rounds - 1; round >= 1; round -= 1) {
      invShiftRows(state);
      invSubBytes(state);
      addRoundKey(state, words, round);
      invMixColumns(state);
    }
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, words, 0);
    for (let index = 0; index < 16; index += 1) out[offset + index] = state[index] ^ previous[index];
    previous = block;
  }

  const padding = out[out.length - 1];
  if (padding < 1 || padding > 16) throw new Error("Relleno PKCS#7 no válido");
  for (let index = out.length - padding; index < out.length; index += 1) {
    if (out[index] !== padding) throw new Error("Relleno PKCS#7 no válido");
  }
  return out.subarray(0, out.length - padding);
}

/**
 * Descifra el bloque `{"ct","iv","s"}` de la ficha y devuelve su texto plano.
 * Lanza si el formato cambió; el llamador lo traduce a un error del contrato.
 */
export function decryptChapterPayload(passphrase, rawPayload) {
  const payload = JSON.parse(rawPayload);
  const salt = hexToBytes(payload.s);
  const derived = deriveKey(passphrase, salt);
  const givenIv = hexToBytes(payload.iv);
  const iv = givenIv.length === 16 ? givenIv : derived.iv;
  return utf8Decode(aesCbcDecrypt(base64ToBytes(payload.ct), derived.key, iv));
}
