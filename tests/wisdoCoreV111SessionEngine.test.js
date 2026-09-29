import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { normalizeSessionSchedule, evaluateSessionSchedule, WorldSessionScheduleService } from '../services/worldSessionScheduleService.js';

test('V11.1 session evaluation distinguishes active and blocked weekday hours', () => {
  const schedule = normalizeSessionSchedule({
    enabled: true,
    timezone: 'UTC',
    windows: [{ id:'london', start:'08:30', end:'11:00', days:[1,2,3,4,5], label:'London' }],
  });
  const active = evaluateSessionSchedule(schedule, new Date('2026-09-28T09:00:00Z'));
  const blocked = evaluateSessionSchedule(schedule, new Date('2026-09-28T12:00:00Z'));
  assert.equal(active.mode, 'ACTIVE');
  assert.equal(active.window?.id, 'london');
  assert.equal(blocked.mode, 'BLOCKED');
});

test('V11.1 cross-midnight windows stay active after midnight on the following day', () => {
  const schedule = normalizeSessionSchedule({
    enabled: true,
    timezone: 'UTC',
    windows: [{ id:'overnight', start:'22:00', end:'02:00', days:[1], label:'Overnight' }],
  });
  assert.equal(evaluateSessionSchedule(schedule, new Date('2026-09-28T23:00:00Z')).mode, 'ACTIVE');
  assert.equal(evaluateSessionSchedule(schedule, new Date('2026-09-29T01:00:00Z')).mode, 'ACTIVE');
  assert.equal(evaluateSessionSchedule(schedule, new Date('2026-09-29T03:00:00Z')).mode, 'BLOCKED');
});

test('V11.1 session schedule requires hold confirmation before server enforcement is armed', async () => {
  const queued = [];
  const commandService = {
    async queueCommandForAccount(userId, accountId, command, payload) {
      const row = { id:`cmd-${queued.length+1}`, userId, accountId, command, payload, status:'pending' };
      queued.push(row); return row;
    },
    async getQueueStatus() { return { recent: queued }; },
  };
  const campaignState = {
    async snapshot(userId,{accountId}={}) {
      return {
        account:{ accountId:accountId||'acct-1', ownerUserId:userId, shared:false },
        campaigns:[],
        executionHealth:{ commandLinkReady:true },
        bot:{ enabled:true },
      };
    },
  };
  const service = new WorldSessionScheduleService({ mt4CommandService:commandService, campaignState, intervalMs:9999999 });
  const proposal = await service.propose('user-1',{
    accountId:'acct-1',
    schedule:{
      enabled:true,
      timezone:'UTC',
      windows:[{start:'00:00',end:'23:59',days:[0,1,2,3,4,5,6],label:'All day'}],
    },
  });
  await assert.rejects(
    () => service.arm('user-1',{ proposalId:proposal.proposalId, confirmationToken:proposal.confirmationToken, heldForMs:400 }),
    /Hold confirmation/
  );
  const armed = await service.arm('user-1',{
    proposalId:proposal.proposalId,
    confirmationToken:proposal.confirmationToken,
    heldForMs:1300,
  });
  assert.equal(armed.enabled,true);
  assert.equal(armed.configured,true);
  assert.equal(queued.length,1);
  assert.ok(['START_ENTRIES','STOP_ENTRIES'].includes(queued[0].command));
  assert.equal(queued[0].payload.source,'wisdo_time_schedule');
  await service.close();
});

test('V11.1 schedule enforcement fails closed when account control permission is revoked', async () => {
  const queued = [];
  const commandService = {
    async queueCommandForAccount(...args){ queued.push(args); return { id:'never',status:'pending' }; },
    async getQueueStatus(){ return { recent:[] }; },
  };
  const campaignState = {
    async snapshot(_userId,{accountId}={}) {
      return {
        account:{ accountId, ownerUserId:'someone-else', shared:true, sharePermission:'view_only' },
        campaigns:[],
        executionHealth:{ commandLinkReady:true },
        bot:{ enabled:true },
      };
    },
  };
  const service = new WorldSessionScheduleService({ mt4CommandService:commandService, campaignState, intervalMs:9999999 });
  await service.enforceOne('user-1','acct-1',normalizeSessionSchedule({
    enabled:true,timezone:'UTC',
    windows:[{start:'00:00',end:'23:59',days:[0,1,2,3,4,5,6]}],
  }),{force:true});
  assert.equal(queued.length,0);
  await service.close();
});

test('V11.1 command routes and browser runtime expose the live session schedule contract', async () => {
  const [routes,runtime,time,commandRuntime] = await Promise.all([
    fs.readFile(new URL('../server/worldCommandRoutes.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/wisdo-time-engine.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../public/app/world/command/command-runtime.js',import.meta.url),'utf8'),
  ]);
  assert.match(routes,/session-schedule\/propose/);
  assert.match(routes,/session-schedule\/arm/);
  assert.match(routes,/session-schedule\/disable/);
  assert.match(commandRuntime,/proposeSessionSchedule/);
  assert.match(commandRuntime,/armSessionSchedule/);
  assert.match(commandRuntime,/disableSessionSchedule/);
  assert.match(runtime,/onPreviewSchedule/);
  assert.match(runtime,/onArmSchedule/);
  assert.match(time,/ACTIVE HOURS/);
  assert.match(time,/BLOCKED HOURS/);
  assert.match(time,/HOLD TO ARM SERVER HOURS/);
  assert.match(time,/wcV111SessionTrack/);
});

test('V11.1 still keeps gesture commands on the verified proposal flow', async () => {
  const runtime = await fs.readFile(new URL('../public/app/world/command/command-center-runtime.js',import.meta.url),'utf8');
  assert.match(runtime,/guardianDeck\.requestControl\('AUTO'\)/);
  assert.match(runtime,/guardianDeck\.requestControl\('PROTECT'\)/);
  assert.match(runtime,/guardianDeck\.requestControl\('TAKE_PROFIT'\)/);
  assert.match(runtime,/proposal = await runtime\.propose\(/);
  assert.match(runtime,/latestReceipt = await runtime\.execute\(/);
});
