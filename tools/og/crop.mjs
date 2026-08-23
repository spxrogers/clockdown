// Minimal PNG top-crop, so the card generator needs no image dependencies.
// Handles the 8-bit RGB/RGBA output Chromium's --screenshot produces.
import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

// Chromium dithers the card's smooth background gradient, and that per-pixel
// noise dominates the file size. The PNG spec's minimum-sum heuristic picks
// badly for it (541KB); measured against these cards, Sub beats every other
// filter and the heuristic itself (442KB vs 459KB for None). Re-measure with
// tools/og/README.md's bench notes if the card design changes materially.
const FILTER_SUB = 1;

function filterSub(line, channels) {
  const out = Buffer.alloc(line.length);
  for (let x = 0; x < line.length; x++) {
    out[x] = (line[x] - (x >= channels ? line[x - channels] : 0)) & 0xff;
  }
  return out;
}

/** Returns a PNG buffer containing the top `keepRows` rows of `input`. */
export function cropTop(input, keepRows) {
  let pos = 8; // skip signature
  let ihdr = null;
  const idat = [];

  while (pos < input.length) {
    const len = input.readUInt32BE(pos);
    const type = input.toString('latin1', pos + 4, pos + 8);
    const data = input.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('not a PNG: missing IHDR');

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const colorType = ihdr[9];
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (depth !== 8 || !channels) {
    throw new Error(`unsupported PNG: depth ${depth}, color type ${colorType}`);
  }
  if (keepRows > height) throw new Error(`cannot keep ${keepRows} of ${height} rows`);
  if (keepRows === height) return input;

  // Undo per-row filtering. Each row's filter may reference the row above, so
  // rows must be decoded in order even though only the first `keepRows` are kept.
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = [];
  let prev = Buffer.alloc(stride);
  let read = 0;

  for (let y = 0; y < keepRows; y++) {
    const filter = raw[read++];
    const line = Buffer.from(raw.subarray(read, read + stride));
    read += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 0xff;
      else if (filter === 2) line[x] = (line[x] + b) & 0xff;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) line[x] = (line[x] + paeth(a, b, c)) & 0xff;
      else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
    }
    rows.push(line);
    prev = line;
  }

  // Share cards are fully opaque, so the alpha channel is pure overhead.
  const opaque = channels === 4 && rows.every((line) => {
    for (let x = 3; x < stride; x += 4) if (line[x] !== 255) return false;
    return true;
  });
  const outChannels = opaque ? 3 : channels;
  const outStride = width * outChannels;
  const pixels = opaque
    ? rows.map((line) => {
        const rgb = Buffer.alloc(outStride);
        for (let x = 0, o = 0; x < stride; x += 4, o += 3) line.copy(rgb, o, x, x + 3);
        return rgb;
      })
    : rows;

  const body = Buffer.alloc(keepRows * (outStride + 1));
  for (let y = 0; y < keepRows; y++) {
    body[y * (outStride + 1)] = FILTER_SUB;
    filterSub(pixels[y], outChannels).copy(body, y * (outStride + 1) + 1);
  }

  const header = Buffer.from(ihdr);
  header.writeUInt32BE(keepRows, 4);
  if (opaque) header[9] = 2; // RGBA -> RGB

  return Buffer.concat([
    input.subarray(0, 8),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(body, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
