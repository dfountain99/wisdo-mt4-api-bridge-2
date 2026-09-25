// Forge wraps its manifest in `world`; the golden fixture itself also has a
// `world` field, which describes dimensions. Select by operation contract.
(function (root) {
  function select(data, source = 'unknown') {
    const candidates = [data, data?.manifest, data?.world];
    const manifest = candidates.find(candidate => candidate &&
      (Array.isArray(candidate.operations) || Array.isArray(candidate.forgeOperations)));
    const operations = manifest?.operations ?? manifest?.forgeOperations;
    if (!Array.isArray(operations) || operations.length === 0) {
      const error = new Error(`FORGE_OPERATION_SET_EMPTY: ${source} has no manifest operations`);
      error.code = 'FORGE_OPERATION_SET_EMPTY';
      error.diagnostic = {source, worldId: manifest?.worldId ?? data?.worldId ?? data?.world?.worldId ?? null,
        revision: manifest?.revision ?? data?.revision ?? null, operationCount: 0};
      throw error;
    }
    return manifest;
  }
  root.WISDO_AETHER_MANIFEST = Object.freeze({select});
})(globalThis);
