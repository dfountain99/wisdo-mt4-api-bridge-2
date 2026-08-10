function symbol(value) { return String(value || '').trim().toUpperCase(); }

export class SymbolResolver {
  constructor({ aliases = {}, allowHeuristic = true } = {}) { this.aliases = aliases; this.allowHeuristic = allowHeuristic; }
  resolve(sourceSymbol, availableSymbols = [], manualMap = {}) {
    const source = symbol(sourceSymbol);
    const available = [...new Set(availableSymbols.map(symbol).filter(Boolean))];
    if (!source) return { ok:false, reason:'source_symbol_required', sourceSymbol:source };
    const explicit = symbol(manualMap[source] || manualMap[sourceSymbol] || this.aliases[source]);
    if (explicit) return available.includes(explicit) ? {ok:true,sourceSymbol:source,resolvedSymbol:explicit,method:'manual'} : {ok:false,sourceSymbol:source,candidate:explicit,reason:'mapped_symbol_unavailable'};
    if (available.includes(source)) return {ok:true,sourceSymbol:source,resolvedSymbol:source,method:'exact'};
    if (!this.allowHeuristic) return {ok:false,sourceSymbol:source,reason:'symbol_unresolved'};
    const base = source.replace(/^[^A-Z]*(?=[A-Z]{6})/,'').match(/^[A-Z]{6}/)?.[0] || source;
    const candidates = available.filter((candidate) => candidate === base || candidate.includes(base));
    if (candidates.length === 1) return {ok:true,sourceSymbol:source,resolvedSymbol:candidates[0],method:'verified_alias'};
    return {ok:false,sourceSymbol:source,reason:candidates.length ? 'symbol_ambiguous' : 'symbol_unresolved',candidates};
  }
}
