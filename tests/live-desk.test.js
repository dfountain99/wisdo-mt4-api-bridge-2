import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LiveDeskService, LIVE_DESK_VISIBILITY } from '../services/liveDeskService.js';

function service() {
  return new LiveDeskService({ secret: 'test-session-secret-that-is-long-enough', maxViewers: 3, logger: { warn() {}, error() {} } });
}

test('Live Desk exposes the intended privacy modes', () => {
  assert.deepEqual(new Set(LIVE_DESK_VISIBILITY), new Set(['private_devices', 'private_room', 'selected_members', 'members', 'public', 'unlisted']));
});

test('private device broadcast is owner-only', () => {
  const live = service();
  const { session } = live.createSession({ ownerUserId: 'owner-1', visibility: 'private_devices' });
  const guest = live.joinSession(session.id, { displayName: 'Guest' });
  assert.equal(guest.ok, false);
  assert.equal(guest.code, 'owner_only');
  const owner = live.joinSession(session.id, { viewerUserId: 'owner-1', displayName: 'Owner phone' });
  assert.equal(owner.ok, true);
});

test('private room requires code and supports WebRTC signaling', () => {
  const live = service();
  const created = live.createSession({ ownerUserId: 'owner-1', visibility: 'private_room', roomCode: '432198' });
  assert.equal(created.roomCode, '432198');
  assert.equal('roomCodeHash' in created.session, false);
  const denied = live.joinSession(created.session.id, { roomCode: '111111' });
  assert.equal(denied.code, 'room_code_required');
  const viewer = live.joinSession(created.session.id, { roomCode: '432198', displayName: 'Phone' });
  assert.equal(viewer.ok, true);
  const hostSignals = live.pollSignals(created.session.id, { participantId: 'host', ownerUserId: 'owner-1' });
  assert.equal(hostSignals.messages[0].type, 'viewer-ready');
  const offer = { type: 'offer', sdp: 'v=0\r\n' };
  const sent = live.sendSignal(created.session.id, { senderId: 'host', ownerUserId: 'owner-1', recipientId: viewer.participant.id, type: 'offer', payload: offer });
  assert.equal(sent.ok, true);
  const viewerSignals = live.pollSignals(created.session.id, { participantId: viewer.participant.id, token: viewer.token });
  assert.equal(viewerSignals.messages[0].type, 'offer');
  assert.deepEqual(viewerSignals.messages[0].payload, offer);
});

test('members-only and selected-member rooms fail closed', () => {
  const live = service();
  const memberRoom = live.createSession({ ownerUserId: 'owner', visibility: 'members' }).session;
  assert.equal(live.joinSession(memberRoom.id, { viewerUserId: 'free-user', activeMember: false }).code, 'member_required');
  assert.equal(live.joinSession(memberRoom.id, { viewerUserId: 'paid-user', activeMember: true }).ok, true);

  const selected = live.createSession({ ownerUserId: 'owner', visibility: 'selected_members', allowedViewerIds: ['chosen-user'] }).session;
  assert.equal(live.joinSession(selected.id, { viewerUserId: 'other-user' }).code, 'selected_member_required');
  assert.equal(live.joinSession(selected.id, { viewerUserId: 'chosen-user' }).ok, true);
});

test('discovery only returns public, eligible member, and selected broadcasts', () => {
  const live = service();
  const publicDesk = live.createSession({ ownerUserId: 'a', visibility: 'public', title: 'Public' }).session;
  const memberDesk = live.createSession({ ownerUserId: 'b', visibility: 'members', title: 'Members' }).session;
  live.createSession({ ownerUserId: 'c', visibility: 'unlisted', title: 'Hidden' });
  const selectedDesk = live.createSession({ ownerUserId: 'd', visibility: 'selected_members', allowedViewerIds: ['vip'], title: 'VIP' }).session;

  assert.deepEqual(live.discover({}).map((item) => item.id), [publicDesk.id]);
  assert.deepEqual(new Set(live.discover({ viewerUserId: 'vip', activeMember: true }).map((item) => item.id)), new Set([publicDesk.id, memberDesk.id, selectedDesk.id]));
});

test('viewer capacity, removal, blocking, and leave lifecycle are enforced', () => {
  const live = service();
  const session = live.createSession({ ownerUserId: 'owner', visibility: 'public' }).session;
  const one = live.joinSession(session.id, { viewerUserId: 'one' });
  const two = live.joinSession(session.id, { viewerUserId: 'two' });
  const three = live.joinSession(session.id, { viewerUserId: 'three' });
  assert.equal(one.ok && two.ok && three.ok, true);
  assert.equal(live.joinSession(session.id, { viewerUserId: 'four' }).code, 'viewer_capacity_reached');

  const removed = live.removeViewer(session.id, 'owner', one.participant.id, { block: true });
  assert.equal(removed.blocked, true);
  assert.equal(live.joinSession(session.id, { viewerUserId: 'one' }).code, 'viewer_blocked');
  assert.equal(live.leaveSession(session.id, two.participant.id, two.token).ok, true);
  assert.equal(live.listParticipants(session.id, 'owner').participants.length, 1);
});

test('telemetry is sanitized and only owner can update it', () => {
  const live = service();
  const session = live.createSession({ ownerUserId: 'owner', visibility: 'public', telemetry: { equity: 100, symbols: ['XAUUSD'] } }).session;
  assert.equal(live.updateTelemetry(session.id, 'intruder', { equity: 500 }).ok, false);
  const update = live.updateTelemetry(session.id, 'owner', { equity: 125.5, floatingPL: 25.5, logicStatus: 'Trend continuation' });
  assert.equal(update.ok, true);
  assert.equal(update.telemetry.equity, 125.5);
  assert.equal(update.telemetry.logicStatus, 'Trend continuation');
});

test('TURN credentials are ephemeral when a shared secret is configured', () => {
  const before = {
    urls: process.env.WISDO_WEBRTC_TURN_URLS,
    secret: process.env.WISDO_WEBRTC_TURN_SHARED_SECRET,
  };
  process.env.WISDO_WEBRTC_TURN_URLS = 'turn:turn.example.test:3478';
  process.env.WISDO_WEBRTC_TURN_SHARED_SECRET = 'turn-secret';
  try {
    const live = service();
    const config = live.iceConfig('viewer-1');
    assert.equal(config.turnConfigured, true);
    const turn = config.iceServers.find((entry) => String(entry.urls).includes('turn.example.test'));
    assert.ok(turn?.username);
    assert.ok(turn?.credential);
    assert.equal(turn.credential.includes('turn-secret'), false);
  } finally {
    if (before.urls === undefined) delete process.env.WISDO_WEBRTC_TURN_URLS; else process.env.WISDO_WEBRTC_TURN_URLS = before.urls;
    if (before.secret === undefined) delete process.env.WISDO_WEBRTC_TURN_SHARED_SECRET; else process.env.WISDO_WEBRTC_TURN_SHARED_SECRET = before.secret;
  }
});

test('Live Desk routes and browser clients are wired into the canonical portal', () => {
  const source = fs.readFileSync(new URL('../server/deadshotSite.js', import.meta.url), 'utf8');
  assert.match(source, /\/app\/live-desk/);
  assert.match(source, /\/api\/live-desk\/sessions/);
  assert.match(source, /liveDeskService\.endAllForOwner/);
  assert.match(source, /liveDeskHostPage/);
  assert.equal(fs.existsSync(new URL('../public/js/live-desk-host.js', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../public/js/live-desk-viewer.js', import.meta.url)), true);
});
