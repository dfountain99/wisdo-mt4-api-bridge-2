import test from 'node:test';
import assert from 'node:assert/strict';
import { RANK_ORDER, rankVisual, rankIndex, rankEvolution } from '../public/app/world/command/rank-definitions.js';
import { createRankAscension } from '../public/app/world/command/rank-ascension.js';

test('Rank Ascension definitions cover persisted RankService ladder', () => {
  assert.deepEqual(RANK_ORDER, ['UNRANKED','BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','ELITE','CROWN','HIGHTOWER']);
  assert.equal(rankVisual('PLATINUM').title, 'APEX RUNNER');
  assert.equal(rankVisual('HIGHTOWER').character, 'SOVEREIGN');
  assert.equal(rankIndex('CROWN'), 7);
  assert.equal(rankEvolution().length, RANK_ORDER.length);
});

test('Rank Ascension controller fails closed without a mounted overlay', async () => {
  const controller = createRankAscension();
  assert.equal(typeof controller.refresh, 'function');
  assert.equal(typeof controller.setCampaignState, 'function');
  assert.equal(typeof controller.onReceipt, 'function');
  await controller.refresh('account');
  controller.setCampaignState({}, null);
  controller.onReceipt({ status: 'completed' });
  controller.stop();
});
