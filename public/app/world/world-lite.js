import { WORLD_LOCATIONS } from './world-config.js';

export function createLiteWorld({ mount, destinations, onInteract, onNearestChange } = {}) {
  const position = { x: 50, y: 73 };
  let nearest = null;
  let destroyed = false;

  mount.innerHTML = `
    <div class="lite-city" aria-label="WISDO World Lite Mode">
      <div class="lite-skyline"></div>
      <div class="lite-plaza-ring"></div>
      <div id="liteBuildings" class="lite-buildings"></div>
      <div id="liteAvatar" class="lite-avatar"><span></span><b>YOU</b></div>
      <div class="lite-banner"><strong>WISDO WORLD LITE MODE</strong><span>3D graphics are unavailable or Lite Mode was selected. Platform access remains available.</span></div>
    </div>`;

  const buildings = mount.querySelector('#liteBuildings');
  const avatar = mount.querySelector('#liteAvatar');
  buildings.innerHTML = destinations.map((d, index) => {
    const loc = WORLD_LOCATIONS[d.id];
    const x = loc ? 50 + loc.position[0] * 0.38 : 12 + (index % 5) * 18;
    const y = loc ? 50 + loc.position[2] * 0.30 : 18 + Math.floor(index / 5) * 24;
    return `<button class="lite-building ${d.unlocked ? '' : 'locked'}" data-id="${d.id}" style="left:${Math.max(5,Math.min(92,x))}%;top:${Math.max(8,Math.min(86,y))}%"><span>${d.icon || '◇'}</span><strong>${d.name}</strong></button>`;
  }).join('');

  const buildingData = [...buildings.querySelectorAll('.lite-building')].map((el) => ({
    el,
    id: el.dataset.id,
    x: Number.parseFloat(el.style.left),
    y: Number.parseFloat(el.style.top),
  }));
  buildingData.forEach(({ el, id }) => el.addEventListener('click', () => onInteract?.(destinations.find((d) => d.id === id))));

  function update() {
    if (destroyed) return;
    avatar.style.left = `${position.x}%`;
    avatar.style.top = `${position.y}%`;
    let best = null;
    let bestDistance = Infinity;
    for (const item of buildingData) {
      const distance = Math.hypot(position.x - item.x, position.y - item.y);
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    }
    const next = bestDistance < 10 ? destinations.find((d) => d.id === best?.id) : null;
    if (next?.id !== nearest?.id) {
      nearest = next;
      onNearestChange?.(nearest);
    }
    buildingData.forEach((item) => item.el.classList.toggle('near', item.id === nearest?.id));
  }

  function onKey(event) {
    if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    const delta = 1.9;
    if (key === 'w' || key === 'arrowup') position.y -= delta;
    else if (key === 's' || key === 'arrowdown') position.y += delta;
    else if (key === 'a' || key === 'arrowleft') position.x -= delta;
    else if (key === 'd' || key === 'arrowright') position.x += delta;
    else if (key === 'e' && nearest) return onInteract?.(nearest);
    else return;
    event.preventDefault();
    position.x = Math.max(3, Math.min(97, position.x));
    position.y = Math.max(9, Math.min(91, position.y));
    update();
  }

  window.addEventListener('keydown', onKey, { passive: false });

  const joystick = document.getElementById('moveStick');
  const knob = document.getElementById('moveKnob');
  const interactButton = document.getElementById('interactBtn');
  let stickPointer = null;
  let stickVector = { x: 0, y: 0 };
  let touchTimer = null;
  function applyTouchMovement() {
    if (destroyed) return;
    if (Math.hypot(stickVector.x, stickVector.y) > 0.04) {
      position.x = Math.max(3, Math.min(97, position.x + stickVector.x * 1.2));
      position.y = Math.max(8, Math.min(92, position.y + stickVector.y * 1.2));
      update();
    }
    touchTimer = requestAnimationFrame(applyTouchMovement);
  }
  if (joystick && knob) {
    const updateStick = (event) => {
      const rect = joystick.getBoundingClientRect();
      const radius = Math.max(24, Math.min(rect.width, rect.height) * 0.36);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const length = Math.hypot(dx, dy) || 1;
      if (length > radius) { dx = dx / length * radius; dy = dy / length * radius; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      stickVector = { x: dx / radius, y: dy / radius };
    };
    joystick.addEventListener('pointerdown', (event) => { stickPointer = event.pointerId; joystick.setPointerCapture?.(event.pointerId); updateStick(event); });
    joystick.addEventListener('pointermove', (event) => { if (event.pointerId === stickPointer) updateStick(event); });
    const endStick = (event) => {
      if (event.pointerId !== stickPointer) return;
      stickPointer = null;
      stickVector = { x: 0, y: 0 };
      knob.style.transform = 'translate(0,0)';
    };
    joystick.addEventListener('pointerup', endStick);
    joystick.addEventListener('pointercancel', endStick);
    touchTimer = requestAnimationFrame(applyTouchMovement);
  }
  const onMobileInteract = () => nearest && onInteract?.(nearest);
  interactButton?.addEventListener('pointerdown', onMobileInteract);
  update();

  return {
    mode: 'lite',
    destroy() {
      destroyed = true;
      window.removeEventListener('keydown', onKey);
      if (touchTimer) cancelAnimationFrame(touchTimer);
      interactButton?.removeEventListener('pointerdown', onMobileInteract);
      onNearestChange?.(null);
      mount.replaceChildren();
    },
    setPreferences() {},
    setQuality() {},
    releasePointer() {},
  };
}
