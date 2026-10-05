(() => {
  const apiBase = '/api/member/smart-home';
  let model = { homes: [], pending: [], approved: [], sources: [], possibleDuplicates: [] };

  const h = (value) => String(value ?? '').replace(/[&<>"']/g, (match) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[match]);

  const request = async (path, body = {}, method = 'POST') => {
    const response = await fetch(apiBase + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Wisdo-Intent': 'member-smart-home',
      },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || json.message || 'Request failed');
    return json;
  };

  const roomOf = (component) => component?.metadata?.room_id || '';
  const deviceClass = (component) => component?.metadata?.wisdo_device_class || component?.component_type || 'GENERIC';

  function homeOptions(selected = '') {
    return (model.homes || []).map((home) =>
      `<option value="${h(home.home_id)}" ${home.home_id === selected ? 'selected' : ''}>${h(home.name)}</option>`
    ).join('') || '<option value="">Create a Home first</option>';
  }

  function render() {
    document.getElementById('pendingCount').textContent = model.pending.length;
    document.getElementById('approvedCount').textContent = model.approved.length;
    document.getElementById('sourceCount').textContent = model.sources.length;
    document.getElementById('duplicateCount').textContent = model.possibleDuplicates.length;
    document.getElementById('homesList').innerHTML = model.homes.length
      ? model.homes.map((home) => `<span class="tag">${h(home.name)}</span>`).join('')
      : 'No WISDO Home created yet.';
    document.getElementById('batchHome').innerHTML = homeOptions();

    document.getElementById('sourceList').innerHTML = model.sources.length
      ? model.sources.map((source, index) => `
        <div class="card" style="margin-top:10px;padding:12px">
          <strong>${h(source.adapterId)}</strong> · ${h(source.componentCount)} devices
          <span class="tag">${source.bound ? 'BOUND' : 'UNBOUND'}</span>
          <div class="muted">Edge: ${h(source.edgeDeviceId)} · Source: ${h(source.sourceInstanceId)}</div>
          ${source.bound ? '' : `<div class="row" style="margin-top:8px"><select id="sourceHome-${index}">${homeOptions()}</select><button class="btn" data-bind-source="${index}" type="button">Bind Source</button></div>`}
        </div>`).join('')
      : 'No smart-home source has reported devices yet.';

    document.getElementById('pendingRows').innerHTML = model.pending.length
      ? model.pending.map((component, index) => `
        <tr>
          <td><input type="checkbox" data-pending-check="${h(component.component_id)}"></td>
          <td><strong>${h(component.name)}</strong><div class="muted">${h(component.component_id)}</div></td>
          <td>${h(deviceClass(component))}<br><span class="tag">${h(component.adapter_id || 'unknown')}</span></td>
          <td><input id="room-${index}" value="${h(roomOf(component))}" placeholder="Living room"></td>
          <td><input id="aliases-${index}" value="${h((component.aliases || []).join(', '))}" placeholder="lamp, desk light"></td>
          <td>${h(component.state?.state || component.status || 'unknown')}</td>
          <td><button class="btn" data-save="${index}" type="button">Save</button><select id="home-${index}">${homeOptions(component.home_id || '')}</select><button class="btn primary" data-approve="${index}" type="button">Approve</button></td>
        </tr>`).join('')
      : '<tr><td colspan="7">No pending devices.</td></tr>';

    document.getElementById('approvedRows').innerHTML = model.approved.length
      ? model.approved.map((component, index) => `
        <tr><td><strong>${h(component.name)}</strong></td><td>${h(deviceClass(component))}</td><td>${h(roomOf(component) || '—')}</td><td>${h(component.adapter_id || 'unknown')}</td><td><span class="tag">${h(component.status)}</span></td><td><button class="btn" data-revoke="${index}" type="button">Revoke</button></td></tr>`).join('')
      : '<tr><td colspan="6">No approved devices yet.</td></tr>';

    document.getElementById('duplicatesBox').innerHTML = model.possibleDuplicates.length
      ? model.possibleDuplicates.map((duplicate) => `
        <div class="card warn" style="margin-top:8px"><strong>${h(duplicate.key)}</strong><p>${h(duplicate.reason)}</p><div>${duplicate.names.map(h).map((name) => `<span class="tag">${name}</span>`).join('')}</div></div>`).join('')
      : 'No duplicate candidates detected.';

    document.querySelectorAll('[data-bind-source]').forEach((button) => {
      button.onclick = () => bindSource(Number(button.dataset.bindSource));
    });
    document.querySelectorAll('[data-save]').forEach((button) => {
      button.onclick = () => saveProfile(Number(button.dataset.save)).catch((error) => alert(error.message));
    });
    document.querySelectorAll('[data-approve]').forEach((button) => {
      button.onclick = () => approveOne(Number(button.dataset.approve));
    });
    document.querySelectorAll('[data-revoke]').forEach((button) => {
      button.onclick = () => revokeOne(Number(button.dataset.revoke));
    });
  }

  async function load() {
    try {
      const response = await fetch(apiBase + '/onboarding', { headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load');
      model = json;
      render();
    } catch (error) {
      document.getElementById('pendingRows').innerHTML = `<tr><td colspan="7">${h(error.message)}</td></tr>`;
    }
  }

  async function bindSource(index) {
    const source = model.sources[index];
    const homeId = document.getElementById('sourceHome-' + index)?.value;
    if (!homeId) return alert('Create/select a Home first.');
    try {
      await request('/adapters/bind', {
        homeId,
        edgeDeviceId: source.edgeDeviceId,
        adapterId: source.adapterId,
        sourceInstanceId: source.sourceInstanceId,
        confirm: 'BIND',
      });
      await load();
    } catch (error) {
      alert(error.message);
    }
  }

  async function saveProfile(index, refresh = true) {
    const component = model.pending[index];
    const aliases = (document.getElementById('aliases-' + index)?.value || '')
      .split(',').map((value) => value.trim()).filter(Boolean);
    const room = document.getElementById('room-' + index)?.value || '';
    await request('/components/' + encodeURIComponent(component.component_id) + '/profile', { room, aliases }, 'PATCH');
    if (refresh) await load();
  }

  async function approveOne(index) {
    const component = model.pending[index];
    const homeId = document.getElementById('home-' + index)?.value;
    if (!homeId) return alert('Create/select a Home first.');
    try {
      await saveProfile(index, false);
      await request('/components/' + encodeURIComponent(component.component_id) + '/approve', { homeId, confirm: 'APPROVE' });
      await load();
    } catch (error) {
      alert(error.message);
    }
  }

  async function revokeOne(index) {
    const component = model.approved[index];
    if (!confirm('Revoke WISDO control for ' + component.name + '?')) return;
    try {
      await request('/components/' + encodeURIComponent(component.component_id) + '/revoke', { confirm: 'REVOKE' });
      await load();
    } catch (error) {
      alert(error.message);
    }
  }

  document.getElementById('createHome')?.addEventListener('click', async () => {
    const name = document.getElementById('homeName').value.trim();
    if (!name) return;
    try {
      await request('/homes', { name });
      document.getElementById('homeName').value = '';
      await load();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('approveSelected')?.addEventListener('click', async () => {
    const ids = [...document.querySelectorAll('[data-pending-check]:checked')].map((node) => node.dataset.pendingCheck);
    const homeId = document.getElementById('batchHome').value;
    if (!ids.length) return alert('Select at least one device.');
    if (!homeId) return alert('Select a Home.');
    if (!confirm('Approve ' + ids.length + ' selected device(s) for this Home?')) return;
    try {
      await request('/components/approve-batch', { componentIds: ids, homeId, confirm: 'APPROVE' });
      await load();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('checkCompatibility')?.addEventListener('click', async () => {
    const output = document.getElementById('compatibilityOut');
    output.textContent = 'Checking safe adapter paths…';
    try {
      const json = await request('/compatibility', {
        deviceClass: document.getElementById('compatClass').value,
        protocol: document.getElementById('compatProtocol').value,
      });
      const plan = json.plan || {};
      output.textContent = [
        'Class: ' + plan.deviceClass,
        'Protocol: ' + (plan.protocols || []).join(', '),
        'Directly controllable now: ' + (plan.controllable ? 'YES' : 'NO'),
        'Possible with adapter: ' + (plan.possibleWithAdapter ? 'YES' : 'NO'),
        'Bridge required: ' + (plan.requiresBridge ? 'YES' : 'NO'),
        '',
        ...(plan.adapters || []).map((adapter) => '• ' + adapter.name + ': ' + adapter.covers),
      ].join('\n');
    } catch (error) {
      output.textContent = error.message;
    }
  });

  load();
})();
