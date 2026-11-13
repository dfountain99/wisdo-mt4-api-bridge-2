/* WISDO PRISM v1: dependency-free, hardware-accelerated WebGL 3D avatar.
   Low-poly procedural model until the approved PRISM brand rig is exported. */
(() => {
  'use strict';
  const canvas = document.getElementById('prism-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true });
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const moodLabel = document.getElementById('prism-mood');
  if (!gl) {
    canvas.insertAdjacentHTML('afterend', '<div class="scene-overlay">WebGL is unavailable on this device.</div>');
    window.Prism3D = { available: false, setMood() {}, wave() {}, celebrate() {} };
    return;
  }
  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uMvp;
    uniform mat4 uModel;
    varying vec3 vNormal;
    void main() {
      vNormal = mat3(uModel) * aNormal;
      gl_Position = uMvp * vec4(aPosition, 1.0);
    }`;
  const fragmentSource = `
    precision mediump float;
    varying vec3 vNormal;
    uniform vec3 uColor;
    void main() {
      vec3 n = normalize(vNormal);
      float light = 0.55 + max(dot(n, normalize(vec3(-0.5,0.8,1.0))),0.0)*0.48;
      gl_FragColor = vec4(uColor * light, 1.0);
    }`;
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program = gl.createProgram();
  try {
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    canvas.insertAdjacentHTML('afterend', '<div class="scene-overlay">3D renderer could not initialize.</div>');
    window.Prism3D = { available: false, setMood() {}, wave() {}, celebrate() {} };
    return;
  }
  gl.useProgram(program);
  const aPos = gl.getAttribLocation(program, 'aPosition');
  const aNormal = gl.getAttribLocation(program, 'aNormal');
  const uMvp = gl.getUniformLocation(program, 'uMvp');
  const uModel = gl.getUniformLocation(program, 'uModel');
  const uColor = gl.getUniformLocation(program, 'uColor');

  const I = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function mul(a,b) {
    const out = new Float32Array(16);
    for (let c=0;c<4;c++) for(let row=0;row<4;row++) {
      for(let k=0;k<4;k++) out[c*4+row] += a[k*4+row]*b[c*4+k];
    }
    return out;
  }
  const translate = (x,y,z) => { const m=I();m[12]=x;m[13]=y;m[14]=z;return m; };
  const scale = (x,y,z) => { const m=I();m[0]=x;m[5]=y;m[10]=z;return m; };
  const rx = (a) => { const m=I(), c=Math.cos(a), s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m; };
  const ry = (a) => { const m=I(), c=Math.cos(a), s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m; };
  const rz = (a) => { const m=I(), c=Math.cos(a), s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m; };
  const chain = (...parts) => parts.reduce(mul, I());
  function perspective(aspect) {
    const near=.1,far=40,f=1/Math.tan(Math.PI/8);
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  }
  function makeSphere(rows=14,columns=22) {
    const vertices=[],indices=[];
    for(let j=0;j<=rows;j++) {
      const theta=j*Math.PI/rows;
      for(let i=0;i<=columns;i++) {
        const phi=i*Math.PI*2/columns;
        const x=Math.sin(theta)*Math.cos(phi),y=Math.cos(theta),z=Math.sin(theta)*Math.sin(phi);
        vertices.push(x,y,z,x,y,z);
      }
    }
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++) {
      const a=j*(columns+1)+i,b=a+columns+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    return {vertices,indices};
  }
  function makeCube() {
    const vertices=[],indices=[];
    const faces=[
      [[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
      [[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
      [[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],
      [[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],
      [[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],
      [[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]
    ];
    for(let i=0;i<faces.length;i++){
      const [normal,...corners]=faces[i];
      for(const vertex of corners) vertices.push(...vertex,...normal);
      const k=i*4;indices.push(k,k+1,k+2,k,k+2,k+3);
    }
    return {vertices,indices};
  }
  function mesh(geometry) {
    const positions=gl.createBuffer(), indices=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,positions);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.vertices),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(geometry.indices),gl.STATIC_DRAW);
    return {positions,indices,count:geometry.indices.length};
  }
  const sphere=mesh(makeSphere()),cube=mesh(makeCube());
  const C={
    shell:[.055,.44,.7],head:[.11,.62,.82],dark:[.025,.11,.23],eyes:[.35,.98,1],
    shine:[.62,.97,1],joint:[.1,.27,.45],core:[.18,.89,.96],glow:[.11,.7,.78],
    mouth:[.36,.95,.96],foot:[.07,.29,.47]
  };
  let state='IDLE',stateUntil=0,angle=0,targetAngle=0,pitch=0,targetPitch=0,drag=null;
  const sleepTimeout = (mood, ms=2400) => {
    state=mood;
    stateUntil=performance.now()+ms;
    if (moodLabel) moodLabel.textContent=mood;
  };
  canvas.addEventListener('pointerdown',(event)=>{
    drag={x:event.clientX,y:event.clientY,a:targetAngle,p:targetPitch};
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove',(event)=>{
    if(!drag)return;
    targetAngle=drag.a+(event.clientX-drag.x)*.012;
    targetPitch=Math.min(.38,Math.max(-.38,drag.p+(event.clientY-drag.y)*.007));
  });
  for(const type of ['pointerup','pointercancel']) canvas.addEventListener(type,()=>{drag=null;});
  canvas.addEventListener('click',()=>sleepTimeout('WAVING',1500));

  let width=0,height=0,projection=I();
  function resize() {
    const rect=canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));
    if(w!==width||h!==height) {
      width=w;height=h;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);
      projection=perspective(w/h);
    }
  }
  function drawShape(shape,world,x,y,z,sx,sy,sz,color,rotation=0) {
    const model=chain(world,translate(x,y,z),rz(rotation),scale(sx,sy,sz));
    gl.uniformMatrix4fv(uModel,false,model);
    gl.uniformMatrix4fv(uMvp,false,mul(projection,model));
    gl.uniform3fv(uColor,color);
    gl.bindBuffer(gl.ARRAY_BUFFER,shape.positions);
    gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aNormal,3,gl.FLOAT,false,24,12);
    gl.enableVertexAttribArray(aNormal);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,shape.indices);
    gl.drawElements(gl.TRIANGLES,shape.count,gl.UNSIGNED_SHORT,0);
  }
  function frame(ms) {
    resize();
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(ms>stateUntil && state!=='IDLE') {
      state='IDLE';
      if(moodLabel) moodLabel.textContent=state;
    }
    angle+=(targetAngle-angle)*.08;
    pitch+=(targetPitch-pitch)*.08;
    const time=ms/1000;
    const moving=reducedMotion?0:1;
    const bob=Math.sin(time*2)*.045*moving;
    const happy=state==='CELEBRATING',waving=state==='WAVING'||state==='SPEAKING';
    const world=chain(translate(0,-.16+bob,-6.6),ry(angle+Math.sin(time*.25)*.10*moving),rx(pitch));
    drawShape(sphere,world,0,-.2,0,.69,.86,.46,C.shell);
    drawShape(sphere,world,0,-.27,.43,.31,.32,.09,C.core);
    drawShape(sphere,world,0,-.27,.5,.19,.19,.08,C.shine);
    drawShape(sphere,world,0,.95,0,.76,.7,.67,C.head);
    drawShape(sphere,world,0,.92,.43,.62,.46,.34,C.dark);
    drawShape(sphere,world,-.23,1.07,.74,.10,state==='LISTENING'?.15:.12,.09,C.eyes);
    drawShape(sphere,world,.23,1.07,.74,.10,state==='LISTENING'?.15:.12,.09,C.eyes);
    drawShape(sphere,world,-.2,1.1,.817,.035,.045,.025,C.shine);
    drawShape(sphere,world,.26,1.1,.817,.035,.045,.025,C.shine);
    for(let i=0;i<7;i++){
      const x=(i-3)*.095;
      const y=.72+Math.abs(i-3)*.022+(state==='SPEAKING'?Math.abs(Math.sin(time*12))*.03:0);
      drawShape(sphere,world,x,y,.764,.033,.032,.025,C.mouth);
    }
    drawShape(cube,world,0,1.66,0,.055,.22,.06,C.joint);
    drawShape(sphere,world,0,1.90,0,.14,.14,.14,C.core);
    drawShape(sphere,world,-.7,.20,0,.22,.25,.24,C.joint);
    drawShape(sphere,world,.7,.20,0,.22,.25,.24,C.joint);
    drawShape(cube,world,-.86,-.22,0,.17,.47,.19,C.shell,Math.sin(time*1.2)*.08*moving);
    drawShape(cube,world,.86,-.12,0,.17,.47,.19,C.shell,waving?-.8+Math.sin(time*9)*.3:-Math.sin(time*1.2)*.08*moving);
    drawShape(sphere,world,-.86,-.70,0,.21,.20,.19,C.eyes);
    drawShape(sphere,world,.86,-.62,0,.21,.20,.19,C.eyes);
    drawShape(cube,world,-.31,-1.14,0,.25,.37,.25,C.joint);
    drawShape(cube,world,.31,-1.14,0,.25,.37,.25,C.joint);
    drawShape(sphere,world,-.31,-1.49,.12,.35,.16,.4,C.foot);
    drawShape(sphere,world,.31,-1.49,.12,.35,.16,.4,C.foot);
    if(happy) {
      drawShape(sphere,world,-1.22,1.47,0,.10,.10,.10,C.eyes);
      drawShape(sphere,world,1.22,1.55,0,.13,.13,.13,C.core);
    }
    requestAnimationFrame(frame);
  }
  window.Prism3D = {
    available: true,
    setMood(value,ms=2500) { sleepTimeout(String(value||'IDLE').toUpperCase(),ms); },
    wave() { sleepTimeout('WAVING',1800); },
    celebrate() { sleepTimeout('CELEBRATING',3000); },
  };
  requestAnimationFrame(frame);
})();
