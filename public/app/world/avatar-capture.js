const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function frameQuality(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  let brightness = 0;
  let brightnessCount = 0;
  let edge = 0;
  let edgeCount = 0;
  const step = 16;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const lum = (data[i] * .2126) + (data[i + 1] * .7152) + (data[i + 2] * .0722);
      brightness += lum;
      brightnessCount += 1;
      if (x + step < width) {
        const j = (y * width + x + step) * 4;
        const lum2 = (data[j] * .2126) + (data[j + 1] * .7152) + (data[j + 2] * .0722);
        edge += Math.abs(lum2 - lum);
        edgeCount += 1;
      }
    }
  }
  const mean = brightnessCount ? brightness / brightnessCount : 0;
  const edgeMean = edgeCount ? edge / edgeCount : 0;
  return {
    brightness: mean,
    lighting: mean < 48 ? 'dim' : mean > 220 ? 'bright' : 'good',
    blur: edgeMean < 5.5 ? 'soft' : 'good',
  };
}

async function detectFace(canvas) {
  if (!('FaceDetector' in globalThis)) return { supported: false, detected: false, ratio: null };
  try {
    const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(canvas);
    if (faces.length !== 1) return { supported: true, detected: false, ratio: null };
    const box = faces[0].boundingBox;
    const ratio = box?.height ? box.width / box.height : null;
    return { supported: true, detected: true, ratio: Number.isFinite(ratio) ? ratio : null };
  } catch {
    return { supported: true, detected: false, ratio: null };
  }
}

function deriveSafeFaceParameters(samples = []) {
  const ratios = samples.map((sample) => sample.face?.ratio).filter(Number.isFinite);
  if (!ratios.length) return { headPreset: 'standard', morphParameters: {} };
  const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  const faceWidth = clamp((average - .72) * 2.4, -1, 1);
  const headPreset = average > .82 ? 'round' : average < .66 ? 'oval' : 'standard';
  return { headPreset, morphParameters: { faceWidth: Number(faceWidth.toFixed(3)) } };
}

export async function runGuidedOperatorCapture({ mount, onCancel = null } = {}) {
  if (!mount) throw new Error('Capture mount is required.');
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device does not expose a browser camera API. Build your Operator manually instead.');

  mount.innerHTML = `
    <section class="capture-shell">
      <div class="capture-stage">
        <video class="capture-video" playsinline muted></video>
        <div class="capture-guide" aria-hidden="true"><i></i></div>
      </div>
      <div class="capture-copy">
        <span class="modal-kicker">GUIDED OPERATOR CAPTURE</span>
        <h3 class="capture-instruction">Preparing camera…</h3>
        <p class="capture-note">Frames stay on this device. WISDO submits only approved avatar parameters and capture-quality metadata.</p>
        <div class="capture-progress"></div>
        <div class="modal-actions"><button class="action primary capture-step" type="button" disabled>Capture Step</button><button class="action capture-cancel" type="button">Cancel</button></div>
      </div>
    </section>`;

  const video = mount.querySelector('.capture-video');
  const instruction = mount.querySelector('.capture-instruction');
  const progress = mount.querySelector('.capture-progress');
  const stepButton = mount.querySelector('.capture-step');
  const cancelButton = mount.querySelector('.capture-cancel');
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const steps = ['LOOK FORWARD', 'TURN SLIGHTLY LEFT', 'TURN SLIGHTLY RIGHT', 'LOOK SLIGHTLY UP', 'RETURN TO CENTER'];
  const samples = [];
  let stream = null;
  let step = 0;
  let cancelled = false;

  const stop = () => {
    for (const track of stream?.getTracks?.() || []) track.stop();
    stream = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    video.srcObject = null;
  };

  cancelButton.addEventListener('click', () => {
    cancelled = true;
    stop();
    onCancel?.();
  }, { once: true });

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    if (cancelled) { stop(); throw new Error('Capture cancelled.'); }
    video.srcObject = stream;
    await video.play();
    instruction.textContent = steps[0];
    progress.textContent = `STEP 1 OF ${steps.length}`;
    stepButton.disabled = false;
  } catch (error) {
    stop();
    throw new Error(error?.name === 'NotAllowedError' ? 'Camera permission was declined. You can still build your Operator manually.' : (error.message || 'Camera could not start.'));
  }

  return await new Promise((resolve, reject) => {
    stepButton.addEventListener('click', async () => {
      if (cancelled) return;
      stepButton.disabled = true;
      try {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        const quality = frameQuality(ctx, canvas.width, canvas.height);
        const face = await detectFace(canvas);
        samples.push({ quality, face });
        step += 1;
        if (step >= steps.length) {
          stop();
          const lightingGood = samples.filter((sample) => sample.quality.lighting === 'good').length;
          const blurGood = samples.filter((sample) => sample.quality.blur === 'good').length;
          const faceDetectedCount = samples.filter((sample) => sample.face.detected).length;
          const derived = deriveSafeFaceParameters(samples);
          resolve({
            avatarSeed: derived,
            quality: {
              faceDetected: faceDetectedCount >= 3,
              lighting: lightingGood >= 3 ? 'good' : samples.at(-1)?.quality?.lighting || 'unknown',
              blur: blurGood >= 3 ? 'good' : 'soft',
              posesCompleted: steps.length,
              processor: samples.some((sample) => sample.face.supported) ? 'browser-face-detector-shape-v1' : 'capture-quality-only-v1',
            },
            fittingCapability: samples.some((sample) => sample.face.supported) ? 'basic-face-shape' : 'manual-confirmation-required',
          });
          return;
        }
        instruction.textContent = steps[step];
        progress.textContent = `STEP ${step + 1} OF ${steps.length}`;
        stepButton.disabled = false;
      } catch (error) {
        stop();
        reject(error);
      }
    });
  });
}
