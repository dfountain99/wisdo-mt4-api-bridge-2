import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

function buildFallback(fallbackFactory) {
  try {
    if (typeof fallbackFactory === "function") {
      const value = fallbackFactory();
      return value === undefined || value === null ? {} : value;
    }

    return fallbackFactory === undefined || fallbackFactory === null ? {} : fallbackFactory;
  } catch {
    return {};
  }
}

function cloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value ?? {}));
  }
}

function stringifyJsonSafe(data) {
  const safeData = data === undefined || data === null ? {} : data;
  const payload = JSON.stringify(safeData, null, 2);

  if (typeof payload !== "string") {
    return "{}\n";
  }

  return `${payload}\n`;
}

export class JsonFileStore {
  constructor(filePath, fallbackFactory = {}) {
    this.filePath = filePath;
    this.fallbackFactory = fallbackFactory;
    this.updateChain = Promise.resolve();
  }

  fallback() {
    return buildFallback(this.fallbackFactory);
  }

  async ensure() {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      await this.write(this.fallback());
    }

    return this.read();
  }

  async read() {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");

      if (!raw || !raw.trim()) {
        return this.fallback();
      }

      return JSON.parse(raw);
    } catch {
      return this.fallback();
    }
  }

  async write(data) {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = stringifyJsonSafe(data);

    await writeFile(tempPath, payload, "utf8");
    await rename(tempPath, this.filePath);

    return data === undefined || data === null ? {} : data;
  }

  async update(updater) {
    const operation = this.updateChain.then(async () => {
      const current = await this.read();
      const draft = cloneSafe(current);

      const next = typeof updater === "function" ? await updater(draft) : draft;
      const finalState = next === undefined || next === null ? draft : next;

      await this.write(finalState);
      return finalState;
    });

    this.updateChain = operation.catch(() => undefined);
    return operation;
  }

  async getAll() {
    return this.read();
  }

  async setAll(data) {
    return this.write(data);
  }
}

export default {
  JsonFileStore,
};