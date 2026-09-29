const CONTROL_DEFS = Object.freeze({
  AUTO: {
    key: 'AUTO',
    label: 'AUTO',
    glyph: 'A',
    description: 'EA ENTRY CONTROL',
    tone: 'auto',
  },
  PROTECT: {
    key: 'PROTECT',
    label: 'PROTECT',
    glyph: '⬡',
    description: 'STOP NEW ENTRIES',
    tone: 'protect',
  },
  TAKE_PROFIT: {
    key: 'TAKE_PROFIT',
    label: 'TAKE PROFIT',
    glyph: '◆',
    description: 'CLOSE PROFIT',
    tone: 'profit',
  },
});

export const GUARDIAN_CONTROL_STATES = Object.freeze(['idle','summoning','active:auto','active:protect','active:take_profit','retracting']);

export const GUARDIAN_CONTROL_DEFS = CONTROL_DEFS;

function normalizeControl(value) {
  const key = String(value || '').toUpperCase().replace(/\s+/g, '_');
  return CONTROL_DEFS[key] ? key : null;
}

function markup() {
  return `<section class="wisdo-v10-control-deck" aria-label="Living Guardian Controls" data-mode="idle">
    <div class="wisdo-v10-control-origin" aria-hidden="true"><i></i><span>GUARDIAN CONTROL LINK</span></div>
    <div class="wisdo-v10-control-field">
      ${Object.values(CONTROL_DEFS).map((item) => `<button type="button" class="wisdo-v10-floor-node ${item.tone}" data-guardian-control="${item.key}" aria-pressed="false">
        <span class="wisdo-v10-node-beam"></span>
        <span class="wisdo-v10-node-ring"><b>${item.glyph}</b></span>
        <strong>${item.label}</strong>
        <em>${item.description}</em>
        <i class="wisdo-v10-node-electric"></i>
      </button>`).join('')}
    </div>
    <div class="wisdo-v10-control-truth" id="wcV10ControlTruth">SELECT A CONTROL · EXECUTION STILL REQUIRES VERIFIED PROPOSAL + HOLD</div>
  </section>`;
}

export function resolveGuardianControlAction(next, state = {}) {
  const key = normalizeControl(next);
  const campaign = state?.campaigns?.find((row) => row.campaignId === state?.selectedCampaignId) || state?.campaigns?.[0] || null;
  if (key === 'AUTO') {
    const botEnabled = campaign?.botEnabled ?? state?.bot?.enabled;
    return botEnabled === false ? 'RESUME_BOT' : 'RESUME_NEW_ENTRIES';
  }
  if (key === 'PROTECT') return 'STOP_NEW_ENTRIES';
  if (key === 'TAKE_PROFIT') return 'CLOSE_PROFIT';
  return null;
}

export function createGuardianCommandDeck({ overlay, onRequest = null, onVisualState = null } = {}) {
  const stage = overlay?.querySelector('.wisdo-command-stage');
  if (!stage) return { setState(){}, setControl(){}, setMode(){}, receipt(){}, retractAll(){}, destroy(){} };
  if (!stage.querySelector('.wisdo-v10-control-deck')) stage.insertAdjacentHTML('beforeend', markup());

  const root = stage.querySelector('.wisdo-v10-control-deck');
  const truth = root.querySelector('#wcV10ControlTruth');
  let mode = 'idle';
  let control = null;
  let transitionTimer = 0;
  let lastState = null;

  function emit() {
    root.dataset.mode = mode;
    root.dataset.control = control ? control.toLowerCase() : '';
    overlay.dataset.guardianMode = mode;
    overlay.dataset.guardianControl = control ? control.toLowerCase() : '';
    root.querySelectorAll('[data-guardian-control]').forEach((button) => {
      const active = button.dataset.guardianControl === control && mode.startsWith('active');
      button.classList.toggle('active', active);
      button.classList.toggle('summoning', button.dataset.guardianControl === control && mode === 'summoning');
      button.classList.toggle('retracting', button.dataset.guardianControl === control && mode === 'retracting');
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    onVisualState?.({ control, mode });
  }

  function setMode(next) {
    const safe = String(next || 'idle').toLowerCase();
    if (!GUARDIAN_CONTROL_STATES.includes(safe) && !['active','idle','summoning','retracting'].includes(safe)) return false;
    mode = safe === 'active' && control ? `active:${control.toLowerCase()}` : safe;
    emit();
    return true;
  }

  function setControl(next, { animate = true } = {}) {
    const normalized = normalizeControl(next);
    clearTimeout(transitionTimer);
    if (!normalized) {
      if (control && animate) {
        mode = 'retracting';
        emit();
        transitionTimer = setTimeout(() => { control = null; mode = 'idle'; emit(); }, 520);
      } else {
        control = null;
        mode = 'idle';
        emit();
      }
      return null;
    }
    control = normalized;
    if (!animate) {
      mode = `active:${control.toLowerCase()}`;
      emit();
      return control;
    }
    mode = 'summoning';
    emit();
    transitionTimer = setTimeout(() => {
      mode = `active:${control.toLowerCase()}`;
      emit();
    }, 480);
    return control;
  }


  function setState(state = {}) {
    lastState = state;
    const campaign = state?.campaigns?.find((row) => row.campaignId === state?.selectedCampaignId) || state?.campaigns?.[0] || null;
    const botEnabled = campaign?.botEnabled ?? state?.bot?.enabled;
    const protectionActive = campaign?.addsEnabled === false || state?.campaignControl?.paused === true;
    if (!control || mode === 'idle') {
      if (protectionActive) setControl('PROTECT', { animate: false });
      else if (botEnabled === true && state?.executionHealth?.commandLinkReady) setControl('AUTO', { animate: false });
    }
    const live = Boolean(state?.executionHealth?.commandLinkReady);
    root.classList.toggle('link-degraded', !live);
    truth.textContent = live
      ? 'LIVE LINK · SELECTING A GLYPH OPENS A VERIFIED COMMAND PROPOSAL'
      : 'LINK DEGRADED · CONTROLS ARE VISUAL ONLY UNTIL REPORTER COMMAND LINK RETURNS';
  }

  async function requestControl(next) {
    const key = normalizeControl(next);
    if (!key) return { ok:false, reason:'Unsupported guardian control.' };
    setControl(key);
    const action = resolveGuardianControlAction(key, lastState);
    if (!action) {
      truth.textContent = 'NO VERIFIED COMMAND MAPPING · NOTHING SENT';
      return { ok:false, reason:'No verified command mapping.' };
    }
    const cap = lastState?.capabilities?.[action];
    if (!cap?.available) {
      const reason=cap?.reason || 'COMMAND UNAVAILABLE';
      truth.textContent = `${key.replaceAll('_',' ')} · ${reason} · NOTHING SENT`;
      return { ok:false, action, reason };
    }
    truth.textContent = `${key.replaceAll('_',' ')} · PREPARING VERIFIED ${action.replaceAll('_',' ')} PROPOSAL`;
    try {
      const result=await onRequest?.({ control: key, action });
      if(!result){
        const reason='Verified proposal did not open.';
        truth.textContent = `${key.replaceAll('_',' ')} · ${reason} · NOTHING SENT`;
        return { ok:false, action, reason };
      }
      return { ok:true, action, result };
    } catch (error) {
      const reason=error?.message || 'PROPOSAL FAILED';
      truth.textContent = `${key.replaceAll('_',' ')} · ${reason} · NOTHING SENT`;
      return { ok:false, action, reason };
    }
  }

  root.querySelectorAll('[data-guardian-control]').forEach((button) => {
    button.addEventListener('click', () => requestControl(button.dataset.guardianControl));
  });

  function receipt(next = {}) {
    const status = String(next?.status || '').toLowerCase();
    if (!['completed','failed','expired','cancelled'].includes(status)) return;
    if (status === 'completed') {
      truth.textContent = `EA ACKNOWLEDGED · ${String(next.command || 'COMMAND').replaceAll('_',' ')}`;
      if (control === 'TAKE_PROFIT') setTimeout(() => setControl(null), 900);
    } else {
      truth.textContent = `${status.toUpperCase()} · EA DID NOT CONFIRM THE REQUEST`;
      setTimeout(() => setControl(null), 600);
    }
  }

  emit();
  return {
    setState,
    setControl,
    setMode,
    requestControl,
    receipt,
    retractAll: () => setControl(null),
    get state(){ return { control, mode }; },
    destroy(){ clearTimeout(transitionTimer); root.remove(); },
  };
}
