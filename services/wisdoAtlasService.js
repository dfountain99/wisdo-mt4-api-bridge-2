import crypto from 'node:crypto';

const clean = (v='') => String(v ?? '').trim();
const lower = (v='') => clean(v).toLowerCase();
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`;

const ASSET_CLASSES = [
  ['metal', /^(XAU|XAG|GOLD|SILVER)/],
  ['crypto', /^(BTC|ETH|LTC|XRP|SOL|DOGE)/],
  ['energy', /^(USOIL|UKOIL|WTI|BRENT|NGAS)/],
  ['index', /^(US30|DJ30|NAS|USTEC|SPX|SP500|GER|DE40|UK100|JP225|AUS200)/],
  ['forex', /^[A-Z]{6}(?:[._-][A-Z0-9]+)?$/],
];

export class WisdoAtlasService {
  constructor({ pool, logger }={}) {
    if (!pool) throw new Error('PostgreSQL pool is required.');
    this.pool = pool;
    this.logger = logger || console;
  }

  canonicalize(symbol, providedCanonical='') {
    const source = clean(symbol);
    const raw = source.toUpperCase();
    if (providedCanonical) return clean(providedCanonical).toUpperCase();
    if (!raw) return '';
    const compactSuffix = source.match(/^([A-Za-z]{6})(?:m|a|r|pro|raw|ecn|mini|micro|cash)$/);
    if (compactSuffix) return compactSuffix[1].toUpperCase();
    const direct = {
      GOLD:'XAUUSD', SILVER:'XAGUSD', USTEC:'NAS100', NASDAQ:'NAS100',
      NAS100:'NAS100', US500:'SPX500', SPXUSD:'SPX500', SP500:'SPX500',
      DJ30:'US30', DOW:'US30', WTI:'USOIL', BRENT:'UKOIL'
    };
    if (direct[raw]) return direct[raw];
    const forex = raw.match(/^([A-Z]{6})(?:[._-][A-Z0-9]+)?$/);
    if (forex) return forex[1];
    return raw.replace(/(?:[._-](PRO|RAW|ECN|MINI|MICRO|CASH|R|M|A))$/i, '');
  }

  classify(symbol, provided='') {
    if (provided) return lower(provided);
    const canonical = this.canonicalize(symbol);
    for (const [kind, pattern] of ASSET_CLASSES) if (pattern.test(canonical)) return kind;
    return 'cfd';
  }

  async upsertCatalog(owner, input={}) {
    const accountId=clean(input.account_id); const broker=clean(input.broker); const symbols=Array.isArray(input.symbols)?input.symbols:[];
    if(!accountId) throw new Error('account_id is required.');
    if(!broker) throw new Error('broker is required.');
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rows=[];
      for(const item of symbols){
        const brokerSymbol=clean(item.broker_symbol||item.symbol); if(!brokerSymbol) continue;
        const canonical=this.canonicalize(brokerSymbol,item.canonical_symbol);
        const assetClass=this.classify(canonical,item.asset_class);
        const q=await client.query(`INSERT INTO wisdo_broker_symbols(owner_user_id,account_id,broker,broker_symbol,canonical_symbol,asset_class,base_asset,quote_asset,trade_enabled,visible,market_open,min_lot,max_lot,lot_step,digits,point_size,stop_level,spread,metadata,last_seen_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,NOW())
          ON CONFLICT(owner_user_id,account_id,broker_symbol) DO UPDATE SET canonical_symbol=EXCLUDED.canonical_symbol,asset_class=EXCLUDED.asset_class,base_asset=EXCLUDED.base_asset,quote_asset=EXCLUDED.quote_asset,trade_enabled=EXCLUDED.trade_enabled,visible=EXCLUDED.visible,market_open=EXCLUDED.market_open,min_lot=EXCLUDED.min_lot,max_lot=EXCLUDED.max_lot,lot_step=EXCLUDED.lot_step,digits=EXCLUDED.digits,point_size=EXCLUDED.point_size,stop_level=EXCLUDED.stop_level,spread=EXCLUDED.spread,metadata=EXCLUDED.metadata,last_seen_at=NOW(),updated_at=NOW() RETURNING *`,[
          owner,accountId,broker,brokerSymbol,canonical,assetClass,item.base_asset||null,item.quote_asset||null,item.trade_enabled!==false,item.visible!==false,item.market_open??null,item.min_lot??null,item.max_lot??null,item.lot_step??null,item.digits??null,item.point_size??null,item.stop_level??null,item.spread??null,JSON.stringify(item.metadata||{})
        ]);
        rows.push(q.rows[0]);
      }
      await client.query('COMMIT'); return rows;
    } catch(e){ await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async listCompatible(owner,{account_id=null,broker=null,asset_class=null,trade_enabled=true,visible=true}={}){
    const r=await this.pool.query(`SELECT * FROM wisdo_broker_symbols WHERE owner_user_id=$1 AND ($2::text IS NULL OR account_id=$2) AND ($3::text IS NULL OR broker=$3) AND ($4::text IS NULL OR asset_class=$4) AND ($5::boolean IS NULL OR trade_enabled=$5) AND ($6::boolean IS NULL OR visible=$6) ORDER BY canonical_symbol,account_id,broker_symbol`,[owner,account_id,broker,asset_class,trade_enabled,visible]);
    return r.rows;
  }

  async resolve(owner,input={}){
    const spoken=clean(input.symbol||input.alias); if(!spoken) throw new Error('symbol or alias is required.');
    const alias=await this.pool.query(`SELECT canonical_symbol FROM wisdo_symbol_aliases WHERE owner_user_id=$1 AND lower(alias)=lower($2) LIMIT 1`,[owner,spoken]);
    const canonical=this.canonicalize(alias.rows[0]?.canonical_symbol||spoken);
    const r=await this.pool.query(`SELECT * FROM wisdo_broker_symbols WHERE owner_user_id=$1 AND canonical_symbol=$2 AND ($3::text IS NULL OR account_id=$3) AND ($4::text IS NULL OR broker=$4) AND trade_enabled=TRUE AND visible=TRUE ORDER BY (market_open IS TRUE) DESC,last_seen_at DESC`,[owner,canonical,input.account_id||null,input.broker||null]);
    return {requested:spoken,canonical_symbol:canonical,matches:r.rows,compatible:r.rows.length>0};
  }

  async saveAlias(owner,input={}){
    const alias=clean(input.alias); const canonical=this.canonicalize(input.canonical_symbol);
    if(!alias||!canonical) throw new Error('alias and canonical_symbol are required.');
    const r=await this.pool.query(`INSERT INTO wisdo_symbol_aliases(owner_user_id,alias,canonical_symbol,source,metadata) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(owner_user_id,alias) DO UPDATE SET canonical_symbol=EXCLUDED.canonical_symbol,source=EXCLUDED.source,metadata=EXCLUDED.metadata,updated_at=NOW() RETURNING *`,[owner,alias,canonical,clean(input.source||'user'),JSON.stringify(input.metadata||{})]);
    return r.rows[0];
  }

  async saveGroup(owner,input={}){
    const name=clean(input.name); if(!name) throw new Error('group name is required.');
    const r=await this.pool.query(`INSERT INTO wisdo_symbol_groups(group_id,owner_user_id,name,selector,status) VALUES($1,$2,$3,$4::jsonb,'active') ON CONFLICT(owner_user_id,name) DO UPDATE SET selector=EXCLUDED.selector,status='active',updated_at=NOW() RETURNING *`,[id('symgrp'),owner,name,JSON.stringify(input.selector||{})]);
    return r.rows[0];
  }
}
