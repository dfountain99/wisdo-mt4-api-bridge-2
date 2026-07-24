import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wsEntry = require.resolve('ws');
const websocketFile = path.join(path.dirname(wsEntry), 'lib', 'websocket.js');
let source = fs.readFileSync(websocketFile, 'utf8');
const marker = "function abortHandshake(websocket, stream, message) {";
const vulnerable = "  if (stream.setHeader) {";
const guard = "  // WISDO guard: request error and timeout can race and leave stream null.\n  if (!stream) {\n    process.nextTick(emitErrorAndClose, websocket, err);\n    return;\n  }\n\n  if (stream.setHeader) {";

if (!source.includes(marker)) {
  throw new Error(`Could not locate ws abortHandshake in ${websocketFile}`);
}
if (source.includes('WISDO guard: request error and timeout can race')) {
  console.log('ws handshake null guard already present');
  process.exit(0);
}
if (!source.includes(vulnerable)) {
  throw new Error(`Could not locate vulnerable ws stream guard in ${websocketFile}`);
}
source = source.replace(vulnerable, guard);
fs.writeFileSync(websocketFile, source);
console.log(`Patched ws handshake null race: ${websocketFile}`);
