(() => {
  const api = '/api/member/ambient-life';
  let model = { missions: [], zones: [], household: [], policies: { defaults: [], custom: [] }, runs: [], truth: [] };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (match) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[match]);

  async function request(path, body = null, method = 'GET') {
    const options = { method, headers: { Accept: 'application/json', 'X-Wisdo-Intent': 'member-ambient-life' } };
    if (body !== null) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(api + path, options);
    const json = await response.json();
    if (!response.ok || json.ok === false) throw new Error(json.error || json.message || 'Request failed');
    return json;
  }

  function render() {
    document.getElementById('missionCount').textContent = model.missions.length;
    document.getElementById('zoneCount').textContent = model.zones.length;
    document.getElementById('householdCount').textContent = model.household.length;
    document.getElementById('runCount').textContent = model.runs.length;

    document.getElementById('missionsList').innerHTML = model.missions.length
      ? model.missions.map((mission) => `
        <div class="card" style="margin-top:10px;padding:14px">
          <div class="row" style="justify-content:space-between"><div><strong>${esc(mission.name)}</strong><div class="muted">${esc(mission.description || '')}</div></div><span class="tag">${esc((mission.allowed_sources || []).join(', '))}</span></div>
          <div class="muted">${(mission.steps || []).length} steps · Home ${esc(mission.home_id || 'not bound')}</div>
          <div class="row" style="margin-top:8px">
            <button class="btn" data-simulate="${esc(mission.mission_id)}">Simulate</button>
            <button class="btn primary" data-run="${esc(mission.mission_id)}">Run + Confirm</button>
            <button class="btn" data-local="${esc(mission.mission_id)}">Compile Local-Safe Manifest</button>
          </div>
        </div>`).join('')
      : '<p class="muted">No Ambient Life missions yet.</p>';

    document.getElementById('zonesList').innerHTML = model.zones.length
      ? model.zones.map((zone) => `<span class="tag">${esc(zone.name)} · privacy ${esc(zone.privacy_level)}</span>`).join('')
      : '<span class="muted">No room zones defined.</span>';

    document.getElementById('householdList').innerHTML = model.household.length
      ? model.household.map((member) => `<div class="row"><strong>${esc(member.display_name)}</strong><span class="tag">${esc(member.role)}</span><span class="muted">${member.expires_at ? 'Expires ' + esc(new Date(member.expires_at).toLocaleString()) : 'No expiry'}</span></div>`).join('')
      : '<p class="muted">No household roles configured.</p>';

    const defaults = model.policies?.defaults || [];
    const custom = model.policies?.custom || [];
    document.getElementById('policyList').innerHTML = [...defaults, ...custom].map((policy) =>
      `<div class="row"><div><strong>${esc(policy.name || policy.id || policy.policy_id)}</strong><div class="muted">${esc(policy.reason || '')}</div></div><span class="tag">${esc(policy.effect)}</span></div>`
    ).join('');

    document.getElementById('truthList').innerHTML = model.truth.length
      ? model.truth.slice(0, 20).map((event) => `<div class="row"><div><strong>${esc(event.event_type)}</strong><div class="muted">${esc(JSON.stringify(event.detail || {}))}</div></div><span class="tag">${new Date(event.created_at).toLocaleTimeString()}</span></div>`).join('')
      : '<p class="muted">No mission truth events yet.</p>';

    document.querySelectorAll('[data-simulate]').forEach((button) => {
      button.onclick = () => simulate(button.dataset.simulate);
    });
    document.querySelectorAll('[data-run]').forEach((button) => {
      button.onclick = () => runMission(button.dataset.run);
    });
    document.querySelectorAll('[data-local]').forEach((button) => {
      button.onclick = () => compileLocal(button.dataset.local);
    });
  }

  async function loadHomes() {
    const status = document.getElementById('ambientHomeStatus');
    if (!status) return; // Legacy member surface still uses Home ID inputs.
    try {
      const response = await fetch('/api/member/smart-home/onboarding', { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.error || 'Could not load homes.');
      document.querySelectorAll('[data-ambient-home]').forEach(select => {
        const selected = select.value;
        select.innerHTML = '<option value="">Choose a home</option>' + (data.homes || []).map(home => `<option value="${esc(home.home_id)}">${esc(home.name)}</option>`).join('');
        select.value = selected;
      });
      status.textContent = data.homes?.length ? 'Choose the home each setting belongs to. Saving does not execute actions.' : 'Create a home in Homes & devices before configuring rooms, permissions or missions.';
    } catch (error) { status.textContent = error.message; }
  }

  async function load() {
    try {
      const data = await request('/dashboard');
      model = data;
      render();
    } catch (error) {
      document.getElementById('missionOutput').textContent = error.message;
    }
  }

  async function simulate(id) {
    const output = document.getElementById('missionOutput');
    output.textContent = 'Simulating mission…';
    try {
      const result = await request('/missions/' + encodeURIComponent(id) + '/simulate', { source: 'manual', context: { role: 'OWNER' } }, 'POST');
      const simulation = result.simulation;
      output.textContent = [
        'Mission: ' + simulation.name,
        'Blocked: ' + (simulation.blocked ? 'YES' : 'NO'),
        'Confirmation required: ' + (simulation.requiresConfirmation ? 'YES' : 'NO'),
        '',
        ...simulation.steps.map((step) => `${step.index + 1}. ${step.type} / ${step.action} → ${step.status}${step.reason ? ' — ' + step.reason : ''}`),
      ].join('\n');
    } catch (error) {
      output.textContent = error.message;
    }
  }

  async function runMission(id) {
    if (!confirm('Execute this mission now? WISDO will still enforce every device, household, security, and trading policy.')) return;
    const output = document.getElementById('missionOutput');
    output.textContent = 'Executing mission through verified adapters…';
    try {
      const result = await request('/missions/' + encodeURIComponent(id) + '/run', { source: 'manual', context: { role: 'OWNER' }, confirm: 'EXECUTE' }, 'POST');
      output.textContent = 'Run ' + result.runId + ' → ' + result.status + '\n' + result.results.map((row) =>
        `${row.index + 1}. ${row.type}: ${row.state}${row.commandId ? ' command ' + row.commandId : ''}`
      ).join('\n');
      await load();
    } catch (error) {
      output.textContent = error.message;
    }
  }

  async function compileLocal(id) {
    const output = document.getElementById('missionOutput');
    output.textContent = 'Compiling local-safe manifest…';
    try {
      const result = await request('/missions/' + encodeURIComponent(id) + '/local-manifest', {}, 'POST');
      output.textContent = [
        'Eligible for local-safe package: ' + (result.eligible ? 'YES' : 'NO'),
        'Signing configured: ' + (result.signatureReady ? 'YES' : 'NO'),
        'Manifest hash: ' + result.manifestHash,
        '',
        result.eligible
          ? (result.signatureReady ? 'Manifest is signed and can be handed to a future V23 edge runner.' : 'Eligible, but signing secret is not configured; deployment stays disabled.')
          : 'Mission contains a blocked, confirmation-required, trading, workstation, or high-risk step and will not be packaged for unattended local execution.',
      ].join('\n');
    } catch (error) {
      output.textContent = error.message;
    }
  }

  function homeId() {
    return document.getElementById('missionHomeId').value.trim();
  }

  document.getElementById('createZone')?.addEventListener('click', async () => {
    try {
      if (!document.getElementById('zoneName').value.trim()) throw new Error('Enter a room name.');
      await request('/zones', {
        homeId: document.getElementById('zoneHomeId').value.trim(),
        name: document.getElementById('zoneName').value.trim(),
        privacyLevel: Number(document.getElementById('zonePrivacy').value || 1),
      }, 'POST');
      await load();
    } catch (error) { alert(error.message); }
  });

  document.getElementById('addHousehold')?.addEventListener('click', async () => {
    try {
      const expiresValue = document.getElementById('memberExpires')?.value || '';
      const role = document.getElementById('memberRole').value;
      if (document.getElementById('memberExpires') && ['GUEST', 'TECHNICIAN'].includes(role) && !expiresValue) throw new Error('Choose an expiry for temporary access.');
      const expiresAt = expiresValue ? new Date(expiresValue).toISOString() : null;
      if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw new Error('Access expiry must be in the future.');
      if (!document.getElementById('memberHomeId').value.trim()) throw new Error('Choose a home.');
      if (!document.getElementById('memberName').value.trim()) throw new Error('Enter a household member name.');
      await request('/household', {
        homeId: document.getElementById('memberHomeId').value.trim(),
        displayName: document.getElementById('memberName').value.trim(),
        role, expiresAt,
      }, 'POST');
      await load();
    } catch (error) { alert(error.message); }
  });

  document.getElementById('createMission')?.addEventListener('click', async () => {
    const name = document.getElementById('missionName').value.trim();
    const home = homeId();
    if (!home) return alert('Choose a home for this mission.');
    if (!name) return alert('Enter a mission name.');
    const scene = document.getElementById('missionScene').value.trim();
    const accountId = document.getElementById('missionAccount').value.trim();
    const includeWorkstation = document.getElementById('missionWorkstation').checked;
    const includePause = document.getElementById('missionPauseTrading').checked;
    const mode = document.getElementById('missionMode').value;
    const steps = [{ type: 'mode', mode }];
    if (scene) steps.push({ type: 'home', action: 'activate', target: { type: 'scene', alias: scene }, parameters: {} });
    if (includeWorkstation) steps.push({ type: 'workstation', intent: 'prepare_trading_workspace', requiredCapability: 'prepare_trading_workspace', target: { type: 'desktop', allowOffline: true } });
    if (includePause) {
      if (!accountId) return alert('Account ID is required for a trading step.');
      steps.push({ type: 'trading', action: 'pause_entries', accountId });
    }
    try {
      await request('/missions', {
        homeId: home || null,
        name: name || 'Ambient Mission',
        description: document.getElementById('missionDescription').value.trim(),
        allowedSources: ['manual', 'voice'],
        steps,
      }, 'POST');
      await load();
    } catch (error) { alert(error.message); }
  });

  document.getElementById('ambientPolicyForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.getElementById('policyStatus');
    const button = event.currentTarget.querySelector('button');
    const presets = {
      security: { effect: 'deny', match: { stepType: ['home'], actions: ['unlock', 'disarm', 'open'] } },
      camera: { effect: 'deny', match: { stepType: ['home'], deviceClasses: ['CAMERA'] } },
      trading: { effect: 'confirm', match: { stepType: ['trading'] } },
      home: { effect: 'confirm', match: { stepType: ['home'] } },
    };
    button.disabled = true;
    try {
      const name = document.getElementById('policyName').value.trim();
      const homeId = document.getElementById('policyHomeId').value;
      if (!name || !homeId) throw new Error('Choose a home and enter a rule name.');
      await request('/policies', { homeId, name, reason: name, ...presets[document.getElementById('policyPreset').value] }, 'POST');
      status.textContent = 'House rule saved. No devices were commanded.';
      await load();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  loadHomes();
  load();
})();
