import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const fileWriteQueues = new Map();

function queueForFile(filePath, task) {
  const key = path.resolve(filePath);
  const previous = fileWriteQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  fileWriteQueues.set(key, current);
  return current.finally(() => {
    if (fileWriteQueues.get(key) === current) fileWriteQueues.delete(key);
  });
}

async function renameWithFallback(tempPath, filePath) {
  try {
    await fs.rename(tempPath, filePath);
    return;
  } catch (error) {
    if (error?.code === 'EXDEV') {
      await fs.copyFile(tempPath, filePath);
      await fs.rm(tempPath, { force: true });
      return;
    }
    if (error?.code === 'EEXIST' || error?.code === 'EPERM') {
      await fs.rm(filePath, { force: true });
      await fs.rename(tempPath, filePath);
      return;
    }
    throw error;
  }
}

export async function atomicWriteJson(filePath, data, { mode = 0o600 } = {}) {
  const resolvedPath = path.resolve(filePath);
  return queueForFile(resolvedPath, async () => {
    const directory = path.dirname(resolvedPath);
    await fs.mkdir(directory, { recursive: true });

    const tempPath = `${resolvedPath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), {
        encoding: 'utf8',
        flag: 'wx',
        mode,
      });
      await renameWithFallback(tempPath, resolvedPath);
    } finally {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
    }
    return data;
  });
}
