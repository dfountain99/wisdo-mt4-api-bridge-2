const SIDES = new Set(['BID','ASK']);

export class OrderBookFeedService {
  constructor({ staleMs=3000, maxLevels=200 }={}) {
    this.staleMs=staleMs; this.maxLevels=maxLevels; this.books=new Map();
  }
  ingest({ symbol, source='EXTERNAL_L2', sequence=0, timestamp=Date.now(), bids=[], asks=[] }) {
    symbol=String(symbol||'').toUpperCase();
    if(!symbol) throw new Error('symbol is required');
    const clean=(rows,side)=>rows.slice(0,this.maxLevels).map((row)=>({
      side, price:Number(row.price), size:Number(row.size), orders:Number(row.orders||0)
    })).filter((row)=>row.price>0 && row.size>0 && SIDES.has(row.side));
    const previous=this.books.get(symbol);
    if(previous && Number(sequence) && Number(sequence)<=previous.sequence) return previous;
    const book={symbol,source,sequence:Number(sequence||0),timestamp:Number(timestamp),levels:[...clean(bids,'BID'),...clean(asks,'ASK')]};
    this.books.set(symbol,book); return book;
  }
  snapshot(symbol, now=Date.now()) {
    const book=this.books.get(String(symbol||'').toUpperCase());
    if(!book || now-book.timestamp>this.staleMs) return null;
    return book;
  }
  toMt4File(symbol, now=Date.now()) {
    const book=this.snapshot(symbol,now); if(!book) return '';
    const epoch=Math.floor(book.timestamp/1000);
    return book.levels.map((row)=>[epoch,book.symbol,row.side,row.price,row.size,row.orders,book.sequence].join('|')).join('\n')+'\n';
  }
}

export function registerOrderBookFeedRoutes(app,{service,requireFeedAuth=(_req)=>false}={}) {
  app.post('/api/market-data/order-book/ingest',(req,res)=>{
    if(!requireFeedAuth(req)) return res.status(401).json({ok:false,error:'feed authentication required'});
    try { res.json({ok:true,book:service.ingest(req.body)}); }
    catch(error){ res.status(400).json({ok:false,error:error.message}); }
  });
  app.get('/api/market-data/order-book/:symbol/mt4',(req,res)=>{
    const output=service.toMt4File(req.params.symbol);
    if(!output) return res.status(204).end();
    res.type('text/plain').send(output);
  });
}
