'use strict';
// Postprocesado propio: escena HDR -> bloom multinivel -> tonemapping ACES + gradación de color + viñeta + grano.

const Post = {
  on: false, levels: 0, rts: [], sceneRT: null,
  init(renderer) {
    this.renderer = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.pscene = new THREE.Scene(); this.pscene.add(this.quad);
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.bright = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 1.0 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D t; uniform vec2 texel; uniform float thr; varying vec2 vUv;
        void main(){
          vec3 c = (texture2D(t, vUv + texel * vec2(-1.,-1.)).rgb + texture2D(t, vUv + texel * vec2(1.,-1.)).rgb
                  + texture2D(t, vUv + texel * vec2(-1.,1.)).rgb + texture2D(t, vUv + texel * vec2(1.,1.)).rgb) * 0.25;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c *= smoothstep(thr, thr + 0.8, l);
          gl_FragColor = vec4(min(c, vec3(30.0)), 1.0);
        }` });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(t, vUv).rgb * 0.2270270;
          c += (texture2D(t, vUv + dir * 1.3846154).rgb + texture2D(t, vUv - dir * 1.3846154).rgb) * 0.3162162;
          c += (texture2D(t, vUv + dir * 3.2307692).rgb + texture2D(t, vUv - dir * 3.2307692).rgb) * 0.0702703;
          gl_FragColor = vec4(c, 1.0);
        }` });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, b0: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null },
        strength: { value: 0.6 }, exposure: { value: 0.85 }, time: { value: 0 }, sat: { value: 1.12 }, contrast: { value: 1.06 },
        tint: { value: new THREE.Vector3(1.03, 1.0, 0.96) }, vig: { value: 0.32 }, grain: { value: 0.018 }, levels: { value: 4 } },
      vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tScene, b0, b1, b2, b3; uniform float strength, exposure, time, sat, contrast, vig, grain, levels; uniform vec3 tint; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec3 c = texture2D(tScene, vUv).rgb;
          vec3 b = texture2D(b0, vUv).rgb * 0.45 + texture2D(b1, vUv).rgb * 0.3;
          if (levels > 2.5) b += texture2D(b2, vUv).rgb * 0.2;
          if (levels > 3.5) b += texture2D(b3, vUv).rgb * 0.15;
          c += b * strength;
          c = aces(c * exposure);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, sat);
          c = clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0) * tint;
          vec2 d = vUv - 0.5; c *= 1.0 - vig * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
          c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
          c += (rnd(vUv * 731.0 + time) - 0.5) * grain;
          gl_FragColor = vec4(c, 1.0);
        }` });
  },
  configure(on, levels, msaa) {
    this.on = on; this.levels = levels; this.msaa = msaa;
    this.dispose();
    if (on) this.setSize(this.w || innerWidth, this.h || innerHeight);
  },
  dispose() { if (this.sceneRT) this.sceneRT.dispose(); this.rts.forEach(p => { p[0].dispose(); p[1].dispose(); }); this.rts = []; this.sceneRT = null; },
  setSize(w, h) {
    this.w = w; this.h = h;
    if (!this.on) return;
    const pr = this.renderer.getPixelRatio(), W = Math.max(1, Math.floor(w * pr)), Hh = Math.max(1, Math.floor(h * pr));
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    if (!this.sceneRT) this.sceneRT = new THREE.WebGLRenderTarget(W, Hh, Object.assign({ samples: this.msaa }, opt));
    else this.sceneRT.setSize(W, Hh);
    for (let k = 0; k < this.levels; k++) {
      const s = Math.pow(2, k + 1), ww = Math.max(1, Math.floor(W / s)), hh = Math.max(1, Math.floor(Hh / s));
      if (!this.rts[k]) this.rts[k] = [new THREE.WebGLRenderTarget(ww, hh, Object.assign({ depthBuffer: false }, opt)), new THREE.WebGLRenderTarget(ww, hh, Object.assign({ depthBuffer: false }, opt))];
      else { this.rts[k][0].setSize(ww, hh); this.rts[k][1].setSize(ww, hh); }
    }
  },
  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.pscene, this.cam); },
  render(scene, camera, time, nightAmt) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT); r.render(scene, camera);
    const R0 = this.rts[0];
    this.bright.uniforms.t.value = this.sceneRT.texture;
    this.bright.uniforms.texel.value.set(1 / this.sceneRT.width, 1 / this.sceneRT.height);
    this.bright.uniforms.thr.value = 0.9 - nightAmt * 0.35;
    this.pass(this.bright, R0[0]);
    for (let k = 0; k < this.levels; k++) {
      const P = this.rts[k];
      if (k > 0) { this.blur.uniforms.t.value = this.rts[k - 1][0].texture; this.blur.uniforms.dir.value.set(1 / P[0].width, 0); this.pass(this.blur, P[0]); }
      this.blur.uniforms.t.value = P[0].texture; this.blur.uniforms.dir.value.set(1 / P[0].width, 0); this.pass(this.blur, P[1]);
      this.blur.uniforms.t.value = P[1].texture; this.blur.uniforms.dir.value.set(0, 1 / P[0].height); this.pass(this.blur, P[0]);
    }
    const u = this.comp.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.b0.value = this.rts[0][0].texture; u.b1.value = (this.rts[1] || this.rts[0])[0].texture;
    u.b2.value = (this.rts[2] || this.rts[0])[0].texture; u.b3.value = (this.rts[3] || this.rts[0])[0].texture;
    u.levels.value = this.levels; u.time.value = time % 100;
    u.strength.value = 0.45 + nightAmt * 0.45;
    u.exposure.value = 0.85 + nightAmt * 0.55;
    this.pass(this.comp, null);
  },
};
