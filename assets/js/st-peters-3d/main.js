import * as THREE from 'three';
import { createMaterials } from '/assets/js/st-peters-3d/textures.js';
import { buildArchitecture } from '/assets/js/st-peters-3d/architecture.js';
import { buildInterior } from '/assets/js/st-peters-3d/interior.js';
import { buildChurchyard, createSkyDome } from '/assets/js/st-peters-3d/churchyard.js';
import { buildAtmosphere } from '/assets/js/st-peters-3d/atmosphere.js';
import { createChurchAudio } from '/assets/js/st-peters-3d/audio.js';
import { CHURCH_TOUR_WAYPOINTS } from '/assets/js/st-peters-3d/dimensions.js';
import { CAMERA_PRESETS, createCameraController } from '/assets/js/st-peters-3d/controls.js';

const stage = document.getElementById('church-scene');
const statusEl = document.getElementById('scene-status');

if (stage) {
  const initialW = Math.max(stage.clientWidth, 320);
  const initialH = Math.max(stage.clientHeight, 320);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialW, initialH, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc4d8eb, 0.0095);

  const camera = new THREE.PerspectiveCamera(48, initialW / initialH, 0.08, 220);
  camera.position.set(...CAMERA_PRESETS['exterior-nw'].pos);

  // Sky & Lighting Rig
  const sky = createSkyDome();
  scene.add(sky.mesh);

  const hemiLight = new THREE.HemisphereLight(0xbcd8f5, 0x5c6b48, 0.72);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.5);
  sunLight.position.set(-16, 15, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 65;
  sunLight.shadow.camera.left = -22;
  sunLight.shadow.camera.right = 22;
  sunLight.shadow.camera.top = 22;
  sunLight.shadow.camera.bottom = -16;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xd4e6fa, 0.45);
  fillLight.position.set(14, 12, -16);
  scene.add(fillLight);

  // Build Church, Churchyard & Cinematic Stained-Glass Atmosphere
  const mats = createMaterials(renderer);
  const { wallsGroup, roofGroup, doorPivots } = buildArchitecture(mats);
  const { interiorGroup, ceilingGroup, chandelierLights, causticMesh, candleEffect } = buildInterior(mats);
  const { group: churchyardGroup, christmasEffect, memorialGroups } = buildChurchyard(mats);
  const atmosphere = buildAtmosphere();

  scene.add(wallsGroup);
  scene.add(roofGroup);
  scene.add(interiorGroup);
  scene.add(ceilingGroup);
  scene.add(churchyardGroup);
  scene.add(atmosphere.group);

  const controller = createCameraController(camera, renderer.domElement);
  controller.goToPreset('exterior-nw');

  const state = {
    cutaway: false,
    doorsOpen: false,
    doorAnim: 0,
    lighting: 'autumn',
    activePreset: 'exterior-nw'
  };

  const LIGHTING_MOODS = {
    autumn: {
      sunPos: [-16, 15, 20],
      sunColor: 0xfff1d6,
      sunInt: 2.55,
      hemiSky: 0xbcd8f5,
      hemiGround: 0x5c6b48,
      hemiInt: 0.74,
      skyTop: 0x2a64b5,
      skyHorizon: 0xc8dcf0,
      fogColor: 0xc4d8eb,
      chandelierScale: 0.95,
      glassGlow: 0.58,
      causticOp: 0.65,
      exposure: 1.06
    },
    golden: {
      sunPos: [-24, 6.5, 16],
      sunColor: 0xffb86b,
      sunInt: 2.9,
      hemiSky: 0xf0c29e,
      hemiGround: 0x4c4836,
      hemiInt: 0.56,
      skyTop: 0x354d8c,
      skyHorizon: 0xf2b57c,
      fogColor: 0xd9ad84,
      chandelierScale: 1.35,
      glassGlow: 0.75,
      causticOp: 0.82,
      exposure: 1.04
    },
    evensong: {
      sunPos: [-18, 12, 14],
      sunColor: 0x6f8ec4,
      sunInt: 0.35,
      hemiSky: 0x26385e,
      hemiGround: 0x1a1e18,
      hemiInt: 0.28,
      skyTop: 0x0b1429,
      skyHorizon: 0x233354,
      fogColor: 0x182338,
      chandelierScale: 2.45,
      glassGlow: 0.22,
      causticOp: 0.0,
      exposure: 1.12
    }
  };

  function applyLighting(moodKey) {
    const m = LIGHTING_MOODS[moodKey];
    if (!m) return;
    state.lighting = moodKey;
    sunLight.position.set(...m.sunPos);
    sunLight.color.setHex(m.sunColor);
    sunLight.intensity = m.sunInt;
    hemiLight.color.setHex(m.hemiSky);
    hemiLight.groundColor.setHex(m.hemiGround);
    hemiLight.intensity = m.hemiInt;
    sky.material.uniforms.topColor.value.setHex(m.skyTop);
    sky.material.uniforms.horizonColor.value.setHex(m.skyHorizon);
    sky.material.uniforms.sunDir.value.set(...m.sunPos).normalize();
    sky.material.uniforms.sunColor.value.setHex(m.sunColor);
    sky.material.uniforms.sunHaloStrength.value = moodKey === 'golden' ? 0.92 : moodKey === 'evensong' ? 0.08 : 0.58;
    sky.material.uniforms.cloudColor.value.setHex(
      moodKey === 'golden' ? 0xffd2a1 : moodKey === 'evensong' ? 0x263452 : 0xf8f3ea
    );
    sky.material.uniforms.cloudStrength.value = moodKey === 'evensong' ? 0.22 : 0.4;
    sky.material.uniforms.starStrength.value = moodKey === 'evensong' ? 0.85 : 0.0;
    scene.fog.color.setHex(m.fogColor);
    renderer.toneMappingExposure = m.exposure;

    chandelierLights.forEach((lt, idx) => {
      lt.intensity = (idx === 3 ? 1.35 : 1.75) * m.chandelierScale;
    });
    mats.glassShade.emissiveIntensity = moodKey === 'evensong' ? 1.55 : 0.7;
    mats.glassEast.emissiveIntensity = m.glassGlow;
    mats.glassSower.emissiveIntensity = m.glassGlow * 1.1;
    mats.glassNorthNave.emissiveIntensity = m.glassGlow * 0.95;
    mats.glassClear.emissiveIntensity = m.glassGlow * 0.65;
    causticMesh.material.opacity = m.causticOp;
    atmosphere.setMood(moodKey);
    candleEffect.setMood(moodKey);
    if (christmasEffect) christmasEffect.setMood(moodKey);

    document.querySelectorAll('[data-lighting]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lighting === moodKey));
    });
  }

  function setCutaway(enabled) {
    state.cutaway = enabled;
    roofGroup.visible = !enabled;
    ceilingGroup.visible = !enabled;
    atmosphere.group.visible = !enabled;
    const btn = document.getElementById('btn-cutaway');
    if (btn) btn.setAttribute('aria-pressed', String(enabled));
  }

  function setDoorsOpen(open) {
    state.doorsOpen = open;
    const btn = document.getElementById('btn-doors');
    if (btn) {
      btn.setAttribute('aria-pressed', String(open));
      btn.textContent = open ? 'Doors: Open' : 'Doors: Closed';
    }
  }

  function setWalkMode(isWalk) {
    controller.setMode(isWalk ? 'walk' : 'orbit');
    if (isWalk) setDoorsOpen(true);
    const btn = document.getElementById('btn-walk');
    const hint = document.getElementById('walk-hint');
    if (btn) {
      btn.setAttribute('aria-pressed', String(isWalk));
      btn.textContent = isWalk ? 'Mode: Walk' : 'Mode: Orbit';
    }
    if (hint) hint.hidden = !isWalk;
  }

  function selectPreset(key) {
    if (!CAMERA_PRESETS[key]) return;
    state.activePreset = key;
    document.querySelectorAll('[data-preset]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.preset === key));
    });
    controller.goToPreset(key, (meta) => {
      setCutaway(Boolean(meta.cutaway));
      if (meta.doorsOpen) setDoorsOpen(true);
      setWalkMode(false);
    });
  }

  // Bind Viewpoint Buttons & Guided Church Tour
  const tourBtn = document.getElementById('btn-tour');
  const tourBanner = document.getElementById('tour-banner');

  function setTourUI(active, label = '') {
    if (tourBtn) {
      tourBtn.setAttribute('aria-pressed', String(active));
      tourBtn.textContent = active ? 'Stop Tour' : 'Church Tour';
    }
    if (tourBanner) {
      tourBanner.hidden = !active;
      if (active && label) {
        tourBanner.textContent = `Church Tour · ${label}`;
      }
    }
  }

  function startChurchTour() {
    state.activePreset = null;
    document.querySelectorAll('[data-preset]').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
    });
    setWalkMode(false);
    setCutaway(false);
    controller.startTour(CHURCH_TOUR_WAYPOINTS, {
      onStep(wp) {
        if (typeof wp.cutaway === 'boolean') setCutaway(wp.cutaway);
        if (typeof wp.doorsOpen === 'boolean') setDoorsOpen(wp.doorsOpen);
        setTourUI(true, wp.label);
      },
      onEnd(completed) {
        setTourUI(false);
        if (completed) {
          state.activePreset = 'exterior-nw';
          document.querySelectorAll('[data-preset]').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.preset === 'exterior-nw'));
          });
        }
      }
    });
  }

  function toggleChurchTour() {
    if (controller.isTouring()) {
      controller.stopTour(false);
    } else {
      startChurchTour();
    }
  }

  tourBtn?.addEventListener('click', toggleChurchTour);

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => selectPreset(btn.dataset.preset));
  });

  document.querySelectorAll('[data-lighting]').forEach((btn) => {
    btn.addEventListener('click', () => applyLighting(btn.dataset.lighting));
  });

  document.getElementById('btn-cutaway')?.addEventListener('click', () => {
    setCutaway(!state.cutaway);
  });

  document.getElementById('btn-doors')?.addEventListener('click', () => {
    setDoorsOpen(!state.doorsOpen);
  });

  document.getElementById('btn-walk')?.addEventListener('click', () => {
    setWalkMode(controller.getMode() !== 'walk');
  });

  // Procedural parish pipe-organ voluntary (quietly stone-muffled outside, richer & louder inside)
  const churchAudio = createChurchAudio();
  const soundBtn = document.getElementById('btn-sound');
  const soundOnIcon = soundBtn?.querySelector('[data-icon="sound-on"]');
  const soundOffIcon = soundBtn?.querySelector('[data-icon="sound-off"]');

  function setSoundMuted(isMuted) {
    churchAudio.setMuted(isMuted);
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', String(isMuted));
      const label = isMuted ? 'Unmute church organ music' : 'Mute church organ music';
      soundBtn.setAttribute('aria-label', label);
      soundBtn.title = `${label} (M)`;
    }
    soundOnIcon?.toggleAttribute('hidden', isMuted);
    soundOffIcon?.toggleAttribute('hidden', !isMuted);
  }

  soundBtn?.addEventListener('click', () => {
    // If autoplay was suspended by the browser until this click, start the music rather than muting it
    if (!churchAudio.isMuted() && !churchAudio.isRunning()) {
      setSoundMuted(false);
      return;
    }
    setSoundMuted(!churchAudio.isMuted());
  });

  // Prime spatial acoustics for the initial camera position before starting audio
  churchAudio.updateSpatial(camera.position, state.doorsOpen);

  // Register gesture unlock listeners immediately (do not wait for start() to resolve, because
  // browser AudioContext.resume() stays pending when autoplay is deferred until first interaction)
  const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'click', 'keydown', 'wheel', 'touchstart'];
  function removeUnlockListeners() {
    for (const evt of UNLOCK_EVENTS) {
      window.removeEventListener(evt, unlockChurchAudio, true);
    }
  }
  function unlockChurchAudio(e) {
    if (churchAudio.isMuted()) return;
    if (churchAudio.isRunning()) {
      removeUnlockListeners();
      return;
    }
    if (soundBtn && e?.target instanceof Node && soundBtn.contains(e.target)) return;
    churchAudio.start().then((ok) => {
      if (ok) removeUnlockListeners();
    });
  }
  for (const evt of UNLOCK_EVENTS) {
    window.addEventListener(evt, unlockChurchAudio, { capture: true, passive: true });
  }
  churchAudio.start().then((ok) => {
    if (ok) removeUnlockListeners();
  });

  const stageWrapper = stage.closest('.reconstruction-stage') || stage;
  const fsBtn = document.getElementById('btn-fullscreen');
  if (fsBtn) {
    if (!document.fullscreenEnabled) {
      fsBtn.hidden = true;
    } else {
      fsBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          stageWrapper.requestFullscreen().catch(() => {});
        }
      });
      const fsEnterIcon = fsBtn.querySelector('[data-icon="fs-enter"]');
      const fsExitIcon = fsBtn.querySelector('[data-icon="fs-exit"]');
      document.addEventListener('fullscreenchange', () => {
        const isFs = document.fullscreenElement === stageWrapper;
        fsBtn.setAttribute('aria-pressed', String(isFs));
        const label = isFs ? 'Exit fullscreen' : 'Enter fullscreen';
        fsBtn.setAttribute('aria-label', label);
        fsBtn.title = label;
        fsEnterIcon?.toggleAttribute('hidden', isFs);
        fsExitIcon?.toggleAttribute('hidden', !isFs);
      });
    }
  }

  // Interactive Floor Plan minimap hotspots
  document.querySelectorAll('[data-plan-jump]').forEach((el) => {
    el.addEventListener('click', () => selectPreset(el.dataset.planJump));
  });

  // Clickable gravestones & exterior memorial tablets: smooth zoom directly facing the carved inscription
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const pickRoots = [...memorialGroups, wallsGroup];
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let pointerActive = false;

  function findMemorialGroup(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData?.memorialFocus) return cur;
      cur = cur.parent;
    }
    return null;
  }

  function pickMemorialAtEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(pickRoots, true);
    if (hits.length === 0) return null;
    return findMemorialGroup(hits[0].object);
  }

  function focusMemorial(memorialGroup) {
    const { localTarget, localCam } = memorialGroup.userData.memorialFocus;
    memorialGroup.updateWorldMatrix(true, false);
    const worldTarget = memorialGroup.localToWorld(new THREE.Vector3(...localTarget));
    const worldCam = memorialGroup.localToWorld(new THREE.Vector3(...localCam));
    state.activePreset = null;
    document.querySelectorAll('[data-preset]').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
    });
    if (controller.getMode() === 'walk') setWalkMode(false);
    controller.focusOn(worldCam, worldTarget);
  }

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
    pointerActive = true;
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons !== 0 || controller.getMode() === 'walk') {
      renderer.domElement.style.cursor = '';
      return;
    }
    const hit = pickMemorialAtEvent(e);
    renderer.domElement.style.cursor = hit ? 'pointer' : '';
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!pointerActive || e.button !== 0) return;
    pointerActive = false;
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    const elapsedMs = performance.now() - downTime;
    if (dist >= 6 || elapsedMs >= 450) return;
    const memorial = pickMemorialAtEvent(e);
    if (memorial) focusMemorial(memorial);
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyC') setCutaway(!state.cutaway);
    else if (e.code === 'KeyO') setDoorsOpen(!state.doorsOpen);
    else if (e.code === 'KeyF') setWalkMode(controller.getMode() !== 'walk');
    else if (e.code === 'KeyM') setSoundMuted(!churchAudio.isMuted());
    else if (e.code === 'KeyT') toggleChurchTour();
    else if (e.code === 'Escape' && controller.isTouring()) controller.stopTour(false);
    else if (e.code === 'KeyR') selectPreset('exterior-nw');
  });

  // ResizeObserver keeps canvas sharp in both embedded and fullscreen modes
  function handleResize() {
    const w = Math.max(stage.clientWidth, 1);
    const h = Math.max(stage.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(handleResize);
    ro.observe(stage);
  }
  window.addEventListener('resize', handleResize);

  // Live 1974 Sketch Plan camera marker (East=Up, North=Left)
  const camMarker = document.getElementById('miniplan-camera');
  const tmpDir = new THREE.Vector3();

  function updateMiniPlan() {
    if (!camMarker) return;
    const svgX = 64 + camera.position.z * 6.4;
    const svgY = 92 - camera.position.x * 6.8;
    const clampedX = THREE.MathUtils.clamp(svgX, 8, 112);
    const clampedY = THREE.MathUtils.clamp(svgY, 8, 162);

    camera.getWorldDirection(tmpDir);
    const deg = (Math.atan2(-tmpDir.x, tmpDir.z) * 180) / Math.PI + 90;
    camMarker.setAttribute(
      'transform',
      `translate(${clampedX.toFixed(1)}, ${clampedY.toFixed(1)}) rotate(${deg.toFixed(1)})`
    );
  }

  applyLighting('autumn');
  if (statusEl) statusEl.hidden = true;
  stage.dataset.state = 'ready';

  const clock = new THREE.Clock();
  let elapsed = 0;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    const targetDoor = state.doorsOpen ? 1 : 0;
    state.doorAnim = THREE.MathUtils.lerp(state.doorAnim, targetDoor, Math.min(1, dt * 4.5));
    if (doorPivots.gateLeft) doorPivots.gateLeft.rotation.y = state.doorAnim * 1.45;
    if (doorPivots.gateRight) doorPivots.gateRight.rotation.y = -state.doorAnim * 1.45;
    if (doorPivots.mainDoor) doorPivots.mainDoor.rotation.y = -state.doorAnim * 1.55;
    sky.material.uniforms.uTime.value = elapsed;
    atmosphere.update(elapsed);
    candleEffect.update(elapsed);
    if (christmasEffect) christmasEffect.update(elapsed);

    controller.update(dt);
    churchAudio.updateSpatial(camera.position, state.doorsOpen);
    updateMiniPlan();
    renderer.render(scene, camera);
  }

  animate();
}
