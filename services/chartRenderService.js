import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Dependency-free account chart renderer.
 *
 * The original product pass required node-canvas through chartjs-node-canvas.
 * That native dependency routinely fails on Render when a prebuilt binary is
 * unavailable. This renderer writes a standards-compliant PNG using only Node
 * built-ins, keeping dashboard chart delivery portable and deterministic.
 */
export class ChartRenderService {
  constructor(config) {
    this.dataDir = config.dataDir || 'data/operator-desks';
    this.outputDir = path.join(this.dataDir, 'charts');
    this.width = 900;
    this.height = 420;
  }

  async renderAccountChart({ discordUserId, snapshotHistory = [], studentName = 'Student' }) {
    await fs.mkdir(this.outputDir, { recursive: true });

    const history = [...snapshotHistory]
      .filter((record) => record?.snapshot)
      .slice(0, 30)
      .reverse();

    const balances = history.map((record) => Number(record.snapshot.balance || 0));
    const equities = history.map((record) => Number(record.snapshot.equity || 0));
    const floating = history.map((record) => Number(record.snapshot.floatingPL || 0));

    const canvas = createCanvas(this.width, this.height, [15, 23, 42]);
    drawGrid(canvas, 62, 64, this.width - 34, this.height - 52);

    const all = [...balances, ...equities, ...floating];
    const min = all.length ? Math.min(...all) : 0;
    const max = all.length ? Math.max(...all) : 1;
    const range = Math.max(1, max - min);
    const bounds = { left: 62, top: 64, right: this.width - 34, bottom: this.height - 52 };

    drawSeries(canvas, balances, bounds, min, range, [56, 189, 248]);
    drawSeries(canvas, equities, bounds, min, range, [34, 197, 94]);
    drawSeries(canvas, floating, bounds, min, range, [249, 115, 22]);

    // Compact visual legend. The Discord message carries the textual account
    // metrics, while these bars keep the image dependency-free and readable.
    fillRect(canvas, 62, 25, 46, 6, [56, 189, 248]);
    fillRect(canvas, 142, 25, 46, 6, [34, 197, 94]);
    fillRect(canvas, 222, 25, 46, 6, [249, 115, 22]);

    const latest = history.at(-1)?.snapshot;
    if (latest) {
      const health = Number(latest.balance || 0) > 0
        ? Math.max(0, Math.min(1, Number(latest.equity || 0) / Number(latest.balance || 1)))
        : 0;
      fillRect(canvas, this.width - 250, 24, 210, 10, [31, 41, 55]);
      fillRect(canvas, this.width - 250, 24, Math.round(210 * health), 10, health >= 0.9 ? [34, 197, 94] : [249, 115, 22]);
    }

    const buffer = encodePng(canvas);
    const safeId = String(discordUserId || studentName || 'account').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(this.outputDir, `wisdo-live-${safeId}.png`);
    await fs.writeFile(filePath, buffer);

    return { filePath, fileName: `wisdo-live-${safeId}.png` };
  }
}

function createCanvas(width, height, background) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = background[0];
    pixels[i + 1] = background[1];
    pixels[i + 2] = background[2];
  }
  return { width, height, pixels };
}

function setPixel(canvas, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 3;
  canvas.pixels[index] = color[0];
  canvas.pixels[index + 1] = color[1];
  canvas.pixels[index + 2] = color[2];
}

function fillRect(canvas, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) setPixel(canvas, px, py, color);
  }
}

function drawLine(canvas, x0, y0, x1, y1, color, thickness = 2) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    for (let ox = -Math.floor(thickness / 2); ox <= Math.floor(thickness / 2); ox += 1) {
      for (let oy = -Math.floor(thickness / 2); oy <= Math.floor(thickness / 2); oy += 1) setPixel(canvas, x0 + ox, y0 + oy, color);
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function drawGrid(canvas, left, top, right, bottom) {
  const color = [38, 52, 70];
  for (let i = 0; i <= 6; i += 1) {
    const y = Math.round(top + ((bottom - top) * i) / 6);
    drawLine(canvas, left, y, right, y, color, 1);
  }
  for (let i = 0; i <= 8; i += 1) {
    const x = Math.round(left + ((right - left) * i) / 8);
    drawLine(canvas, x, top, x, bottom, color, 1);
  }
}

function drawSeries(canvas, values, bounds, min, range, color) {
  if (!values.length) return;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const points = values.map((value, index) => ({
    x: bounds.left + (values.length === 1 ? width : (index / (values.length - 1)) * width),
    y: bounds.bottom - ((Number(value || 0) - min) / range) * height,
  }));
  if (points.length === 1) fillRect(canvas, points[0].x - 2, points[0].y - 2, 5, 5, color);
  for (let i = 1; i < points.length; i += 1) drawLine(canvas, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, color, 3);
}

function encodePng(canvas) {
  const rowSize = canvas.width * 3;
  const raw = Buffer.alloc((rowSize + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const outputOffset = y * (rowSize + 1);
    raw[outputOffset] = 0;
    canvas.pixels.copy(raw, outputOffset + 1, y * rowSize, (y + 1) * rowSize);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 0);
  return Buffer.concat([length, name, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
