const EDITABLE = 'input,textarea,select,[contenteditable="true"]';

export class InputManager {
  constructor({ canvas, sensitivity = 0.0022, invertY = false } = {}) {
    this.canvas = canvas;
    this.sensitivity = sensitivity;
    this.invertY = invertY;
    this.keys = new Set();
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.jumpPressed = false;
    this.interactPressed = false;
    this.sprintTouch = false;
    this.listeners = [];
    this.pointerLocked = false;
    this.joystickPointer = null;
    this.lookPointer = null;
    this.lookLast = { x: 0, y: 0 };
    this.gamepadButtons = { jump: false, interact: false };
    this.bindDesktop();
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  isEditableTarget(target) {
    return Boolean(target?.closest?.(EDITABLE));
  }

  bindDesktop() {
    const onKeyDown = (event) => {
      if (this.isEditableTarget(event.target)) return;
      const key = String(event.key || '').toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' ','e'].includes(key)) event.preventDefault();
      if (key === ' ' && !this.keys.has(' ')) this.jumpPressed = true;
      if (key === 'e' && !this.keys.has('e')) this.interactPressed = true;
      this.keys.add(key);
    };
    const onKeyUp = (event) => this.keys.delete(String(event.key || '').toLowerCase());
    const clear = () => this.clearContinuous();
    const onPointerLock = () => { this.pointerLocked = document.pointerLockElement === this.canvas; };
    const onMouseMove = (event) => {
      if (!this.pointerLocked) return;
      this.lookX += Number(event.movementX || 0) * this.sensitivity;
      this.lookY += Number(event.movementY || 0) * this.sensitivity * (this.invertY ? -1 : 1);
    };
    this.listen(window, 'keydown', onKeyDown, { passive: false });
    this.listen(window, 'keyup', onKeyUp);
    this.listen(window, 'blur', clear);
    this.listen(document, 'visibilitychange', () => { if (document.hidden) clear(); });
    this.listen(document, 'pointerlockchange', onPointerLock);
    this.listen(document, 'mousemove', onMouseMove);
    if (this.canvas) {
      this.listen(this.canvas, 'click', () => {
        if (!matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
      });
    }
  }

  bindTouch({ joystick, knob, lookZone, jumpButton, sprintButton, interactButton } = {}) {
    if (joystick && knob) {
      const updateStick = (event) => {
        const rect = joystick.getBoundingClientRect();
        const radius = Math.max(28, Math.min(rect.width, rect.height) * 0.37);
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = event.clientX - cx;
        let dy = event.clientY - cy;
        const length = Math.hypot(dx, dy) || 1;
        if (length > radius) { dx = dx / length * radius; dy = dy / length * radius; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        this.moveX = Math.max(-1, Math.min(1, dx / radius));
        this.moveY = Math.max(-1, Math.min(1, -dy / radius));
      };
      this.listen(joystick, 'pointerdown', (event) => {
        this.joystickPointer = event.pointerId;
        joystick.setPointerCapture?.(event.pointerId);
        updateStick(event);
      });
      this.listen(joystick, 'pointermove', (event) => { if (event.pointerId === this.joystickPointer) updateStick(event); });
      const end = (event) => {
        if (event.pointerId !== this.joystickPointer) return;
        this.joystickPointer = null;
        this.moveX = 0;
        this.moveY = 0;
        knob.style.transform = 'translate(0,0)';
      };
      this.listen(joystick, 'pointerup', end);
      this.listen(joystick, 'pointercancel', end);
    }

    if (lookZone) {
      this.listen(lookZone, 'pointerdown', (event) => {
        this.lookPointer = event.pointerId;
        this.lookLast = { x: event.clientX, y: event.clientY };
        lookZone.setPointerCapture?.(event.pointerId);
      });
      this.listen(lookZone, 'pointermove', (event) => {
        if (event.pointerId !== this.lookPointer) return;
        const dx = event.clientX - this.lookLast.x;
        const dy = event.clientY - this.lookLast.y;
        this.lookLast = { x: event.clientX, y: event.clientY };
        this.lookX += dx * this.sensitivity * 1.3;
        this.lookY += dy * this.sensitivity * 1.3 * (this.invertY ? -1 : 1);
      });
      const end = (event) => { if (event.pointerId === this.lookPointer) this.lookPointer = null; };
      this.listen(lookZone, 'pointerup', end);
      this.listen(lookZone, 'pointercancel', end);
    }

    if (jumpButton) this.listen(jumpButton, 'pointerdown', (event) => { event.preventDefault(); this.jumpPressed = true; });
    if (interactButton) this.listen(interactButton, 'pointerdown', (event) => { event.preventDefault(); this.interactPressed = true; });
    if (sprintButton) {
      this.listen(sprintButton, 'pointerdown', (event) => { event.preventDefault(); this.sprintTouch = true; sprintButton.classList.add('active'); });
      const end = () => { this.sprintTouch = false; sprintButton.classList.remove('active'); };
      this.listen(sprintButton, 'pointerup', end);
      this.listen(sprintButton, 'pointercancel', end);
      this.listen(sprintButton, 'pointerleave', end);
    }
  }

  sampleGamepad() {
    const pad = navigator.getGamepads?.()?.find(Boolean);
    if (!pad) return null;
    const dead = (v) => Math.abs(v) < 0.14 ? 0 : v;
    return {
      moveX: dead(pad.axes?.[0] || 0),
      moveY: -dead(pad.axes?.[1] || 0),
      lookX: dead(pad.axes?.[2] || 0) * 0.035,
      lookY: dead(pad.axes?.[3] || 0) * 0.028,
      sprint: Boolean(pad.buttons?.[10]?.pressed || pad.buttons?.[4]?.pressed),
      jump: Boolean(pad.buttons?.[0]?.pressed),
      interact: Boolean(pad.buttons?.[2]?.pressed),
    };
  }

  frame() {
    const keyboardX = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    const keyboardY = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
    const pad = this.sampleGamepad();
    let moveX = Math.abs(this.moveX) > Math.abs(keyboardX) ? this.moveX : keyboardX;
    let moveY = Math.abs(this.moveY) > Math.abs(keyboardY) ? this.moveY : keyboardY;
    if (pad && Math.abs(pad.moveX) > Math.abs(moveX)) moveX = pad.moveX;
    if (pad && Math.abs(pad.moveY) > Math.abs(moveY)) moveY = pad.moveY;
    let length = Math.hypot(moveX, moveY);
    if (length > 1) { moveX /= length; moveY /= length; length = 1; }
    const padJump = Boolean(pad?.jump);
    const padInteract = Boolean(pad?.interact);
    const output = {
      moveX,
      moveY,
      magnitude: length,
      sprint: this.keys.has('shift') || this.sprintTouch || Boolean(pad?.sprint),
      jumpPressed: this.jumpPressed || (padJump && !this.gamepadButtons.jump),
      interactPressed: this.interactPressed || (padInteract && !this.gamepadButtons.interact),
      lookX: this.lookX + (pad?.lookX || 0),
      lookY: this.lookY + (pad?.lookY || 0),
    };
    this.gamepadButtons.jump = padJump;
    this.gamepadButtons.interact = padInteract;
    this.jumpPressed = false;
    this.interactPressed = false;
    this.lookX = 0;
    this.lookY = 0;
    return output;
  }

  setPreferences({ sensitivity, invertY } = {}) {
    if (Number.isFinite(Number(sensitivity))) this.sensitivity = Number(sensitivity);
    if (typeof invertY === 'boolean') this.invertY = invertY;
  }

  clearContinuous() {
    this.keys.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.sprintTouch = false;
  }

  releasePointer() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }

  destroy() {
    this.clearContinuous();
    this.listeners.splice(0).forEach((remove) => remove());
  }
}
