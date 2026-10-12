// Keep source files in their original UTF encoding when importing/exporting.
// Common MetaEditor exports include UTF-16LE with BOM; treating these as UTF-8
// silently corrupts the source. Never execute imported code.
export function decodeMqlBytes(raw) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (!bytes.length) throw new Error('The source file is empty.');
  const first = (index) => bytes[index] ?? -1;
  let encoding = 'utf-8', bom = false, skip = 0;
  if (first(0) === 0xff && first(1) === 0xfe) {
    encoding = 'utf-16le'; bom = true; skip = 2;
  } else if (first(0) === 0xfe && first(1) === 0xff) {
    encoding = 'utf-16be'; bom = true; skip = 2;
  } else if (first(0) === 0xef && first(1) === 0xbb && first(2) === 0xbf) {
    bom = true; skip = 3;
  } else if (bytes.length >= 10) {
    const amount = Math.min(bytes.length - bytes.length % 2, 160);
    let even = 0, odd = 0;
    for (let i = 0; i < amount; i += 2) {
      if (bytes[i] === 0) even++;
      if (bytes[i + 1] === 0) odd++;
    }
    if (odd / (amount / 2) > 0.35 && even / (amount / 2) < 0.15) encoding = 'utf-16le';
    else if (even / (amount / 2) > 0.35 && odd / (amount / 2) < 0.15) encoding = 'utf-16be';
  }
  let source;
  try {
    source = new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes.subarray(skip));
  } catch {
    throw new Error('Unsupported or damaged source encoding. Export as UTF-8 or UTF-16 from MetaEditor and retry.');
  }
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (source.includes('\0')) throw new Error('Decoded source still contains binary data. Only editable source files are supported.');
  return { source, encoding, bom };
}

export function encodeMqlText(source, encoding = 'utf-8', bom = false) {
  if (typeof source !== 'string') throw new Error('Source must be text.');
  if (encoding === 'utf-8') {
    const body = new TextEncoder().encode(source);
    if (!bom) return body;
    const bytes = new Uint8Array(body.length + 3);
    bytes.set([0xef, 0xbb, 0xbf], 0);
    bytes.set(body, 3);
    return bytes;
  }
  if (encoding !== 'utf-16le' && encoding !== 'utf-16be') throw new Error('Unsupported export encoding.');
  const prefix = bom ? 2 : 0;
  const bytes = new Uint8Array(source.length * 2 + prefix);
  if (bom) {
    bytes[0] = encoding === 'utf-16le' ? 0xff : 0xfe;
    bytes[1] = encoding === 'utf-16le' ? 0xfe : 0xff;
  }
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    const pos = i * 2 + prefix;
    if (encoding === 'utf-16le') { bytes[pos] = code & 255; bytes[pos + 1] = code >>> 8; }
    else { bytes[pos] = code >>> 8; bytes[pos + 1] = code & 255; }
  }
  return bytes;
}
