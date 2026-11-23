import * as THREE from 'three';
import { OrbitControls } from '/assets/vendor/three/OrbitControls.js';
import { getSurfaceY } from '/assets/js/st-peters-3d/dimensions.js';

export const CAMERA_PRESETS = {
  'exterior-nw': {
    label: 'Exterior NW',
    group: 'Exterior',
    pos: [-21.5, 6.8, -21.8],
    target: [-0.8, 8.4, 0.0],
    cutaway: false,
    doorsOpen: false
  },
  'exterior-north': {
    label: 'North Elevation',
    group: 'Exterior',
    pos: [0.2, 6.5, -24.5],
    target: [0.2, 7.8, 0.0],
    cutaway: false,
    doorsOpen: false
  },
  'exterior-south': {
    label: 'South Elevation',
    group: 'Exterior',
    pos: [0.2, 6.4, 24.5],
    target: [0.2, 7.8, 0.0],
    cutaway: false,
    doorsOpen: false
  },
  'exterior-east': {
    label: 'East Gable',
    group: 'Exterior',
    pos: [22.2, 5.8, -8.2],
    target: [3.6, 7.0, 0.0],
    cutaway: false,
    doorsOpen: false
  },
  'north-porch': {
    label: 'North Porch',
    group: 'Exterior',
    pos: [-1.85, 1.85, -9.2],
    target: [-1.85, 1.65, -3.2],
    cutaway: false,
    doorsOpen: true
  },
  'nave-east': {
    label: 'Nave → Chancel',
    group: 'Interior',
    pos: [-2.75, 1.72, 0.0],
    target: [6.8, 1.92, 0.0],
    cutaway: false,
    doorsOpen: false
  },
  'chancel-altar': {
    label: 'Chancel & Altar',
    group: 'Interior',
    pos: [4.25, 1.72, 0.0],
    target: [8.85, 1.72, 0.0],
    cutaway: false,
    doorsOpen: false
  },
  'nave-west': {
    label: 'Nave → Tower',
    group: 'Interior',
    pos: [1.85, 1.72, 0.0],
    target: [-6.6, 1.85, 0.0],
    cutaway: false,
    doorsOpen: true
  },
  'west-belfry': {
    label: 'Belfry & Vestry',
    group: 'Interior',
    pos: [-3.95, 1.68, -0.55],
    target: [-6.75, 2.35, 0.1],
    cutaway: false,
    doorsOpen: false
  },
  bells: {
    label: 'The Bells',
    group: 'Interior',
    pos: [-6.45, 7.6, 1.2],
    target: [-4.9, 5.5, -0.5],
    cutaway: false,
    doorsOpen: false
  },
  'south-wall': {
    label: 'Sower & Plaques',
    group: 'Interior',
    pos: [-0.25, 1.75, -1.55],
    target: [-0.15, 1.88, 2.6],
    cutaway: false,
    doorsOpen: false
  },
  'north-wall': {
    label: 'Jaques Window',
    group: 'Interior',
    pos: [0.5, 1.78, 1.45],
    target: [0.5, 1.92, -2.6],
    cutaway: false,
    doorsOpen: false
  },
  'cutaway-plan': {
    label: 'Floorplan Cutaway',
    group: 'Plan',
    pos: [0.8, 26.5, 9.5],
    target: [0.2, 0.5, 3.2],
    cutaway: true,
    doorsOpen: true
  }
};

// Walk pace in metres per second (Shift boost matches the ~2.3× ratio used by 1839 fly mode)
export const WALK_SPEED = 2.8;
export const WALK_SPEED_SPRINT = 6.4;

export function walkMoveSpeed(shiftHeld) {
  return shiftHeld ? WALK_SPEED_SPRINT : WALK_SPEED;
}

export function createCameraController(camera, domElement) {
  const orbit = new OrbitControls(camera, domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.07;
  orbit.maxPolarAngle = Math.PI * 0.72;
  orbit.minDistance = 0.42;
  orbit.maxDistance = 42;
  orbit.target.set(-0.8, 8.4, 0);

  let mode = 'orbit'; // 'orbit' | 'walk'
  let transition = null;
  let tour = null;

  const keys = new Set();
  let shiftHeld = false;
  let yaw = 0;
  let pitch = 0;
  let draggingLook = false;
  let lookPointerId = null;
  // Analog walk input from the on-screen joystick (x: right, y: forward, each -1..1)
  const stick = { x: 0, y: 0 };
  let lastMouseX = 0;
  let lastMouseY = 0;

  function clearMovementKeys() {
    keys.clear();
    shiftHeld = false;
  }

  function syncWalkAnglesFromCamera() {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    yaw = Math.atan2(-dir.x, -dir.z);
    pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -0.85, 0.85));
  }

  function stopTour(completed = false) {
    if (!tour) return;
    const cb = tour.onEnd;
    tour = null;
    if (cb) cb(completed);
  }

  // Evaluate a smooth C1 cubic Catmull-Rom segment between p1 and p2 with neighbor control points p0 and p3
  function evalCatmullRomVec3(out, p0, p1, p2, p3, t, tension = 0.42) {
    const t2 = t * t;
    const t3 = t2 * t;
    const s = (1 - tension) * 0.5;

    const m1x = (p2.x - p0.x) * s;
    const m1y = (p2.y - p0.y) * s;
    const m1z = (p2.z - p0.z) * s;
    const m2x = (p3.x - p1.x) * s;
    const m2y = (p3.y - p1.y) * s;
    const m2z = (p3.z - p1.z) * s;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    out.set(
      h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x,
      h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y,
      h00 * p1.z + h10 * m1z + h01 * p2.z + h11 * m2z
    );
  }

  function startTour(waypoints, { onStep, onEnd } = {}) {
    if (!waypoints || waypoints.length === 0) return;
    stopTour(false);
    if (mode === 'walk') {
      setMode('orbit');
    }
    transition = null;
    orbit.maxPolarAngle = Math.PI * 0.85;

    // Build control point arrays starting at the current camera position/target so the flight spline is C1-continuous
    const posNodes = [camera.position.clone(), ...waypoints.map((w) => new THREE.Vector3(...w.pos))];
    const targetNodes = [orbit.target.clone(), ...waypoints.map((w) => new THREE.Vector3(...w.target))];

    // If the camera is already very close to waypoint 0, skip straight to segment 1 so there is no initial pause
    const startIdx = posNodes[0].distanceTo(posNodes[1]) < 0.35 && waypoints.length > 1 ? 1 : 0;

    tour = {
      waypoints,
      posNodes,
      targetNodes,
      idx: startIdx,
      t: 0,
      onStep,
      onEnd
    };
    if (onStep) onStep(waypoints[startIdx], startIdx, waypoints.length);
  }

  function setMode(newMode) {
    if (newMode === mode) return;
    stopTour(false);
    mode = newMode;
    transition = null;
    if (mode === 'walk') {
      orbit.enabled = false;
      syncWalkAnglesFromCamera();
      if (camera.position.y > 3.2) {
        camera.position.set(-2.35, 1.68, -6.5);
        yaw = Math.PI;
        pitch = 0;
      }
    } else {
      orbit.enabled = true;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      orbit.target.copy(camera.position).addScaledVector(forward, 4.0);
    }
  }

  function goToPreset(presetKey, onPresetMeta) {
    const p = CAMERA_PRESETS[presetKey];
    if (!p) return;
    stopTour(false);
    if (mode === 'walk') {
      setMode('orbit');
    }
    if (onPresetMeta) onPresetMeta(p);
    transition = {
      startPos: camera.position.clone(),
      startTarget: orbit.target.clone(),
      endPos: new THREE.Vector3(...p.pos),
      endTarget: new THREE.Vector3(...p.target),
      t: 0,
      duration: 0.85
    };
    orbit.maxPolarAngle = p.group === 'Interior' ? Math.PI * 0.85 : Math.PI * 0.72;
  }

  function focusOn(endPos, endTarget, { duration = 0.85, maxPolarAngle = Math.PI * 0.72 } = {}) {
    stopTour(false);
    if (mode === 'walk') {
      setMode('orbit');
    }
    transition = {
      startPos: camera.position.clone(),
      startTarget: orbit.target.clone(),
      endPos: endPos.clone(),
      endTarget: endTarget.clone(),
      t: 0,
      duration
    };
    orbit.maxPolarAngle = maxPolarAngle;
  }

  const MIN_CAMERA_CLEARANCE = 0.35;
  const MIN_TARGET_CLEARANCE = 0.05;
  const clampOffset = new THREE.Vector3();

  function clampCameraAboveGround() {
    const minTargetY = getSurfaceY(orbit.target.x, orbit.target.z) + MIN_TARGET_CLEARANCE;
    if (orbit.target.y < minTargetY) {
      orbit.target.y = minTargetY;
    }

    const minCamY = getSurfaceY(camera.position.x, camera.position.z) + MIN_CAMERA_CLEARANCE;
    if (camera.position.y < minCamY) {
      if (mode === 'orbit') {
        clampOffset.subVectors(camera.position, orbit.target);
        const radius = clampOffset.length();
        const clampedDy = minCamY - orbit.target.y;
        if (Math.abs(clampedDy) < radius) {
          const horizTarget = Math.sqrt(radius * radius - clampedDy * clampedDy);
          const horizCur = Math.hypot(clampOffset.x, clampOffset.z);
          if (horizCur > 1e-4) {
            const scale = horizTarget / horizCur;
            clampOffset.x *= scale;
            clampOffset.z *= scale;
          }
          clampOffset.y = clampedDy;
          camera.position.copy(orbit.target).add(clampOffset);
        } else {
          camera.position.y = minCamY;
        }
        const adjustedMinY = getSurfaceY(camera.position.x, camera.position.z) + MIN_CAMERA_CLEARANCE;
        if (camera.position.y < adjustedMinY) {
          camera.position.y = adjustedMinY;
        }
        camera.lookAt(orbit.target);
      } else {
        camera.position.y = minCamY;
      }
    }
  }

  orbit.addEventListener('change', clampCameraAboveGround);

  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  window.addEventListener('keydown', (e) => {
    if (isEditableTarget(e.target)) return;
    if (mode === 'walk' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);
    // Match 1839 fly mode: treat Shift via key name, and pick up a held Shift even if its own
    // keydown was missed (e.g. pressed before the page had focus)
    if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.shiftKey) {
      shiftHeld = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      shiftHeld = false;
      keys.delete('ShiftLeft');
      keys.delete('ShiftRight');
    }
  });
  window.addEventListener('blur', clearMovementKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearMovementKeys();
  });

  domElement.addEventListener('pointerdown', (e) => {
    // Only one pointer steers the view, so a thumb on the joystick doesn't also turn the head
    if (mode === 'walk' && e.button === 0 && !draggingLook) {
      draggingLook = true;
      lookPointerId = e.pointerId;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    if (transition) transition = null;
    if (tour) stopTour(false);
  });
  domElement.addEventListener(
    'wheel',
    () => {
      if (tour) stopTour(false);
    },
    { passive: true }
  );
  window.addEventListener('pointermove', (e) => {
    if (!draggingLook || mode !== 'walk' || e.pointerId !== lookPointerId) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    yaw -= dx * 0.0038;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.0034, -1.25, 1.25);
  });
  const endLook = (e) => {
    if (e.pointerId !== lookPointerId) return;
    draggingLook = false;
    lookPointerId = null;
  };
  window.addEventListener('pointerup', endLook);
  window.addEventListener('pointercancel', endLook);

  function update(dt) {
    if (tour) {
      const n = tour.waypoints.length;
      const wp = tour.waypoints[tour.idx];
      // Combine move duration + a fraction of hold time into a single continuous glide segment (no dead stops!)
      const segDur = Math.max(0.5, (wp.duration ?? 2.4) + (wp.hold ?? 0) * 0.55);
      tour.t += dt / segDur;

      while (tour.t >= 1 && tour.idx < n - 1) {
        tour.t -= 1;
        tour.idx += 1;
        const nextWp = tour.waypoints[tour.idx];
        if (tour.onStep) tour.onStep(nextWp, tour.idx, n);
      }

      if (tour.idx >= n - 1 && tour.t >= 1) {
        camera.position.copy(tour.posNodes[n]);
        orbit.target.copy(tour.targetNodes[n]);
        orbit.maxPolarAngle = Math.PI * 0.72;
        stopTour(true);
        orbit.update();
        clampCameraAboveGround();
        return;
      }

      // Smooth continuous parameter u: ease in gently only at tour start, ease out gently only at tour end,
      // and keep continuous non-zero velocity through all intermediate waypoints
      const rawT = THREE.MathUtils.clamp(tour.t, 0, 1);
      let u = rawT;
      if (tour.idx === 0) {
        u = rawT * rawT * (2 - rawT); // Smooth start from rest
      } else if (tour.idx === n - 1) {
        u = 1 - (1 - rawT) * (1 - rawT); // Smooth landing at end
      }

      // Node index k in posNodes/targetNodes: segment `tour.idx` interpolates from node `k` to `k + 1`
      const k = tour.idx;
      const maxK = n;
      const p0 = tour.posNodes[Math.max(0, k - 1)];
      const p1 = tour.posNodes[k];
      const p2 = tour.posNodes[Math.min(maxK, k + 1)];
      const p3 = tour.posNodes[Math.min(maxK, k + 2)];

      const t0 = tour.targetNodes[Math.max(0, k - 1)];
      const t1 = tour.targetNodes[k];
      const t2 = tour.targetNodes[Math.min(maxK, k + 1)];
      const t3 = tour.targetNodes[Math.min(maxK, k + 2)];

      // Tighter tension along the North Porch doorway corridor so the camera tracks straight through the arch
      const isDoorCorridor = Math.abs(p1.x - -2.35) < 0.05 && Math.abs(p2.x - -2.35) < 0.05;
      evalCatmullRomVec3(camera.position, p0, p1, p2, p3, u, isDoorCorridor ? 0.78 : 0.45);
      evalCatmullRomVec3(orbit.target, t0, t1, t2, t3, u, 0.42);

      orbit.update();
      clampCameraAboveGround();
      return;
    }

    if (transition) {
      transition.t = Math.min(1, transition.t + dt / transition.duration);
      const s =
        transition.t < 0.5
          ? 4 * transition.t * transition.t * transition.t
          : 1 - Math.pow(-2 * transition.t + 2, 3) / 2;
      camera.position.lerpVectors(transition.startPos, transition.endPos, s);
      orbit.target.lerpVectors(transition.startTarget, transition.endTarget, s);
      if (transition.t >= 1) transition = null;
      orbit.update();
      clampCameraAboveGround();
      return;
    }

    if (mode === 'walk') {
      const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      const sprinting = shiftHeld || keys.has('ShiftLeft') || keys.has('ShiftRight');
      const moveSpeed = walkMoveSpeed(sprinting) * dt;
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

      if (keys.has('KeyW') || keys.has('ArrowUp')) camera.position.addScaledVector(forward, moveSpeed);
      if (keys.has('KeyS') || keys.has('ArrowDown')) camera.position.addScaledVector(forward, -moveSpeed);
      if (keys.has('KeyD') || keys.has('ArrowRight')) camera.position.addScaledVector(right, moveSpeed);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) camera.position.addScaledVector(right, -moveSpeed);
      // Joystick: walking pace for most of its travel, quickening towards a stride near the rim
      const push = Math.hypot(stick.x, stick.y);
      if (push > 0.08) {
        const pace = (push > 0.9 ? WALK_SPEED_SPRINT * 0.66 : WALK_SPEED) * dt;
        camera.position.addScaledVector(forward, stick.y * pace);
        camera.position.addScaledVector(right, stick.x * pace);
      }

      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -26, 26);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -24, 24);

      const targetY = getSurfaceY(camera.position.x, camera.position.z) + 1.62;
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, Math.min(1, dt * 10));
      clampCameraAboveGround();
    } else {
      const moveSpeed = 5.5 * dt;
      if (keys.has('KeyW') || keys.has('KeyS') || keys.has('KeyA') || keys.has('KeyD')) {
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        const delta = new THREE.Vector3();
        if (keys.has('KeyW')) delta.addScaledVector(fwd, moveSpeed);
        if (keys.has('KeyS')) delta.addScaledVector(fwd, -moveSpeed);
        if (keys.has('KeyD')) delta.addScaledVector(right, moveSpeed);
        if (keys.has('KeyA')) delta.addScaledVector(right, -moveSpeed);
        camera.position.add(delta);
        orbit.target.add(delta);
      }
      orbit.update();
      clampCameraAboveGround();
    }
  }

  return {
    orbit,
    getMode: () => mode,
    setMode,
    goToPreset,
    focusOn,
    startTour,
    stopTour,
    isTouring: () => Boolean(tour),
    // A tour or a glide to a viewpoint is moving the camera
    isBusy: () => Boolean(tour || transition),
    setMoveInput(x, y) {
      stick.x = x;
      stick.y = y;
    },
    update
  };
}
