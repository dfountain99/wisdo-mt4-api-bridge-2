const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function addDisposable(list, value) { if (value) list.push(value); return value; }

export function installEmergencyWisdoOperator({ THREE, scene } = {}) {
  if (!THREE || !scene) return null;
  const operator = scene.getObjectByName?.('WisdoOperator');
  if (!operator) return null;
  if (operator.getObjectByName?.('WISDOAuthoredOperatorMount')) return null;

  const existing = operator.getObjectByName?.('WISDOCinematicFallbackOperator') || operator.getObjectByName?.('WISDOEmergencyOperatorV2');
  if (existing) return { shell: existing, update() {}, destroy() {} };

  const disposables = [];
  const previousVisibility = new Map();
  for (const child of operator.children) {
    if (child.name === 'WISDOAuthoredOperatorMount') continue;
    previousVisibility.set(child, child.visible);
    child.visible = false;
  }

  const shell = new THREE.Group();
  shell.name = 'WISDOEmergencyOperatorV2';
  shell.userData.cinematicFallback = true;
  shell.userData.productionFallback = true;

  const suit = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x080b11, roughness: .48, metalness: .36 }));
  const panel = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x151b26, roughness: .36, metalness: .56 }));
  const skin = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x855a43, roughness: .78, metalness: 0 }));
  const cyan = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x64e9ff, emissive: 0x0a6f91, emissiveIntensity: 1.8, roughness: .22, metalness: .45 }));
  const violet = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x715cff, emissive: 0x24105f, emissiveIntensity: 1.15, roughness: .26, metalness: .42 }));

  const pelvis = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.38, .26, .27)), panel);
  pelvis.position.y = .83;
  shell.add(pelvis);

  const torso = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.27, .34, .78, 12)), suit);
  torso.position.y = 1.34;
  torso.scale.z = .72;
  shell.add(torso);

  const chestPanel = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.46, .17, .29)), panel);
  chestPanel.position.set(0, 1.46, -.06);
  shell.add(chestPanel);

  const hood = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(.21, .055, 8, 20, Math.PI * 1.35)), panel);
  hood.position.set(0, 1.87, .03);
  hood.rotation.x = Math.PI / 2;
  hood.rotation.z = Math.PI * .82;
  shell.add(hood);

  const neck = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.08, .095, .15, 10)), skin);
  neck.position.y = 1.82;
  shell.add(neck);

  const head = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.22, 18, 14)), panel);
  head.position.y = 2.08;
  head.scale.set(.98, 1.12, .94);
  shell.add(head);
  const visor = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.34, .115, .055)), cyan);
  visor.position.set(0, 2.09, -.2);
  shell.add(visor);

  const logo = new THREE.Group();
  logo.name = 'WISDOFallbackBackLogo';
  logo.position.set(0, 1.46, .235);
  for (const [x, tilt] of [[-.075, -.36], [-.022, .36], [.022, -.36], [.075, .36]]) {
    const slash = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.028, .18, .018)), x < 0 ? violet : cyan);
    slash.position.x = x;
    slash.rotation.z = tilt;
    logo.add(slash);
  }
  shell.add(logo);

  const joints = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .37, 1.56, 0);
    const upper = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.075, .092, .5, 10)), suit);
    upper.position.y = -.25;
    arm.add(upper);
    const fore = new THREE.Group();
    fore.position.y = -.49;
    const foreMesh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.064, .078, .43, 10)), panel);
    foreMesh.position.y = -.2;
    fore.add(foreMesh);
    const wrist = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(.075, .011, 6, 18)), side < 0 ? cyan : violet);
    wrist.position.y = -.38;
    wrist.rotation.x = Math.PI / 2;
    fore.add(wrist);
    const hand = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.082, 10, 8)), skin);
    hand.position.y = -.46;
    hand.scale.set(.85, 1.08, .82);
    fore.add(hand);
    arm.add(fore);
    shell.add(arm);

    const leg = new THREE.Group();
    leg.position.set(side * .15, .72, 0);
    const thigh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.095, .118, .58, 10)), suit);
    thigh.position.y = -.29;
    leg.add(thigh);
    const calf = new THREE.Group();
    calf.position.y = -.57;
    const calfMesh = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.078, .1, .51, 10)), panel);
    calfMesh.position.y = -.25;
    calf.add(calfMesh);
    const shoe = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.2, .13, .34)), suit);
    shoe.position.set(0, -.54, -.07);
    calf.add(shoe);
    leg.add(calf);
    shell.add(leg);

    joints[side < 0 ? 'leftArm' : 'rightArm'] = arm;
    joints[side < 0 ? 'leftFore' : 'rightFore'] = fore;
    joints[side < 0 ? 'leftLeg' : 'rightLeg'] = leg;
    joints[side < 0 ? 'leftCalf' : 'rightCalf'] = calf;
  }

  shell.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  operator.add(shell);

  const previous = new THREE.Vector3();
  const current = new THREE.Vector3();
  operator.getWorldPosition(previous);
  let phase = 0;

  return {
    shell,
    update(dt) {
      if (!shell.visible) return;
      operator.getWorldPosition(current);
      const speed = clamp(current.distanceTo(previous) / Math.max(.001, dt), 0, 9);
      previous.copy(current);
      phase += dt * (speed > .15 ? 5.1 + speed * .7 : 1.6);
      const amplitude = speed > .12 ? clamp(speed / 5.5, .12, .78) : .018;
      const swing = Math.sin(phase) * amplitude;
      joints.leftLeg.rotation.x = swing;
      joints.rightLeg.rotation.x = -swing;
      joints.leftCalf.rotation.x = Math.max(0, -swing) * .4;
      joints.rightCalf.rotation.x = Math.max(0, swing) * .4;
      joints.leftArm.rotation.x = -swing * .6;
      joints.rightArm.rotation.x = swing * .6;
      joints.leftFore.rotation.x = -.12 + Math.max(0, swing) * .16;
      joints.rightFore.rotation.x = -.12 + Math.max(0, -swing) * .16;
    },
    destroy() {
      operator.remove(shell);
      for (const [child, visible] of previousVisibility) child.visible = visible;
      shell.traverse((object) => object.geometry?.dispose?.());
      for (const item of disposables.reverse()) item?.dispose?.();
    },
  };
}
