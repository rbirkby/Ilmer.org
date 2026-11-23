import * as THREE from 'three';
import { createMaterials, createPlainGlazingMaterial } from '/assets/js/st-peters-3d/textures.js';
import { buildArchitecture } from '/assets/js/st-peters-3d/architecture.js';
import { buildInterior } from '/assets/js/st-peters-3d/interior.js';
import { buildChurchyard, createSkyDome } from '/assets/js/st-peters-3d/churchyard.js';
import { buildAtmosphere } from '/assets/js/st-peters-3d/atmosphere.js';
import { createChurchAudio } from '/assets/js/st-peters-3d/audio.js';
import '/assets/js/st-peters-3d/walk-joystick.js';
import { BELL_NOMINAL_HZ, createBellRinger } from '/assets/js/st-peters-3d/belfry.js';
import { CHURCH_TOUR_WAYPOINTS, DIM } from '/assets/js/st-peters-3d/dimensions.js';
import { CAMERA_PRESETS, createCameraController } from '/assets/js/st-peters-3d/controls.js';
import { findAnimatedObjects, mergeStaticMeshes } from '/assets/js/st-peters-3d/static-merge.js';
import { createFader } from '/assets/js/st-peters-3d/fade.js';
import '/assets/js/st-peters-3d/stats-overlay.js';

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
  renderer.localClippingEnabled = true; // the bell ropes' spare length is clipped at the ceiling
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Performance switches for comparing before & after: ?stats shows the overlay, &nomerge keeps every mesh
  // separate, &liveshadows redraws the sun's shadow map every frame as before
  const perfParams = new URLSearchParams(window.location.search);
  // The sun & nearly everything it lights stand still, so its 4096² shadow map (a second pass over ~1,800 casters)
  // is drawn only when something it can see changes: mood, era, cutaway, doors or bells moving
  renderer.shadowMap.autoUpdate = perfParams.has('liveshadows');
  let shadowsDirty = true;
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
  // The shadow box must take in the outermost churchyard trees (~27m out, up to 10.5m tall) and the ground their
  // shadows fall on, or each shadow is sliced off along the box's edge. 4096 texels keep the old ~2cm per texel.
  sunLight.shadow.mapSize.set(4096, 4096);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 95;
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xd4e6fa, 0.45);
  fillLight.position.set(14, 12, -16);
  scene.add(fillLight);

  // Build Church, Churchyard & Cinematic Stained-Glass Atmosphere
  const mats = createMaterials(renderer);
  const { wallsGroup, roofGroup, doorPivots } = buildArchitecture(mats);
  const { interiorGroup, ceilingGroup, chandelierLights, oilLights, causticMesh, candleEffect, organAnimator } =
    buildInterior(mats);
  const {
    group: churchyardGroup,
    christmasEffect,
    memorialGroups,
    gravestoneEra,
    kissingGates
  } = buildChurchyard(mats);
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
    // On the tour the porch gates & the inner door stay shut until the camera nears each one, then swing open in view
    doorsOnApproach: false,
    gatesTriggered: false,
    gateAnim: 0,
    mainDoorAnim: 0,
    lighting: 'autumn',
    era: 'today',
    activePreset: 'exterior-nw',
    ringBellsAt: null // elapsed time at which the tour sets the bells ringing
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
    shadowsDirty = true;
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

    // 1900 paraffin lamps: dimmer & warmer than today's electric pendants
    oilLights.forEach((lt) => {
      lt.userData.baseIntensity ??= lt.intensity;
      lt.userData.moodIntensity = lt.userData.baseIntensity * m.chandelierScale;
      lt.intensity = lt.userData.moodIntensity; // candleEffect flickers it around this level
    });
    chandelierLights.forEach((lt, idx) => {
      // Last light is the soft sanctuary highlight; the rest are pendant lamps
      lt.intensity = (idx === chandelierLights.length - 1 ? 1.35 : 1.75) * m.chandelierScale;
    });
    mats.glassShade.emissiveIntensity = moodKey === 'evensong' ? 1.55 : 0.7;
    mats.glassEast.emissiveIntensity = m.glassGlow;
    mats.glassSower.emissiveIntensity = m.glassGlow * 1.1;
    mats.glassNorthNave.emissiveIntensity = m.glassGlow * 0.95;
    mats.glassClear.emissiveIntensity = m.glassGlow * 0.65;
    causticMesh.material.opacity = m.causticOp;
    syncPlainGlass();
    atmosphere.setMood(moodKey);
    candleEffect.setMood(moodKey);
    if (christmasEffect) christmasEffect.setMood(moodKey);

    document.querySelectorAll('[data-lighting]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lighting === moodKey));
    });
  }

  // Today / 1900: objects tagged userData.era = 'today' or '1900' show only in their own era. In 1900 the
  // stained-glass windows are plainly glazed, the West end is half-hipped (its hip clips the clay roof slopes),
  // and the bells are chimed by hammers rather than swung.
  const eraObjects = [];
  const stainedGlass = [];
  const halfHipClipped = [];
  const wideBoarded = [];
  scene.traverse((o) => {
    if (o.userData.era) eraObjects.push(o);
    if (o.userData.wideBoards1900) wideBoarded.push(o);
    if (o.userData.clipIn1900) halfHipClipped.push(o);
    if (o.userData.stainedGlass) {
      o.userData.stainedMat = o.material;
      stainedGlass.push(o);
    }
  });
  const halfHipClip = roofGroup.userData.halfHipClipPlane;
  mats.clayRoof.clipShadows = true;

  function syncPlainGlass() {
    for (const g of stainedGlass) {
      if (g.material !== g.userData.stainedMat) {
        g.material.emissiveIntensity = g.userData.stainedMat.emissiveIntensity * 0.75;
      }
    }
  }

  // Features fade in & out over half a second when the era or the cutaway changes (fade.js)
  const fader = createFader();

  function setEra(era, instant = false) {
    state.era = era;
    shadowsDirty = true;
    for (const o of eraObjects) fader.setVisible(o, o.userData.era === era, instant);
    // Glazing, the half-hip cut and the belfry boards can't fade, so they change half way, as the features cross over
    fader.atMidpoint('era', () => applyEraMaterials(era), instant);
    bellRinger.setMode(era === '1900' ? 'chime' : 'swing');
    gravestoneEra.setEra(era); // C14 rights itself for 1900 and topples again for today
    for (const part of bellRopeParts) part.position.y = part.userData.bellRope.baseY;
    const btn = document.getElementById('btn-era');
    if (btn) {
      btn.setAttribute('aria-pressed', String(era === '1900'));
      btn.textContent = era === '1900' ? 'Year: 1900' : 'Year: Today';
    }
  }

  function applyEraMaterials(era) {
    for (const g of stainedGlass) {
      g.material = era === '1900' ? createPlainGlazingMaterial(g.userData.stainedMat) : g.userData.stainedMat;
    }
    syncPlainGlass();
    for (const mat of [mats.clayRoof, ...halfHipClipped.map((o) => o.material)]) {
      mat.clippingPlanes = era === '1900' && halfHipClip ? [halfHipClip] : [];
      mat.needsUpdate = true;
    }
    // 1900 belfry boarding: twice-deep boards, keeping the wall's solid-cut material settings
    for (const o of wideBoarded) {
      o.userData.todayMat ??= o.material;
      if (!o.userData.wideMat) {
        const today = o.userData.todayMat;
        const wide = mats.weatherboardWide.clone();
        wide.side = today.side;
        wide.shadowSide = today.shadowSide;
        wide.onBeforeCompile = today.onBeforeCompile;
        wide.customProgramCacheKey = today.customProgramCacheKey;
        o.userData.wideMat = wide;
      }
      o.material = era === '1900' ? o.userData.wideMat : o.userData.todayMat;
    }
  }

  function setCutaway(enabled) {
    state.cutaway = enabled;
    shadowsDirty = true;
    for (const g of [roofGroup, ceilingGroup, atmosphere.group]) fader.setVisible(g, !enabled);
    const btn = document.getElementById('btn-cutaway');
    if (btn) btn.setAttribute('aria-pressed', String(enabled));
  }

  function setDoorsOpen(open) {
    state.doorsOpen = open;
    state.doorsOnApproach = false;
    if (!open) state.gatesTriggered = false;
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
    const joystick = document.getElementById('walk-joystick');
    if (btn) {
      btn.setAttribute('aria-pressed', String(isWalk));
      btn.textContent = isWalk ? 'Mode: Walk' : 'Mode: Orbit';
    }
    if (hint) hint.hidden = !isWalk;
    // On-screen thumb stick for touch screens (CSS only shows it where the main pointer is coarse)
    if (joystick) joystick.hidden = !isWalk;
    if (!isWalk) controller.setMoveInput(0, 0);
  }

  document.getElementById('walk-joystick')?.addEventListener('joystickmove', (e) => {
    controller.setMoveInput(e.detail.x, e.detail.y);
  });

  // Inside the nave (East of the vestry partition) or the chancel, at standing height, the view switches to Walk
  // mode: when the camera comes in from outside, or lands there from a viewpoint button. Choosing Orbit again
  // while inside (or focusing on a memorial) is left alone until the camera next leaves and comes back.
  let wasInside = null;
  let presetLanding = false;
  function inNaveOrChancel(p) {
    if (p.y > 3.0) return false;
    const N = DIM.nave;
    const C = DIM.chancel;
    const inNave = p.x > DIM.tower.vestryPartitionX && p.x < N.xEastInt && Math.abs(p.z) < N.zSouthInt;
    const inChancel = p.x >= C.xWestInt && p.x < C.xEastInt && Math.abs(p.z) < C.zSouthInt;
    return inNave || inChancel;
  }
  function autoWalkIndoors() {
    if (controller.isBusy()) return;
    const inside = inNaveOrChancel(camera.position);
    if (inside && controller.getMode() === 'orbit' && (wasInside === false || presetLanding)) setWalkMode(true);
    wasInside = inside;
    presetLanding = false;
  }

  const presetBar = document.getElementById('preset-bar');
  const presetsToggleBtn = document.getElementById('btn-presets-toggle');

  function setPresetsExpanded(expanded) {
    if (!presetBar || !presetsToggleBtn) return;
    presetBar.classList.toggle('is-expanded', expanded);
    presetsToggleBtn.setAttribute('aria-expanded', String(expanded));
    const activeBtn = document.querySelector(`[data-preset="${state.activePreset}"]`);
    const activeLabel = activeBtn ? activeBtn.textContent.trim() : 'Select';
    presetsToggleBtn.textContent = `Views: ${activeLabel} ${expanded ? '▴' : '▾'}`;
  }

  presetsToggleBtn?.addEventListener('click', () => {
    const isExp = presetBar?.classList.contains('is-expanded');
    setPresetsExpanded(!isExp);
  });

  function selectPreset(key) {
    if (!CAMERA_PRESETS[key]) return;
    state.activePreset = key;
    document.querySelectorAll('[data-preset]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.preset === key));
    });
    setPresetsExpanded(false);
    controller.goToPreset(key, (meta) => {
      setCutaway(Boolean(meta.cutaway));
      if (meta.doorsOpen) setDoorsOpen(true);
      setWalkMode(false);
    });
    presetLanding = true;
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
    setPresetsExpanded(false);
    setWalkMode(false);
    setCutaway(false);
    controller.startTour(CHURCH_TOUR_WAYPOINTS, {
      onStep(wp) {
        if (typeof wp.cutaway === 'boolean') setCutaway(wp.cutaway);
        if (wp.doorsOpen === 'approach') {
          if (!state.doorsOpen) state.doorsOnApproach = true;
        } else if (typeof wp.doorsOpen === 'boolean') setDoorsOpen(wp.doorsOpen);
        if (typeof wp.ringBells === 'number') state.ringBellsAt = elapsed + wp.ringBells;
        setTourUI(true, wp.label);
      },
      onEnd(completed) {
        state.doorsOnApproach = false;
        state.gatesTriggered = state.doorsOpen;
        setTourUI(false);
        if (completed) {
          state.activePreset = 'exterior-nw';
          document.querySelectorAll('[data-preset]').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.preset === 'exterior-nw'));
          });
          setPresetsExpanded(false);
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

  document.getElementById('btn-era')?.addEventListener('click', () => {
    setEra(state.era === '1900' ? 'today' : '1900');
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
  let isPseudoFullscreen = false;

  function getNativeFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function syncFullscreenUI() {
    if (!fsBtn) return;
    const isFs = getNativeFullscreenElement() === stageWrapper || isPseudoFullscreen;
    fsBtn.setAttribute('aria-pressed', String(isFs));
    const label = isFs ? 'Exit fullscreen' : 'Enter fullscreen';
    fsBtn.setAttribute('aria-label', label);
    fsBtn.title = label;
    const fsEnterIcon = fsBtn.querySelector('[data-icon="fs-enter"]');
    const fsExitIcon = fsBtn.querySelector('[data-icon="fs-exit"]');
    fsEnterIcon?.toggleAttribute('hidden', isFs);
    fsExitIcon?.toggleAttribute('hidden', !isFs);
  }

  function setPseudoFullscreen(enabled) {
    isPseudoFullscreen = Boolean(enabled);
    stageWrapper.classList.toggle('is-pseudo-fullscreen', isPseudoFullscreen);
    document.body.classList.toggle('st-peters-fs-lock', isPseudoFullscreen);
    syncFullscreenUI();
    handleResize();
  }

  if (fsBtn) {
    const canNativeFs = Boolean(
      (document.fullscreenEnabled && stageWrapper.requestFullscreen) ||
      (document.webkitFullscreenEnabled && stageWrapper.webkitRequestFullscreen)
    );

    fsBtn.addEventListener('click', () => {
      const nativeEl = getNativeFullscreenElement();
      if (nativeEl || isPseudoFullscreen) {
        if (nativeEl) {
          const exitFn = document.exitFullscreen || document.webkitExitFullscreen;
          if (exitFn) exitFn.call(document).catch?.(() => setPseudoFullscreen(false));
        }
        if (isPseudoFullscreen) {
          setPseudoFullscreen(false);
        }
        return;
      }

      if (canNativeFs) {
        const reqFn = stageWrapper.requestFullscreen || stageWrapper.webkitRequestFullscreen;
        const fallbackTimer = window.setTimeout(() => {
          if (!getNativeFullscreenElement() && !isPseudoFullscreen) {
            setPseudoFullscreen(true);
          }
        }, 120);
        try {
          const res = reqFn.call(stageWrapper);
          if (res && typeof res.then === 'function') {
            res.then(
              () => {
                window.clearTimeout(fallbackTimer);
                if (!getNativeFullscreenElement()) setPseudoFullscreen(true);
              },
              () => {
                window.clearTimeout(fallbackTimer);
                setPseudoFullscreen(true);
              }
            );
          }
        } catch {
          window.clearTimeout(fallbackTimer);
          setPseudoFullscreen(true);
        }
      } else {
        // Fallback for iPhone Safari where native Fullscreen API is unavailable on non-video elements
        setPseudoFullscreen(true);
      }
    });

    document.addEventListener('fullscreenchange', syncFullscreenUI);
    document.addEventListener('webkitfullscreenchange', syncFullscreenUI);
  }

  // Interactive Floor Plan minimap hotspots
  document.querySelectorAll('[data-plan-jump]').forEach((el) => {
    el.addEventListener('click', () => selectPreset(el.dataset.planJump));
  });

  // The three bells: click one (or reach them on the tour) to swing-chime two rounds. Each wheel draws its rope
  // up and lets it back as the bell swings, so the falls & tails in the vestry rise and drop in step.
  const bellRinger = createBellRinger(wallsGroup, interiorGroup); // interior: the 1900 vestry chiming cords
  const bellRopeParts = [];
  const bellRopeGroups = [];
  interiorGroup.traverse((o) => {
    if (o.userData.bellRope) bellRopeParts.push(o);
    if (o.userData.ringsBells) bellRopeGroups.push(o);
  });
  const towerCentre = new THREE.Vector3(
    DIM.tower.xCenter,
    (DIM.tower.baseY + DIM.tower.eavesY) * 0.5,
    DIM.tower.zCenter
  );

  function ringBells() {
    const ringStart = elapsed;
    const strikes = bellRinger.ring(ringStart);
    if (strikes.length === 0 || churchAudio.isMuted()) return;
    // Louder up in the belfry, carrying well across the churchyard
    const level = 0.32 / (1 + camera.position.distanceTo(towerCentre) / 9);
    churchAudio.start().then((ok) => {
      if (!ok) return;
      const late = elapsed - ringStart;
      strikes.forEach((s) => churchAudio.playBell(BELL_NOMINAL_HZ[s.bell.number], s.delay - late, level));
    });
  }

  function updateBells() {
    if (state.ringBellsAt !== null && elapsed >= state.ringBellsAt) {
      state.ringBellsAt = null;
      ringBells();
    }
    bellRinger.update(elapsed);
    for (const h of bellRinger.bells) {
      const rise = h.userData.wheelR * h.rotation.x; // rope drawn up through the ceiling as the wheel turns
      for (const part of bellRopeParts) {
        const r = part.userData.bellRope;
        if (r.bell === h.userData.bell.name) part.position.y = r.baseY + rise;
      }
    }
  }

  function findBell(obj) {
    let cur = obj;
    while (cur) {
      if ((cur.userData?.bell && cur.userData?.clapper) || cur.userData?.ringsBells) return cur;
      cur = cur.parent;
    }
    return null;
  }

  // Clickable gravestones & exterior memorial tablets: smooth zoom directly facing the carved inscription
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  // Hymn number cards (one board per era): clicking a card plays its hymn on the organ
  const hymnBoards = [];
  interiorGroup.traverse((o) => {
    if (o.userData.hymnNumber) hymnBoards.push(o);
  });
  const pickRoots = [...memorialGroups, wallsGroup, ...bellRopeGroups, ...hymnBoards];
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let pointerActive = false;

  function isShown(obj) {
    for (let cur = obj; cur; cur = cur.parent) if (!cur.visible) return false;
    return true;
  }

  function findHymnBoard(obj) {
    for (let cur = obj; cur; cur = cur.parent) if (cur.userData?.hymnNumber) return cur;
    return null;
  }

  // Unmute if need be (the click unlocks the audio), then play the hymn on the organ
  function playHymn(number) {
    if (churchAudio.isMuted()) setSoundMuted(false);
    churchAudio.start().then((ok) => {
      if (ok) churchAudio.playHymn(number);
    });
  }

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
    // Raycasting ignores visibility: skip whatever is hidden (other era, cutaway roof...), but keep invisible
    // click targets whose parent is shown
    const hit = raycaster.intersectObjects(pickRoots, true).find((h) => isShown(h.object.parent));
    if (!hit) return null;
    return findMemorialGroup(hit.object) || findBell(hit.object) || findHymnBoard(hit.object);
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
    // Hand cursor over anything clickable (gravestones, bells, hymn board), in Orbit and Walk mode alike
    if (e.buttons !== 0) {
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
    const picked = pickMemorialAtEvent(e);
    if (picked?.userData.bell || picked?.userData.ringsBells) ringBells();
    else if (picked?.userData.hymnNumber) playHymn(picked.userData.hymnNumber);
    else if (picked) focusMemorial(picked);
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
    else if (e.code === 'Escape' && isPseudoFullscreen) setPseudoFullscreen(false);
    else if (e.code === 'Escape' && controller.isTouring()) controller.stopTour(false);
    else if (e.code === 'KeyR') selectPreset('exterior-nw');
    else if (e.code === 'KeyY') setEra(state.era === '1900' ? 'today' : '1900');
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

  // Bake static meshes together: ~4,000 draw calls down to a few hundred. Whatever an animation moves (found by
  // running the animators once), the doors and anything tagged in userData stay as their own groups.
  let mergeInfo = 'off';
  if (!perfParams.has('nomerge')) {
    const mergeRoots = [wallsGroup, roofGroup, interiorGroup, ceilingGroup, churchyardGroup];
    const allKeys = new Set(Array.from({ length: 128 }, (_, i) => i));
    const dynamic = findAnimatedObjects(
      mergeRoots,
      (checkpoint) => {
        organAnimator.update(5, true, { manual: allKeys, pedal: allKeys });
        checkpoint();
        candleEffect.update(1.7);
        checkpoint();
        // Ring & chime a full round in small steps, checking poses at each: hammers & clappers strike and fall back
        for (const mode of ['swing', 'chime']) {
          bellRinger.setMode(mode);
          bellRinger.ring(0);
          for (let t = 0.1; t < 12; t += 0.1) {
            bellRinger.update(t);
            checkpoint();
          }
        }
      },
      () => {
        organAnimator.update(5, false, null);
        bellRinger.setMode('swing');
      }
    );
    for (const pivot of Object.values(doorPivots)) if (pivot) dynamic.add(pivot);
    const counts = mergeStaticMeshes(mergeRoots, { dynamic });
    mergeInfo = `${counts.before}→${counts.after}`;
  }

  // Things that move and cast shadows: while any of them moves the shadow map is redrawn
  const shadowMovers = [...Object.values(doorPivots), ...bellRopeParts];
  for (const h of bellRinger.bells) shadowMovers.push(h, h.userData.clapper, h.userData.hammer);
  const moverPose = shadowMovers.filter(Boolean).map((o) => ({ o, q: o.quaternion.clone(), y: o.position.y }));
  function shadowMoversMoved() {
    let moved = false;
    for (const p of moverPose) {
      if (p.o.position.y !== p.y || !p.o.quaternion.equals(p.q)) {
        p.y = p.o.position.y;
        p.q.copy(p.o.quaternion);
        moved = true;
      }
    }
    return moved;
  }

  let stats = null;
  if (perfParams.has('stats')) {
    stats = document.createElement('st-scene-stats');
    stage.append(stats);
    stats.setInfo({
      load: `${(performance.now() / 1000).toFixed(1)} s`,
      meshes: mergeInfo,
      shadows: renderer.shadowMap.autoUpdate ? 'live' : 'on change'
    });
  }

  setEra('today', true);
  applyLighting('autumn');
  if (statusEl) statusEl.hidden = true;
  stage.dataset.state = 'ready';

  const clock = new THREE.Clock();
  let elapsed = 0;
  function animate() {
    requestAnimationFrame(animate);
    const frameStart = performance.now();
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    // Tour approach: open the porch gates, then the inner door, once the camera is a few strides from each
    if (state.doorsOnApproach && Math.abs(camera.position.x - DIM.porch.xCenter) < 2.5) {
      const z = camera.position.z;
      if (!state.gatesTriggered && z > DIM.porch.zNorthExt - 3.2) state.gatesTriggered = true;
      if (z > DIM.porch.zSouth - 2.8) setDoorsOpen(true);
    }
    const approachRate = state.doorsOnApproach || state.gatesTriggered ? 2.4 : 4.5;
    const gateTarget = state.doorsOpen || state.gatesTriggered ? 1 : 0;
    const doorTarget = state.doorsOpen ? 1 : 0;
    state.gateAnim = THREE.MathUtils.lerp(state.gateAnim, gateTarget, Math.min(1, dt * approachRate));
    state.mainDoorAnim = THREE.MathUtils.lerp(state.mainDoorAnim, doorTarget, Math.min(1, dt * approachRate));
    if (doorPivots.gateLeft) doorPivots.gateLeft.rotation.y = state.gateAnim * 1.45;
    if (doorPivots.gateRight) doorPivots.gateRight.rotation.y = -state.gateAnim * 1.45;
    if (doorPivots.mainDoor) doorPivots.mainDoor.rotation.y = -state.mainDoorAnim * 1.55;
    sky.material.uniforms.uTime.value = elapsed;
    atmosphere.update(elapsed);
    candleEffect.update(elapsed);
    if (christmasEffect) christmasEffect.update(elapsed);

    updateBells();
    controller.update(dt);
    autoWalkIndoors();
    if (gravestoneEra.update(dt)) shadowsDirty = true;
    if (kissingGates.update(dt, camera.position)) shadowsDirty = true; // leaves swing for the walker
    churchAudio.updateSpatial(camera.position, state.doorsOpen);
    // Console follows the organ voluntary: tambour open and keys/pedals moving only while it plays
    organAnimator.update(dt, churchAudio.isRunning(), churchAudio.getSoundingNotes());
    updateMiniPlan();
    if (fader.update(dt)) shadowsDirty = true;
    if (shadowMoversMoved() || shadowsDirty) {
      renderer.shadowMap.needsUpdate = true;
      shadowsDirty = false;
    }
    renderer.render(scene, camera);
    stats?.frame(renderer, performance.now() - frameStart);
  }

  animate();
}
