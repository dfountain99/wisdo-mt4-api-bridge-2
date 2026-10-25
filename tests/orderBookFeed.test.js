import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderBookFeedService } from '../services/orderBookFeedService.js';

test('normalizes an authenticated external L2 snapshot for MT4',()=>{
  const service=new OrderBookFeedService({staleMs:3000});
  service.ingest({symbol:'xauusd',sequence:2,timestamp:10000,bids:[{price:3000,size:40,orders:8}],asks:[{price:3001,size:50,orders:9}]});
  const output=service.toMt4File('XAUUSD',11000);
  assert.match(output,/10\|XAUUSD\|BID\|3000\|40\|8\|2/);
  assert.match(output,/10\|XAUUSD\|ASK\|3001\|50\|9\|2/);
});
test('rejects stale snapshots',()=>{
  const service=new OrderBookFeedService({staleMs:100});
  service.ingest({symbol:'XAUUSD',timestamp:1000,bids:[{price:1,size:1}]});
  assert.equal(service.toMt4File('XAUUSD',2000),'');
});
