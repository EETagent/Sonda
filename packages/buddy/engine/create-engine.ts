/** Animation state, frame rendering, and engine lifecycle. */
// Preserve the reference engine's short-circuit and comma expression evaluation order.
/* oxlint-disable no-unused-expressions */
import { createMorphRenderers, sendPeriod, receivePeriod } from "./morph-renderers.js";
import { eyeContours } from "./artwork.js";
import {
  circleRing,
  contourCentroid,
  contourSpanAt,
  interpolateContours,
  interpolateFaceFit,
  polygonPath,
  ringPath,
} from "./geometry.js";
import {
  bodyCenter,
  clampMotion,
  easeInOutCubic,
  frameIndependentBlend,
  randomBetween,
  smoothstep,
} from "./math.js";
import {
  baseEyeHeight,
  bodyMorphThreshold,
  eyeContourPadding,
  morphNames,
  morphRing,
  morphZoomScale,
  viewBoxCenter,
  viewBoxHalfWidth,
} from "./morphs.js";
import { createParticleSystem, particleTuning } from "./particles.js";
import { circleOutlinePath, shapeGeometry } from "./shapes.js";
import { createSpring, springSubstepCount, stepSpring } from "./springs.js";
import {
  bounceStages,
  cyclingMorphStates,
  morphDurations,
  morphRestDuration,
  spontaneousPlayStates,
  spontaneousSpinStates,
  stateBlinkIntervals,
  stateEyeContours,
  stateEyeIntervals,
  stateMorphs,
} from "./state-presets.js";
import type {
  BlinkEvent,
  BuddyAvatarState,
  BuddyEngine,
  BuddyEngineConfig,
  BuddyEngineNodes,
  MorphName,
  SpecialSpin,
  Spring,
} from "./types.js";

export function createBuddyEngine(nodes: BuddyEngineNodes, config: BuddyEngineConfig): BuddyEngine {
  const idPrefix = config.id;
  const window = nodes.svg.ownerDocument.defaultView;
  const _document = nodes.svg.ownerDocument;
  const performance = window!.performance;
  const requestAnimationFrame = (callback: FrameRequestCallback) =>
    window!.requestAnimationFrame(callback);
  const cancelAnimationFrame = (id: number) => window!.cancelAnimationFrame(id);
  let actions;
  let resume;
  const reducedMotion = config.reducedMotion;
  let currentEyeContours = [eyeContours[0][0], eyeContours[0][1]];
  let targetEyeContours = currentEyeContours;
  const eyeMorphSpring = createSpring(1);
  let eyeContourIndex = 0;
  const faceTurnSpring = createSpring(0);
  const faceTiltSpring = createSpring(0);
  const faceRollSpring = createSpring(0);
  const bodyScaleSpring = createSpring(1);
  const eyeOpenSpring = createSpring(1);
  const eyeSizeSpring = createSpring(1);
  const gazeXSpring = createSpring(0);
  const gazeYSpring = createSpring(0);
  let nextGazeAt = 0;
  let nextWinkAt = 0;
  let winkStartedAt = -1e9;
  let winkEye = 0;
  const shapeMorphSpring = createSpring(1);
  let previousShape = config.shape;
  let previousShapeRing = shapeGeometry[previousShape].ring;
  let previousFaceFit = shapeGeometry[previousShape].face;
  let previousTiltScale = shapeGeometry[previousShape].tiltScale;
  let previousBeltRadius = shapeGeometry[previousShape].beltRadius;

  shapeGeometry[previousShape].spanAt;
  shapeGeometry[previousShape].top;
  shapeGeometry[previousShape].bottom;

  let beltRadius = shapeGeometry[previousShape].beltRadius;
  const morphSpring = createSpring(0);
  const morphTransitionSpring = createSpring(1);
  let activeMorph: MorphName | null = null;
  let previousMorph: MorphName | null = null;
  let lastStateMorph: MorphName | null = null;
  let morphStartedAt = 0;
  let morphResting = !1;
  let morphRestStartedAt = 0;
  const morphTurnSpring = createSpring(0);
  let morphTurnTarget = 0;
  let morphTurnDirection = 1;
  let wasMorphing = !1;
  let morphAnimationStartedAt = -1e9;
  const morphHalfTurn = Math.PI;
  let previousState: BuddyAvatarState | null = null;
  let nextCelebrationAt = 0;
  let nextEyeContourAt = 0;
  let nextBlinkAt = 0;
  let nodEndsAt = 0;
  let nextNodAt = 0;
  let tt = 0;
  let stateEyeIndex = 0;
  let blinkQueue: BlinkEvent[] = [];
  let faceTurnOffset = 0;
  let nextStateAccentAt = 0;
  let nextStateJitterAt = 0;
  let Yt = -1;
  let continuousSpinAngle = 0;
  const hummingSpring = createSpring(0);
  const badgeSpring = createSpring(0);
  let Nn = 0;
  let lastFrameAt = performance.now();
  let animationFrameId = 0;
  const startedAt = performance.now();
  let cachedBounds: DOMRect | null = null;
  let boundsSampleAt = -1e9;
  const setEyeContour = (index: number, frequency: number = 7) => {
    if (index === eyeContourIndex && eyeMorphSpring.t === 1) return;
    const mt = Math.min(Math.max(eyeMorphSpring.x, 0), 1);

    currentEyeContours = [
      interpolateContours(currentEyeContours[0], targetEyeContours[0], mt),
      interpolateContours(currentEyeContours[1], targetEyeContours[1], mt),
    ];
    targetEyeContours = [eyeContours[index][0], eyeContours[index][1]];
    eyeContourIndex = index;
    eyeMorphSpring.x = 0;
    eyeMorphSpring.v = 0;
    eyeMorphSpring.t = 1;
    eyeMorphFrequency = frequency;
  };
  let eyeMorphFrequency = 7;
  let spinSpring: Spring | null = null;
  const pointerGaze = { x: 0, y: 0, tx: 0, ty: 0 };
  let emphasisBlend = 0;
  let frameDelta = 1 / 60;
  let particleSizeScale = 1;
  let avatarWidth = 380;
  let ds = "";
  let lastSizeSampleAt = 0;
  const updateSizeScale = (now: number) => {
    if (now - lastSizeSampleAt < 500 || !nodes.svg) return;
    lastSizeSampleAt = now;
    const Pt = nodes.svg.getBoundingClientRect().width;
    Pt > 0 &&
      ((particleSizeScale = clampMotion((340 / Pt) ** 0.7, 1, 1 + 1.6 * particleTuning.smallBoost)),
      (avatarWidth = Pt));
  };
  const blendForFrame = (factor: number) => frameIndependentBlend(factor, frameDelta);
  const startSpin = (turns: number = 1, direction: number = Math.random() < 0.5 ? 1 : -1) => {
    config.paused ||
      spinSpring ||
      (spinSpring = { x: 0, v: 0, t: turns * Math.PI * 2 * direction });
  };
  let nextReactionAt = startedAt + randomBetween(2500, 5e3);
  let wakeBurstEmitted = !1;
  const particles = createParticleSystem({
    back: nodes.back,
    front: nodes.front,
    idPrefix: idPrefix,
    reduceMotion: reducedMotion,
    radius: () => beltRadius,
  });
  let particleSpinAngle = 0;
  let lastBodyMorph = -1;
  let lastShapeMorph = -1;
  let lastTurnedOutline = !1;
  let lastRenderedShape: string | null = null;
  const bounceDuration = bounceStages.reduce((ze, Pt) => ze + Pt.d, 0);
  let bounceStartedAt = -1;
  let bounceOffsetY = 0;
  let Kr = 0;
  let yi = 0;
  let ki = 0;
  let Yr = 0;
  let Zr = 0;
  let wi = 0;
  const startBounce = () => {
    reducedMotion || bounceStartedAt >= 0 || config.paused || (bounceStartedAt = performance.now());
  };
  let specialSpin: SpecialSpin | null = null;
  let specialSpinAngle: number | null = null;
  const startSpecialSpin = (kind: SpecialSpin["kind"]) => {
    if (reducedMotion || specialSpin || config.paused) return;
    const Pt = Math.random() < 0.5 ? 1 : -1;
    const mt = kind === "spinDizzy" ? Math.round(randomBetween(3, 4)) : kind === "spinWild" ? 9 : 1;
    specialSpin = { kind: kind, t0: performance.now(), dir: Pt, turns: mt };
  };
  let reactionIndex = Math.floor(randomBetween(0, 5));
  let wideSpin = !1;
  const playNextReaction = () => {
    reducedMotion ||
      config.paused ||
      ((reactionIndex = (reactionIndex + 1) % 5),
      (wideSpin = !1),
      reactionIndex === 0
        ? startSpin(1)
        : reactionIndex === 1
          ? ((wideSpin = !0), startSpin(2))
          : reactionIndex === 2
            ? startSpecialSpin("spinBounce")
            : reactionIndex === 3
              ? startSpecialSpin("spinDizzy")
              : (startSpin(1), particles.burst(16, 0.95, 0.3)));
  };
  const scheduleBlink = (now: number) => {
    blinkQueue.push(
      { at: now, v: 0.05 },
      { at: now + 70, v: 0.05 },
      { at: now + 150, v: 1.08 },
      { at: now + 300, v: 1 },
    );
    Math.random() < 0.14 && blinkQueue.push({ at: now + 370, v: 0.05 }, { at: now + 480, v: 1 });
  };
  const updateStateMotion = (now: number) => {
    const state = config.state;
    const elapsed = (now - startedAt) / 1e3;
    const stateElapsed = (now - config.changedAt) / 1e3;
    if (
      (previousState !== state &&
        ((previousState = state),
        (stateEyeIndex = 0),
        (nextEyeContourAt = now + randomBetween(...stateEyeIntervals[state])),
        (nextBlinkAt = now + randomBetween(1500, 7e3)),
        (nextStateAccentAt =
          now +
          (state === "excited"
            ? randomBetween(400, 1100)
            : state === "searching"
              ? randomBetween(800, 1600)
              : state === "working"
                ? randomBetween(1200, 2400)
                : randomBetween(6e3, 1e4))),
        (nextStateJitterAt = now + randomBetween(500, 1200)),
        (nextNodAt = now + randomBetween(1200, 2200)),
        (tt = 0),
        (nextGazeAt = now + randomBetween(500, 1400)),
        (nextWinkAt = now + randomBetween(3e3, 8e3)),
        (Yt = -1),
        morphRenderers.reset(),
        (wakeBurstEmitted = !1),
        state === "celebrate" && (nextCelebrationAt = now + 140),
        state !== "waking" &&
          state !== "sleeping" &&
          (state !== "drowsy" && scheduleBlink(now),
          setEyeContour(stateEyeContours[state][0], state === "excited" ? 10 : 8))),
      state === "celebrate" &&
        !specialSpin &&
        now >= nextCelebrationAt &&
        (startSpecialSpin("spinWild"), (nextCelebrationAt = now + 6200)),
      now >= nextReactionAt)
    ) {
      const Et = spontaneousSpinStates.has(state);
      const En = spontaneousPlayStates.has(state);
      if ((Et || En) && !spinSpring && bounceStartedAt < 0 && !specialSpin) {
        const Zt = Math.random();
        Et
          ? Zt < 0.55
            ? startSpin(1)
            : startSpecialSpin("spinBounce")
          : Zt < 0.34
            ? startSpecialSpin("spinBounce")
            : Zt < 0.62
              ? startBounce()
              : Zt < 0.86
                ? startSpecialSpin("spinDizzy")
                : startSpin(1);
      }
      nextReactionAt = now + randomBetween(9e3, 18e3);
    }
    let eyeOpenness = 1;
    let eyeSize = 1;
    switch (state) {
      case "sleeping": {
        if (stateEyeContours.sleeping.includes(eyeContourIndex))
          eyeOpenness = eyeMorphSpring.x > 0.85 ? 1 : 0.08;
        else if (stateElapsed < 1.2) {
          const dn = Math.min(1, stateElapsed / 1);
          eyeOpenness = Math.max(0.08, 1 - dn * (1 + 0.15 * Math.sin(stateElapsed * 6.5)));
        } else {
          eyeOpenness = 0.08;
          eyeOpenSpring.x < 0.18 && setEyeContour(13, 11);
        }
        const En = Math.min(stateElapsed / 2, 1);
        const Zt = Math.sin(clampMotion(stateElapsed / 0.5, 0, 1) * Math.PI);

        faceTurnSpring.t = faceTurnOffset + 4 * En + Math.sin(elapsed * 0.25) * 2;
        faceTiltSpring.t = -2 * En;
        faceRollSpring.t = 8 * En + Math.sin(elapsed * 0.55) * 3 - Zt * 5;
        bodyScaleSpring.t = 1 + Math.sin(elapsed * 0.55) * 0.016 + Zt * 0.05;

        break;
      }
      case "waking": {
        if (stateElapsed < 0.5) {
          eyeOpenness = 0.07;
          setEyeContour(3, 12);
          faceRollSpring.t = 6;
        } else if (stateElapsed < 1.2) {
          eyeOpenness = 1;
          eyeSize = 1.12;
          faceRollSpring.t = -5;
          faceTiltSpring.t = 0;
          faceTurnSpring.t = faceTurnOffset;
          bodyScaleSpring.t = 1.04;
          wakeBurstEmitted || (particles.burst(randomBetween(9, 13), 0.8), (wakeBurstEmitted = !0));
        } else if (stateElapsed < 2.2) {
          blinkQueue.length === 0 && stateElapsed < 1.4 && scheduleBlink(now);
          setEyeContour(0);
          faceRollSpring.t = 0;
          bodyScaleSpring.t = 1;
        } else {
          const Et = Math.min((stateElapsed - 2.2) / 0.8, 1);

          setEyeContour(0);
          faceTurnSpring.t = faceTurnOffset + Math.sin(Et * Math.PI * 3) * 6 * (1 - Et);
          faceRollSpring.t = Math.sin(elapsed * 0.9) * 2;
        }
        break;
      }
      case "idle": {
        faceTurnSpring.t =
          faceTurnOffset + Math.sin(elapsed * 0.5) * 1.5 + Math.sin(elapsed * 0.17) * 0.6;
        faceTiltSpring.t = Math.sin(elapsed * 0.27) * 1;
        faceRollSpring.t = Math.sin(elapsed * 0.85) * 1.2;
        bodyScaleSpring.t = 1 + Math.sin(elapsed * 0.85) * 0.007;

        break;
      }
      case "listening": {
        if (
          ((faceTurnSpring.t = faceTurnOffset + 8 + Math.sin(elapsed * 0.5) * 1.5),
          (faceTiltSpring.t = 2),
          (faceRollSpring.t = -2 + Math.sin(elapsed * 0.8) * 0.8),
          (bodyScaleSpring.t = 1.015),
          now >= nextNodAt &&
            ((nodEndsAt = now + 380), (nextNodAt = now + randomBetween(1800, 3200))),
          now < nodEndsAt)
        ) {
          const Et = 1 - (nodEndsAt - now) / 380;

          faceRollSpring.t += Math.sin(Et * Math.PI) * 4.5;
          faceTurnSpring.t += Math.sin(Et * Math.PI) * 2;
        }
        break;
      }
      case "thinking": {
        faceTurnSpring.t = faceTurnOffset - 9 + Math.sin(elapsed * 0.35) * 5;
        faceTiltSpring.t = Math.sin(elapsed * 0.3) * 5;
        faceRollSpring.t = Math.sin(elapsed * 0.6) * 2.5;
        bodyScaleSpring.t = 1;

        break;
      }
      case "searching": {
        const Et = Math.sin(elapsed * 1.3);

        faceTurnSpring.t = faceTurnOffset + Et * 13;
        faceTiltSpring.t = Et * 7;
        faceRollSpring.t = Math.sin(elapsed * 1.7) * 3;
        bodyScaleSpring.t = 1;
        now >= nextStateAccentAt &&
          (startSpin(), (nextStateAccentAt = now + randomBetween(4e3, 7e3)));

        break;
      }
      case "working": {
        const Et = Math.sin(elapsed * Math.PI * 2 * 1.6);

        faceTurnSpring.t = faceTurnOffset + 4 + Et * 2.5;
        faceTiltSpring.t = 3;
        faceRollSpring.t = 1.5 + Math.max(0, Et) * 3;
        bodyScaleSpring.t = 1 - Math.max(0, Et) * 0.02;
        now >= nextStateAccentAt &&
          (startSpin(1, 1), (nextStateAccentAt = now + randomBetween(6e3, 9e3)));

        break;
      }
      case "excited": {
        const Et = (elapsed * 2.2) % 1;
        const En = Math.sin(Et * Math.PI);

        faceRollSpring.t = -En * 10 + 2;
        bodyScaleSpring.t = Et < 0.1 ? 0.92 : Et < 0.3 ? 1.05 : 1;
        faceTiltSpring.t = Math.sin(elapsed * 1.1) * 4;
        eyeSize = 1.06;
        now >= nextStateAccentAt &&
          (startSpin(1), (nextStateAccentAt = now + randomBetween(2800, 5e3)));
        faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * Math.PI * 2 * 1.1) * 7;

        break;
      }
      case "surprised": {
        const Et = Math.min(stateElapsed / 1.2, 1);

        faceTiltSpring.t = -4 * (1 - Et);
        faceRollSpring.t = -8 * (1 - Et);
        bodyScaleSpring.t = stateElapsed < 0.2 ? 1.08 : 1;
        eyeSize = 1.15 - Et * 0.08;
        faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * 11) * 1.5 * (1 - Et);

        break;
      }
      case "suspicious": {
        faceTurnSpring.t = faceTurnOffset - 6 + Math.sin(elapsed * 0.3) * 3;
        faceTiltSpring.t = Math.sin(elapsed * 0.25) * -4;
        faceRollSpring.t = 1 + Math.sin(elapsed * 0.45) * 1.2;
        bodyScaleSpring.t = 1;
        eyeOpenness = 0.85;
        now >= nextStateJitterAt &&
          ((faceTurnSpring.v += 30), (nextStateJitterAt = now + randomBetween(4e3, 7e3)));

        break;
      }
      case "angry": {
        now >= nextStateJitterAt &&
          ((Nn = now + 420),
          (faceRollSpring.v += 70),
          (nextStateJitterAt = now + randomBetween(1800, 3200)));
        faceTurnSpring.t = faceTurnOffset + (now < Nn ? Math.sin(now * 0.05) * 4.5 : 0);
        faceTiltSpring.t = 0;
        faceRollSpring.t = 3.5;
        bodyScaleSpring.t = 0.975;

        break;
      }
      case "drowsy": {
        if (
          ((faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * 0.32) * 2.5),
          (faceTiltSpring.t = Math.sin(elapsed * 0.2) * 1.5),
          (faceRollSpring.t = 6 + Math.sin(elapsed * 0.36) * 2.2),
          (bodyScaleSpring.t = 1 + Math.sin(elapsed * 0.36) * 0.022),
          (eyeOpenness = 0.34 + Math.sin(elapsed * 0.8) * 0.07),
          now >= nextNodAt && !tt && (tt = now),
          tt)
        ) {
          const En = (now - tt) / 1e3;
          const Zt = 1.7;
          const dn = 0.3;
          const on = 1.5;
          if (En < Zt) {
            const bn = En / Zt;
            const Cn = bn * bn;
            const bi = Math.sin(bn * Math.PI * 2.5) * 2.2 * (1 - bn);

            faceRollSpring.t = 6 + Cn * 19 + bi;
            faceTurnSpring.t = faceTurnOffset + Cn * 10;
            eyeOpenness = 0.34 - Cn * (0.34 - 0.04);
            bodyScaleSpring.t = 1 - Cn * 0.045;
          } else if (En < Zt + dn) {
            const bn = (En - Zt) / dn;
            const Cn = Math.sin(bn * Math.PI);

            faceRollSpring.t = 25 - Cn * 7;
            faceTurnSpring.t = faceTurnOffset + 10 - Cn * 4;
            eyeOpenness = 0.04 + Cn * 0.42;
          } else if (En < Zt + dn + on) {
            const bn = (En - Zt - dn) / on;
            const Cn = 1 - Math.pow(1 - bn, 2.2);

            faceRollSpring.t = 25 + -19 * Cn;
            faceTurnSpring.t = faceTurnOffset + 10 * (1 - Cn);
            eyeOpenness = 0.46 + (0.34 - 0.46) * Cn;
            bn > 0.32 && bn < 0.46 && (eyeOpenness = 0.05);
          } else {
            tt = 0;
            nextNodAt = now + randomBetween(1500, 3500);
          }
        }
        break;
      }
      case "happy": {
        const Et = Math.sin(elapsed * 2.4);

        faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * 1.2) * 3;
        faceTiltSpring.t = Math.sin(elapsed * 1.1) * 2.5;
        faceRollSpring.t = -Math.abs(Et) * 3;
        bodyScaleSpring.t = 1 + Et * 0.02;
        eyeSize = 1.05;

        break;
      }
      case "curious": {
        if (
          ((faceTurnSpring.t = faceTurnOffset + 10 + Math.sin(elapsed * 0.7) * 6),
          (faceTiltSpring.t = Math.sin(elapsed * 0.6) * 5),
          (faceRollSpring.t = -2 + Math.sin(elapsed * 0.9) * 1.5),
          (bodyScaleSpring.t = 1.01),
          (eyeSize = 1.08),
          now >= nextNodAt &&
            ((nodEndsAt = now + 440), (nextNodAt = now + randomBetween(1600, 2800))),
          now < nodEndsAt)
        ) {
          const Et = 1 - (nodEndsAt - now) / 440;

          faceTiltSpring.t += Math.sin(Et * Math.PI) * 8;
          faceTurnSpring.t += Math.sin(Et * Math.PI) * 5;
        }
        break;
      }
      case "confused": {
        const Et = Math.sin(elapsed * 0.8);

        faceTurnSpring.t = faceTurnOffset + Et * 12;
        faceTiltSpring.t = Et * 3;
        faceRollSpring.t = Math.sin(elapsed * 0.5) * 2;
        bodyScaleSpring.t = 1;
        eyeOpenness = 0.9;
        now >= nextStateJitterAt &&
          ((faceTurnSpring.v += 22), (nextStateJitterAt = now + randomBetween(2600, 4200)));

        break;
      }
      case "bored": {
        if (
          ((faceTurnSpring.t = faceTurnOffset - 3 + Math.sin(elapsed * 0.25) * 4),
          (faceTiltSpring.t = Math.sin(elapsed * 0.2) * 4),
          (faceRollSpring.t = 5 + Math.sin(elapsed * 0.35) * 1.5),
          (bodyScaleSpring.t = 0.99),
          (eyeOpenness = 0.6),
          (eyeSize = 0.98),
          now >= nextStateJitterAt &&
            ((nodEndsAt = now + 600), (nextStateJitterAt = now + randomBetween(4e3, 7e3))),
          now < nodEndsAt)
        ) {
          const Et = 1 - (nodEndsAt - now) / 600;

          bodyScaleSpring.t = 1 + Math.sin(Et * Math.PI) * 0.05;
          faceRollSpring.t += Math.sin(Et * Math.PI) * 3;
        }
        break;
      }
      case "proud": {
        faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * 0.4) * 2.5;
        faceTiltSpring.t = Math.sin(elapsed * 0.35) * 2;
        faceRollSpring.t = -4 + Math.sin(elapsed * 0.6);
        bodyScaleSpring.t = 1.03;
        eyeSize = 1.02;
        eyeOpenness = 0.9;

        break;
      }
      case "shy": {
        faceTurnSpring.t = faceTurnOffset - 8 + Math.sin(elapsed * 0.5) * 3;
        faceTiltSpring.t = -3 + Math.sin(elapsed * 0.4) * 2;
        faceRollSpring.t = 3;
        bodyScaleSpring.t = 0.98;
        eyeSize = 0.95;
        eyeOpenness = 0.85;

        break;
      }
      case "sad": {
        faceTurnSpring.t = faceTurnOffset + 3 + Math.sin(elapsed * 0.3) * 2;
        faceTiltSpring.t = Math.sin(elapsed * 0.25) * 1.5;
        faceRollSpring.t = 7 + Math.sin(elapsed * 0.4);
        bodyScaleSpring.t = 0.97;
        eyeOpenness = 0.7;
        eyeSize = 0.97;

        break;
      }
      case "laughing": {
        const Et = Math.sin(elapsed * Math.PI * 2 * 3.2);

        faceTurnSpring.t = faceTurnOffset + Et * 4;
        faceTiltSpring.t = Math.sin(elapsed * 2) * 2;
        faceRollSpring.t = -Math.abs(Et) * 5;
        bodyScaleSpring.t = 1 + Et * 0.03;
        eyeOpenness = 0.7;
        eyeSize = 1;

        break;
      }
      case "scared": {
        faceTurnSpring.t = faceTurnOffset + Math.sin(now * 0.04) * 2;
        faceTiltSpring.t = -2 + Math.sin(now * 0.05) * 1.5;
        faceRollSpring.t = 2 + Math.sin(elapsed * 1.5);
        bodyScaleSpring.t = 0.97;
        eyeSize = 1.12;
        eyeOpenness = 1.05;

        break;
      }
      case "playful": {
        faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * 1.4) * 8;
        faceTiltSpring.t = Math.sin(elapsed * 1.1) * 4;
        faceRollSpring.t = -Math.abs(Math.sin(elapsed * 2.2)) * 3;
        bodyScaleSpring.t = 1 + Math.sin(elapsed * 2.2) * 0.015;
        eyeSize = 1.06;
        now >= nextStateAccentAt &&
          (startSpin(1), (nextStateAccentAt = now + randomBetween(3500, 6e3)));

        break;
      }
      case "celebrate": {
        faceTurnSpring.t = faceTurnOffset;
        faceTiltSpring.t = 0;
        faceRollSpring.t = -Math.abs(Math.sin(elapsed * 1.6)) * 2.5;
        bodyScaleSpring.t = 1;
        eyeSize = 1.1;
        eyeOpenness = 1.1;

        break;
      }
      case "orbit":
      case "radar":
      case "progress":
      case "spawning":
      case "loading":
      case "dictating":
      case "sending":
      case "receiving":
      case "uploading":
      case "writing":
      case "alerting":
      case "bouncing":
      case "powering-down": {
        faceTurnSpring.t = faceTurnOffset;
        faceTiltSpring.t = 0;
        faceRollSpring.t = 0;
        bodyScaleSpring.t = 1;

        break;
      }
      case "dragging": {
        const En = (stateElapsed % 3.4) / 3.4;
        const Zt = Math.floor(stateElapsed / 3.4);
        if (En < 0.12) {
          faceTiltSpring.t = -16;
          faceRollSpring.t = -22;
          faceTurnSpring.t = faceTurnOffset - 5;
        } else if (En < 0.62) {
          const dn = (En - 0.12) / 0.5;

          faceTiltSpring.t = -16 + 32 * easeInOutCubic(dn);
          faceRollSpring.t = -22 + Math.sin(elapsed * 1.4) * 2;
          faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * 2.6) * 6;
          eyeSize = 1.06;
        } else {
          Zt !== Yt && ((Yt = Zt), (faceRollSpring.v += 90));
          faceTiltSpring.t = 16;
          faceRollSpring.t = 0;
          faceTurnSpring.t = faceTurnOffset;
        }
        bodyScaleSpring.t = 1;
        break;
      }
      case "humming": {
        faceTurnSpring.t = faceTurnOffset + Math.sin(elapsed * 0.4) * 2;
        faceTiltSpring.t = Math.sin(elapsed * 0.3) * 1.5;
        faceRollSpring.t = Math.sin(elapsed * 0.7) * 1.5;
        bodyScaleSpring.t = 1;

        break;
      }
      case "notifying": {
        Yt < 0 && stateElapsed > 0.12 && ((Yt = 0), (faceRollSpring.v -= 26), scheduleBlink(now));
        eyeSize = 1 + 0.05 * Math.exp(-stateElapsed * 3);
        faceTurnSpring.t = faceTurnOffset + 3;
        faceTiltSpring.t = 2;
        faceRollSpring.t = -1;
        bodyScaleSpring.t = 1;

        break;
      }
    }
    if (now >= nextGazeAt) {
      const Zt = () => (Math.random() < 0.5 ? -1 : 1);
      let dn = 0;
      let on = 0;
      let bn = 2500;
      let Cn = 5e3;
      switch (state) {
        case "idle":
          {
            dn = 0;
            on = 0;
            bn = 2500;
            Cn = 5500;
          }
          break;
        case "listening":
          {
            dn = randomBetween(-0.3, 0.3) * 15;
            on = randomBetween(-0.25, 0.25) * 9;
            bn = 2200;
            Cn = 4200;
          }
          break;
        case "thinking":
          {
            dn = Zt() * randomBetween(0.5, 1) * 15;
            on = -randomBetween(0.4, 1) * 9;
            bn = 1500;
            Cn = 2800;
          }
          break;
        case "searching":
          {
            dn = Zt() * randomBetween(0.7, 1) * 15;
            on = randomBetween(-1, 1) * 9;
            bn = 550;
            Cn = 1150;
          }
          break;
        case "working":
          {
            dn = randomBetween(-0.4, 0.4) * 15;
            on = randomBetween(0.4, 1) * 9;
            bn = 1200;
            Cn = 2400;
          }
          break;
        case "excited":
          {
            dn = randomBetween(-1, 1) * 15;
            on = randomBetween(-1, 0.3) * 9;
            bn = 700;
            Cn = 1400;
          }
          break;
        case "surprised":
          {
            dn = 0;
            on = 0;
            bn = 1600;
            Cn = 2600;
          }
          break;
        case "suspicious":
          {
            dn = Zt() * 15;
            on = 0.3 * 9;
            bn = 2200;
            Cn = 4200;
          }
          break;
        case "angry":
          {
            dn = randomBetween(-0.2, 0.2) * 15;
            on = 0.2 * 9;
            bn = 1800;
            Cn = 3200;
          }
          break;
        case "drowsy":
          {
            dn = randomBetween(-0.4, 0.4) * 15;
            on = randomBetween(0.4, 1) * 9;
            bn = 2500;
            Cn = 4500;
          }
          break;
        case "happy":
          {
            dn = randomBetween(-0.7, 0.7) * 15;
            on = -randomBetween(0, 0.6) * 9;
            bn = 1800;
            Cn = 3400;
          }
          break;
        case "curious":
          {
            dn = Zt() * randomBetween(0.6, 1) * 15;
            on = randomBetween(-1, 1) * 9;
            bn = 950;
            Cn = 1900;
          }
          break;
        case "confused":
          {
            dn = Zt() * randomBetween(0.5, 1) * 15;
            on = randomBetween(-0.6, 1) * 9;
            bn = 1100;
            Cn = 2300;
          }
          break;
        case "bored":
          {
            dn = Zt() * randomBetween(0.7, 1) * 15;
            on = randomBetween(0.4, 0.9) * 9;
            bn = 3e3;
            Cn = 6e3;
          }
          break;
        case "proud":
          {
            dn = randomBetween(-0.3, 0.3) * 15;
            on = -randomBetween(0.3, 0.7) * 9;
            bn = 2600;
            Cn = 4600;
          }
          break;
        case "shy":
          {
            dn = Zt() * randomBetween(0.6, 1) * 15;
            on = randomBetween(0.5, 1) * 9;
            bn = 2e3;
            Cn = 4e3;
          }
          break;
        case "sad":
          {
            dn = randomBetween(-0.3, 0.3) * 15;
            on = randomBetween(0.6, 1) * 9;
            bn = 2800;
            Cn = 5e3;
          }
          break;
        case "laughing":
          {
            dn = randomBetween(-0.5, 0.5) * 15;
            on = -randomBetween(0.2, 0.6) * 9;
            bn = 800;
            Cn = 1700;
          }
          break;
        case "scared":
          {
            dn = Zt() * randomBetween(0.7, 1) * 15;
            on = randomBetween(-0.6, 0.6) * 9;
            bn = 450;
            Cn = 1050;
          }
          break;
        case "playful":
          {
            dn = Zt() * randomBetween(0.5, 1) * 15;
            on = -randomBetween(0, 0.6) * 9;
            bn = 900;
            Cn = 1800;
          }
          break;
        case "notifying": {
          const bi = Math.random() < 0.72;

          dn = (bi ? 0.45 : 0.1) * 15;
          on = -(bi ? 0.3 : 0.05) * 9;
          bn = 1200;
          Cn = 2400;

          break;
        }
        default:
          {
            dn = randomBetween(-0.4, 0.4) * 15;
            on = randomBetween(-0.3, 0.3) * 9;
          }
          break;
      }

      gazeXSpring.t = dn;
      gazeYSpring.t = on;
      nextGazeAt = now + randomBetween(bn, Cn);
    }
    if (
      ((state === "idle" ||
        state === "happy" ||
        state === "excited" ||
        state === "curious" ||
        state === "playful") &&
        now >= nextWinkAt &&
        ((winkStartedAt = now),
        (winkEye = Math.random() < 0.5 ? 0 : 1),
        (nextWinkAt = now + randomBetween(4500, 1e4))),
      (specialSpinAngle = null),
      (Kr = 0),
      (yi = 0),
      (ki = 0),
      (Yr = 0),
      (Zr = 0),
      (wi = 0),
      specialSpin)
    ) {
      const Et = (now - specialSpin.t0) / 1e3;
      const { kind: En, dir: Zt, turns: dn } = specialSpin;
      if (En === "spinDizzy") {
        const on = 0.55 + dn * 0.16;
        const bn = 1.5;
        if (Et < on) {
          const Cn = Et / on;
          specialSpinAngle = dn * Math.PI * 2 * Zt * (Cn * Cn);
        } else if (Et < on + bn) {
          const Cn = Et - on;
          const bi = Math.pow(1 - Cn / bn, 1.3);

          Kr = Math.sin(Cn * 10) * 17 * Zt * bi;
          yi = Math.cos(Cn * 10) * 10 * Zt * bi;
          ki = Math.sin(Cn * 20) * 3 * bi;
          eyeOpenness = 0.46 + 0.14 * Math.sin(Cn * 21);
          eyeSize = 1.03;
        } else specialSpin = null;
      } else if (En === "spinWild") {
        const ud = 1.9999999999999998;
        const Pc = 0.5;
        const Go = Math.PI * 2;
        const $i = 0.24 + 2.3 + 1.25;
        const gm = (dn * Go + Pc) / (0.3 / 2 + ud + 1.25 / 4);
        if (Et < $i + 1.7) {
          let cr;
          if (Et < 0.24) cr = (-Pc * (1 - Math.cos((Et / 0.24) * Math.PI))) / 2;
          else if (Et < 0.24 + 0.3) {
            const Ua = Et - 0.24;
            cr = -Pc + (gm * Ua * Ua) / (2 * 0.3);
          } else if (Et < 0.24 + 2.3) cr = -Pc + gm * (0.3 / 2 + (Et - 0.24 - 0.3));
          else if (Et < $i) {
            const Ua = (Et - 0.24 - 2.3) / 1.25;
            cr = -Pc + gm * (0.3 / 2 + ud) + (gm * 1.25 * (1 - Math.pow(1 - Ua, 4))) / 4;
          } else cr = dn * Go;
          specialSpinAngle = cr * Zt;
          let pl = 0;
          if (Et > 0.24 + 2.3) {
            const Ua = Math.min((Et - 0.24 - 2.3) / 1.25, 1);
            if (((pl = Ua < 0.4 ? 0 : Math.pow((Ua - 0.4) / 0.6, 2)), Et >= $i)) {
              const gl = (Et - $i) / 1.7;
              pl = Math.pow(1 - gl, 1.6);
            }
          }
          const Yl = Math.max(Et - 0.24 - 2.3, 0);

          Yr = (cr / (dn * Go)) * 3 * 360 * Zt;
          Kr = Math.sin(Yl * 9.2) * 11 * Zt * pl;
          yi = (Math.cos(Yl * 9.2) - 1) * 6 * Zt * pl;
          ki = Math.sin(Yl * 18.4) * 2.6 * pl;
          Zr = Math.sin(Yl * 11.5) * 13 * Zt * pl;
          wi = (Math.cos(Yl * 9) - 1) * 3.5 * pl;
          eyeOpenness = 1.14 - 0.44 * pl + 0.1 * Math.sin(Yl * 16) * pl;
          eyeSize = 1.12 - 0.09 * pl;
        } else specialSpin = null;
      } else
        En === "spinBounce" &&
          (Et < 0.7
            ? (specialSpinAngle = dn * Math.PI * 2 * Zt * easeInOutCubic(Et / 0.7))
            : (startBounce(), (specialSpin = null)));
    }
    if (((bounceOffsetY = 0), bounceStartedAt >= 0)) {
      const Et = (now - bounceStartedAt) / 1e3;
      if (Et >= bounceDuration) bounceStartedAt = -1;
      else {
        let En = 0;
        let Zt = 0;
        for (; Zt < bounceStages.length && !(Et < En + bounceStages[Zt].d); Zt++)
          En += bounceStages[Zt].d;
        const { h: dn, d: on } = bounceStages[Zt];
        const bn = (Et - En) / on;
        bounceOffsetY = -4 * dn * bn * (1 - bn);
      }
    }
    if (state !== "waking" && state !== "sleeping" && now >= nextEyeContourAt) {
      const Et = stateEyeContours[state];

      stateEyeIndex = (stateEyeIndex + 1 + Math.floor(randomBetween(0, Et.length - 1))) % Et.length;
      setEyeContour(Et[stateEyeIndex], state === "searching" || state === "excited" ? 10 : 6);
      nextEyeContourAt = now + randomBetween(...stateEyeIntervals[state]);
    }
    const yn = stateBlinkIntervals[state];
    yn &&
      now >= nextBlinkAt &&
      (scheduleBlink(now), (nextBlinkAt = now + randomBetween(yn[0], yn[1])));
    let an = null;
    for (; blinkQueue.length && now >= blinkQueue[0].at;) {
      an = blinkQueue[0].v;
      blinkQueue.shift();
    }

    eyeOpenSpring.t = an ?? (blinkQueue.length ? eyeOpenSpring.t : eyeOpenness);
    eyeSizeSpring.t = eyeSize;
  };
  const morphRenderers = createMorphRenderers(nodes, config, reducedMotion, {
    get morphStartedAt() {
      return morphStartedAt;
    },
    get morphAnimationStartedAt() {
      return morphAnimationStartedAt;
    },
  });
  const {
    dotPulse,
    pencilPose,
    renderDots,
    renderOrbit,
    renderRadar,
    renderProgress,
    renderGather,
    renderWave,
    renderSend,
    renderReceive,
    renderDock,
    renderPencil,
    renderAlert,
    renderStandby,
  } = morphRenderers;
  const renderFrame = (now: number) => {
    const eyeMorphAmount = Math.min(Math.max(eyeMorphSpring.x, 0), 1);
    let spinAngle = 0;
    let spinning = !1;

    spinSpring &&
      ((spinAngle = spinSpring.x),
      (spinning = !0),
      Math.abs(spinSpring.t - spinSpring.x) < 0.004 &&
        Math.abs(spinSpring.v) < 0.015 &&
        ((spinSpring = null), (wideSpin = !1), (spinAngle = 0), (spinning = !1)));
    emphasisBlend += ((config.emphasis ? 1 : 0) - emphasisBlend) * blendForFrame(0.12);

    const interpolatedEyes = [
      interpolateContours(currentEyeContours[0], targetEyeContours[0], eyeMorphAmount),
      interpolateContours(currentEyeContours[1], targetEyeContours[1], eyeMorphAmount),
    ];
    const eyeCenters = [contourCentroid(interpolatedEyes[0]), contourCentroid(interpolatedEyes[1])];
    const eyesCenterX = (eyeCenters[0][0] + eyeCenters[1][0]) / 2;
    const eyesCenterY = (eyeCenters[0][1] + eyeCenters[1][1]) / 2;
    const emphasisOffsetX = (bodyCenter - eyesCenterX) * 0.42 * emphasisBlend;
    const emphasisOffsetY = (bodyCenter - eyesCenterY) * 0.42 * emphasisBlend;
    const morphTurning =
      morphSpring.x > 0.001 || Math.abs(morphTurnSpring.t - morphTurnSpring.x) > 0.01;
    specialSpinAngle !== null && ((spinAngle += specialSpinAngle), (spinning = !0));
    let faceSpinAngle = morphTurning ? morphTurnSpring.x : null;
    faceSpinAngle = spinning ? (faceSpinAngle ?? 0) + spinAngle : faceSpinAngle;
    const shape = shapeGeometry[config.shape];
    if (config.shape !== previousShape) {
      const _t = easeInOutCubic(clampMotion(shapeMorphSpring.x, 0, 1));
      const gn = shapeGeometry[previousShape];

      previousShapeRing = _t >= 1 ? gn.ring : interpolateContours(previousShapeRing, gn.ring, _t);
      previousFaceFit = _t >= 1 ? gn.face : interpolateFaceFit(previousFaceFit, gn.face, _t);
      previousTiltScale += (gn.tiltScale - previousTiltScale) * _t;
      previousBeltRadius += (gn.beltRadius - previousBeltRadius) * _t;
      previousShape = config.shape;
      shapeMorphSpring.x = 0;
      shapeMorphSpring.v = 0;
      shapeMorphSpring.t = 1;
      playNextReaction();
    }
    const shapeMorphAmount = easeInOutCubic(clampMotion(shapeMorphSpring.x, 0, 1));
    const shapeMorphing = shapeMorphAmount < 0.999;
    let bodyRing = shapeMorphing
      ? interpolateContours(previousShapeRing, shape.ring, shapeMorphAmount)
      : shape.ring;
    const faceFit = shapeMorphing
      ? interpolateFaceFit(previousFaceFit, shape.face, shapeMorphAmount)
      : shape.face;
    const faceTune = config.faceTune;
    const pose = config.pose;
    const eyeTopology = config.eyeTopology;
    const tunedFaceFit = {
      x: faceFit.x,
      y: faceFit.y,
      sx: faceFit.sx * (faceTune?.gap ?? 1),
      sy: faceFit.sy * (faceTune?.height ?? 1),
      eye: faceFit.eye * (faceTune?.size ?? 1),
      leftDX: faceFit.leftDX ?? 0,
    };
    const poseMatrix = (_t: number, gn: number, Gn: number) => {
      const Ti = Math.PI / 180;
      const Ui = Math.cos(_t * Ti);
      const Si = Math.sin(_t * Ti);
      const Ea = Math.cos(gn * Ti);
      const Ca = Math.sin(gn * Ti);
      const Wo = Math.cos(Gn * Ti);
      const _c = Math.sin(Gn * Ti);
      return [
        Wo * Ui - _c * Ca * Si,
        -_c * Ea,
        Wo * Si + _c * Ca * Ui,
        _c * Ui + Wo * Ca * Si,
        Wo * Ea,
        _c * Si - Wo * Ca * Ui,
        -Ea * Si,
        Ca,
        Ea * Ui,
      ];
    };
    let relativePoseMatrix = null;
    if (eyeTopology) {
      const _t = config.poseHome;
      const gn = poseMatrix(pose.turn, pose.tilt, pose.roll);
      const Gn = poseMatrix(_t.turn, _t.tilt, _t.roll);
      relativePoseMatrix = [
        gn[0] * Gn[0] + gn[1] * Gn[1] + gn[2] * Gn[2],
        gn[0] * Gn[3] + gn[1] * Gn[4] + gn[2] * Gn[5],
        gn[0] * Gn[6] + gn[1] * Gn[7] + gn[2] * Gn[8],
        gn[3] * Gn[0] + gn[4] * Gn[1] + gn[5] * Gn[2],
        gn[3] * Gn[3] + gn[4] * Gn[4] + gn[5] * Gn[5],
        gn[3] * Gn[6] + gn[4] * Gn[7] + gn[5] * Gn[8],
        gn[6] * Gn[0] + gn[7] * Gn[1] + gn[8] * Gn[2],
        gn[6] * Gn[3] + gn[7] * Gn[4] + gn[8] * Gn[5],
        gn[6] * Gn[6] + gn[7] * Gn[7] + gn[8] * Gn[8],
      ];
    }
    const tiltScale = shapeMorphing
      ? previousTiltScale + (shape.tiltScale - previousTiltScale) * shapeMorphAmount
      : shape.tiltScale;

    beltRadius = shapeMorphing
      ? previousBeltRadius + (shape.beltRadius - previousBeltRadius) * shapeMorphAmount
      : shape.beltRadius;
    config.state === "loading" &&
      (beltRadius += (52 - beltRadius) * clampMotion(morphSpring.x, 0, 1));

    const badgeAnchor = bodyRing[Math.round((bodyRing.length * 7) / 8) % bodyRing.length];
    let turnedOutline = !1;
    spinning &&
      !shapeMorphing &&
      shape.turnAt &&
      ((bodyRing = shape.turnAt(spinAngle)), (turnedOutline = !0));
    let bodyTop = shape.top;
    let bodyBottom = shape.bottom;
    if (shapeMorphing || turnedOutline) {
      bodyTop = 1 / 0;
      bodyBottom = -1 / 0;

      for (const _t of bodyRing) {
        _t[1] < bodyTop && (bodyTop = _t[1]);
        _t[1] > bodyBottom && (bodyBottom = _t[1]);
      }
    }
    const bodySpanAt =
      shapeMorphing || turnedOutline ? (_t: number) => contourSpanAt(bodyRing, _t) : shape.spanAt;
    let leftEyeHalfWidth = 0;
    let rightEyeHalfWidth = 0;
    for (const _t of interpolatedEyes[0])
      leftEyeHalfWidth = Math.max(leftEyeHalfWidth, Math.abs(_t[0] - eyeCenters[0][0]));
    for (const _t of interpolatedEyes[1])
      rightEyeHalfWidth = Math.max(rightEyeHalfWidth, Math.abs(_t[0] - eyeCenters[1][0]));
    const uniformEyes = config.uniformEyes;
    const leftEyeOffset = uniformEyes ? (tunedFaceFit.leftDX ?? 0) : 0;
    const eyeGap =
      Math.abs(eyeCenters[1][0] - (eyeCenters[0][0] + leftEyeOffset)) * tunedFaceFit.sx;
    const eyePadding = uniformEyes ? 0 : eyeContourPadding;
    const eyeWidthLimit =
      leftEyeHalfWidth + rightEyeHalfWidth > 0.5
        ? clampMotion((eyeGap - eyePadding) / (leftEyeHalfWidth + rightEyeHalfWidth), 0.35, 4)
        : 4;
    for (let _t = 0; _t < 2; _t++) {
      const gn = nodes.eyes[_t];
      if (!gn) continue;
      const [Gn, Ti] = eyeCenters[_t];
      let Ui = Math.max(eyeOpenSpring.x, 0.04);
      if (_t === winkEye && now < winkStartedAt + 320) {
        const xr = (now - winkStartedAt) / 320;
        const Fr = xr < 0.42 ? 1 - xr / 0.42 : (xr - 0.42) / 0.58;
        Ui = Math.max(Ui * Fr, 0.04);
      }
      const Si = interpolatedEyes[_t];
      gn.setAttribute("d", polygonPath(Si));
      const Ea = Gn + (_t === 0 ? leftEyeOffset : 0);
      let Ca = bodyCenter + tunedFaceFit.x;
      let Wo = (Ea - bodyCenter) * tunedFaceFit.sx;
      let _c = 1;
      let vre = 1;
      let km = 1;
      let Ree = 0;
      let Fee = 0;
      let zee = 1;
      let bre = !0;
      let Tre = 1;
      let Sre = clampMotion(
        bodyCenter + tunedFaceFit.y + (Ti - bodyCenter) * tunedFaceFit.sy,
        bodyTop + 2,
        bodyBottom - 2,
      );
      const $me = faceSpinAngle !== null || eyeTopology;
      if (eyeTopology && relativePoseMatrix) {
        const xr = (Ea - bodyCenter) / bodyCenter;
        const Fr = (bodyCenter - Ti) / bodyCenter;
        const Ia = Math.sqrt(Math.max(0, 1 - xr * xr - Fr * Fr)) || 0.02;
        const li =
          relativePoseMatrix[0] * xr + relativePoseMatrix[1] * Fr + relativePoseMatrix[2] * Ia;
        const bl =
          relativePoseMatrix[3] * xr + relativePoseMatrix[4] * Fr + relativePoseMatrix[5] * Ia;
        const Io =
          relativePoseMatrix[6] * xr + relativePoseMatrix[7] * Fr + relativePoseMatrix[8] * Ia;

        Wo = li * bodyCenter * tunedFaceFit.sx;
        Sre = clampMotion(
          bodyCenter + tunedFaceFit.y - bl * bodyCenter * tunedFaceFit.sy,
          bodyTop + 2,
          bodyBottom - 2,
        );

        let uo = -Fr * xr;
        let Tl = 1 - Fr * Fr;
        let Zi = -Fr * Ia;
        const Yo = Math.hypot(uo, Tl, Zi);
        Yo < 1e-6 ? ((uo = 0), (Tl = 0), (Zi = 1)) : ((uo /= Yo), (Tl /= Yo), (Zi /= Yo));
        const md = Fr * Zi - Ia * Tl;
        const Oc = Ia * uo - xr * Zi;
        const yu = xr * Tl - Fr * uo;
        const vm =
          relativePoseMatrix[0] * uo + relativePoseMatrix[1] * Tl + relativePoseMatrix[2] * Zi;
        const Hme =
          relativePoseMatrix[3] * uo + relativePoseMatrix[4] * Tl + relativePoseMatrix[5] * Zi;
        const Nre =
          relativePoseMatrix[0] * md + relativePoseMatrix[1] * Oc + relativePoseMatrix[2] * yu;
        const Ere =
          relativePoseMatrix[3] * md + relativePoseMatrix[4] * Oc + relativePoseMatrix[5] * yu;
        const Cre = md;
        const Ha = -Oc;
        const ci = uo;
        const Ys = -Tl;
        const ku = Cre * Ys - ci * Ha || 1e-6;
        const Ql = Ys / ku;
        const Gee = -ci / ku;
        const bm = -Ha / ku;
        const Ire = Cre / ku;
        const Are = Nre;
        const L2 = -Ere;
        const d1 = vm;
        const Wee = -Hme;

        km = Are * Ql + d1 * bm;
        Fee = Are * Gee + d1 * Ire;
        Ree = L2 * Ql + Wee * bm;
        zee = L2 * Gee + Wee * Ire;
        _c = Math.max(Math.hypot(km, Ree), 0.02);
        vre = Math.max(Math.hypot(Fee, zee), 0.02);
        bre = Io > 0.02;
        Tre = smoothstep(clampMotion(Io / 0.5, 0, 1));
      }
      if (faceSpinAngle !== null) {
        const [xr, Fr] = bodySpanAt(Sre);
        const Ia = Math.max((Fr - xr) / 2, 12);
        Ca = (xr + Fr) / 2;
        const li = Math.asin(clampMotion(Wo / Ia, -1, 1));
        const bl = li + faceSpinAngle;
        const Io = Math.cos(bl);
        const uo = Math.max(Math.cos(li), 0.02);

        bre = Io > 0.02;
        _c = Math.max(Io, 0.02) / uo;
        Wo = Ia * Math.sin(bl);
        Tre = smoothstep(clampMotion(Io / 0.5, 0, 1));
      }
      const P2 = 1 + 0.07 * Math.sin(eyeMorphAmount * Math.PI);
      let Kj = Math.sin(now * 42e-5 + _t) * 1.4 + Math.sin(now * 0.001 + _t * 2) * 0.5;
      let Ko = Math.sin(now * 58e-5 + _t) * 0.9;
      const M2 = config.gazeTarget;
      if (M2 && nodes.svg) {
        (!cachedBounds || now - boundsSampleAt > 200) &&
          ((cachedBounds = nodes.svg.getBoundingClientRect()), (boundsSampleAt = now));
        const xr = cachedBounds;

        pointerGaze.tx = clampMotion((M2.x - (xr.left + xr.width / 2)) / xr.width, -0.6, 0.6) * 22;
        pointerGaze.ty = clampMotion((M2.y - (xr.top + xr.height / 2)) / xr.height, -0.6, 0.6) * 14;
      } else {
        pointerGaze.tx = 0;
        pointerGaze.ty = 0;
      }
      const Zl = blendForFrame(0.16);

      pointerGaze.x += (pointerGaze.tx - pointerGaze.x) * Zl;
      pointerGaze.y += (pointerGaze.ty - pointerGaze.y) * Zl;
      Kj += pointerGaze.x * (1 - 0.6 * emphasisBlend) + emphasisOffsetX;
      Ko += pointerGaze.y * (1 - 0.6 * emphasisBlend) + emphasisOffsetY;

      const J2 = M2 ? 0.2 : 1;

      Kj += gazeXSpring.x * J2 + Zr;
      Ko += gazeYSpring.x * J2 + wi;

      const $ee = clampMotion(badgeSpring.x, 0, 1);

      Kj -= 10 * $ee;
      Ko += 7 * $ee;

      const Uee =
        (config.uniformEyes ? 1 : tunedFaceFit.eye) * clampMotion(config.eyeScale, 0.25, 4);
      const oX = Math.min(clampMotion(eyeSizeSpring.x, 0.2, 2) * Uee, eyeWidthLimit / P2);
      const Hee = Math.min(oX * clampMotion(faceTune?.eyeWidth ?? 1, 0.2, 3), eyeWidthLimit / P2);
      const u1 = oX * clampMotion(faceTune?.eyeHeight ?? 1, 0.2, 3);
      let Vee = clampMotion(_c * Hee * P2, 0.02, 2.4);
      let _2 = clampMotion(vre * Ui * u1 * P2, 0.02, 2.4);
      gn.style.display = bre && morphSpring.x < 0.5 ? "" : "none";
      const wm = tunedFaceFit;
      const Ume = baseEyeHeight * _2 + 2;
      const vl = clampMotion(
        $me ? Sre + Ko * wm.sy : bodyCenter + wm.y + (Ti + Ko - bodyCenter) * wm.sy,
        bodyTop + Ume,
        bodyBottom - Ume,
      );
      let O2 = -1 / 0;
      let Xl = 1 / 0;
      for (let xr = 0; xr < Si.length; xr += 2) {
        const Fr = (Si[xr][0] - Gn) * Vee;
        const [Ia, li] = bodySpanAt(vl + (Si[xr][1] - Ti) * _2);

        Ia - Fr > O2 && (O2 = Ia - Fr);
        li - Fr < Xl && (Xl = li - Fr);
      }
      const xre = Ca + Wo + Kj * wm.sx;
      const lX = O2 <= Xl ? clampMotion(xre, O2, Xl) : (O2 + Xl) / 2;
      let dd = lX + (xre - lX) * (1 - Tre);
      let Yj = vl;
      if (badgeSpring.x > 0.01) {
        const xr = 20 * clampMotion(badgeSpring.x, 0, 1.4);
        const Fr = dd - badgeAnchor[0];
        const Ia = Yj - badgeAnchor[1];
        const li = Math.hypot(Fr, Ia) || 1;
        const bl = Fr / li;
        const Io = Ia / li;
        const uo = (_t === 0 ? leftEyeHalfWidth : rightEyeHalfWidth) * Vee;
        const Tl = Math.hypot(uo * bl, baseEyeHeight * _2 * Io);
        const Zi = xr + Tl + 5;
        li < Zi && ((dd += bl * (Zi - li)), (Yj += Io * (Zi - li)));
      }
      if (eyeTopology && relativePoseMatrix) {
        const Fr = clampMotion((faceSpinAngle !== null ? _c : 1) * Hee * P2, 0.02, 2.4);
        const Ia = clampMotion(Ui * u1 * P2, 0.02, 2.4);
        const li = km * Fr;
        const bl = Ree * Fr;
        const Io = Fee * Ia;
        const uo = zee * Ia;
        gn.setAttribute(
          "transform",
          `translate(${dd.toFixed(2)} ${Yj.toFixed(2)}) matrix(${li.toFixed(4)} ${bl.toFixed(4)} ${Io.toFixed(4)} ${uo.toFixed(4)} 0 0) translate(${(-Gn).toFixed(2)} ${(-Ti).toFixed(2)})`,
        );
      } else
        gn.setAttribute(
          "transform",
          `translate(${dd.toFixed(2)} ${Yj.toFixed(2)}) scale(${Vee.toFixed(4)} ${_2.toFixed(4)}) translate(${(-Gn).toFixed(2)} ${(-Ti).toFixed(2)})`,
        );
    }
    const morphAmount = clampMotion(morphSpring.x, 0, 1);
    const morphTransitionAmount = clampMotion(morphTransitionSpring.x, 0, 1);
    const outgoingMorph = morphTransitionAmount < 0.999 ? previousMorph : null;
    const bodyMorphAmount = clampMotion(morphAmount / bodyMorphThreshold, 0, 1);
    const pencilMorph = activeMorph === "pencil" || outgoingMorph === "pencil";
    const targetBodyRing = pencilMorph
      ? morphTransitionAmount >= 0.999
        ? morphRing(activeMorph)
        : interpolateContours(
            morphRing(outgoingMorph),
            morphRing(activeMorph),
            easeInOutCubic(morphTransitionAmount),
          )
      : circleRing;
    if (
      turnedOutline ||
      lastTurnedOutline ||
      bodyMorphAmount !== lastBodyMorph ||
      shapeMorphAmount !== lastShapeMorph ||
      config.shape !== lastRenderedShape ||
      pencilMorph
    ) {
      const _t =
        bodyMorphAmount >= 1
          ? pencilMorph
            ? ringPath(targetBodyRing)
            : circleOutlinePath
          : bodyMorphAmount <= 0 && !shapeMorphing && !turnedOutline
            ? shape.path
            : ringPath(
                bodyMorphAmount <= 0
                  ? bodyRing
                  : interpolateContours(bodyRing, targetBodyRing, easeInOutCubic(bodyMorphAmount)),
              );

      nodes.body?.setAttribute("d", _t);
      nodes.clip?.setAttribute("d", _t);
      lastBodyMorph = bodyMorphAmount;
      lastShapeMorph = shapeMorphAmount;
      lastTurnedOutline = turnedOutline;
      lastRenderedShape = config.shape;
    }
    for (const _t of nodes.parts) _t && (_t.style.display = "none");
    for (const _t of nodes.rings) _t && (_t.style.display = "none");
    for (const _t of nodes.silhouettes) _t && (_t.style.display = "none");
    for (const _t of nodes.glyphs) _t && (_t.style.display = "none");
    const morphWeight = (_t: MorphName | null) =>
      _t == null
        ? 0
        : _t === activeMorph
          ? morphAmount * morphTransitionAmount
          : _t === outgoingMorph
            ? morphAmount * (1 - morphTransitionAmount)
            : 0;
    const morphEyeGaps = {
      dots: 22,
      orbit: 19,
      radar: 19,
      progress: 19,
      gather: 19,
      wave: 16,
      send: 20,
      receive: 20,
      dock: 20,
      ball: 18,
      whirl: 15,
      pencil: 17,
      bang: 13,
      standby: 13,
    };
    const morphEyeGap = activeMorph
      ? morphEyeGaps[activeMorph] * morphTransitionAmount +
        (outgoingMorph ? morphEyeGaps[outgoingMorph] : morphEyeGaps[activeMorph]) *
          (1 - morphTransitionAmount)
      : 19;
    const centerDotPulse = dotPulse(now, 1, morphAmount);
    const dotsMorph = activeMorph === "dots" || outgoingMorph === "dots";
    const Lee = morphWeight("dots");
    let iX = dotsMorph ? 1 + (centerDotPulse.pop - 1) * (Lee / Math.max(morphAmount, 0.001)) : 1;
    const Bee = now - config.changedAt;
    const Fme = morphWeight("receive");
    if (Fme > 0.004) {
      const _t = (((Bee / receivePeriod) % 1) + 1) % 1;
      const gn = clampMotion((_t - 0.58) / 0.34, 0, 1);
      iX *= 1 + 0.11 * Math.sin(gn * Math.PI) * Fme;
    }
    const zme = morphWeight("send");
    if (zme > 0.004) {
      const _t = (((Bee / sendPeriod) % 1) + 1) % 1;
      const gn = _t < 0.18 ? -0.06 * Math.sin((_t / 0.18) * Math.PI) : 0;
      const Gn = _t >= 0.18 && _t < 0.42 ? 0.05 * Math.sin(((_t - 0.18) / 0.24) * Math.PI) : 0;
      iX *= 1 + (gn + Gn) * zme;
    }
    const qee = morphWeight("bang");
    qee > 0.004 && (iX *= 1 + 0.04 * Math.exp(-((Bee / 1e3) % 2.2) * 5.5) * qee);
    let yre = 0;
    let aX = 0;
    let wl = 0;
    const c1 = morphWeight("pencil");
    if (c1 > 0.004) {
      const _t = pencilPose(now);

      yre += _t.x * c1;
      aX += (_t.y + _t.wig * 0.5) * c1;
      wl += _t.rot * c1;
    }
    qee > 0.004 && (aX += 58 * qee);
    const jee = morphWeight("whirl");
    if (jee > 0.004) {
      const _t = now / 1e3;

      yre += (Math.sin(_t * 0.9) * 2 + Math.sin(_t * 1.7) * 0.8) * jee;
      aX += (Math.sin(_t * 1.3) * 2.4 + Math.sin(_t * 0.6) * 1.2) * jee;
    }
    const kre = morphWeight("ball");
    if (kre > 0.004) {
      const _t = (now - config.changedAt) / 1e3;
      const gn = 0.62;
      const Gn = 52;
      const Ti = (8 * Gn) / (gn * gn);
      const Ui = 40;
      const Si = Math.sqrt((2 * Ui) / Ti);
      let Ea;
      if (_t < Si) Ea = Ui - 0.5 * Ti * _t * _t;
      else {
        const Ca = ((((_t - Si) / gn) % 1) + 1) % 1;
        Ea = 4 * Gn * Ca * (1 - Ca);
      }
      aX += (40 - Ea) * kre;
    }
    const wre = (morphEyeGap / bodyCenter) * iX;
    if (nodes.face) {
      const _t = 1 - morphAmount;
      const gn = faceTiltSpring.x * _t + yi * _t + yre * morphAmount;
      const Gn =
        (faceRollSpring.x + bounceOffsetY) * _t +
        ki * _t -
        centerDotPulse.lift * Lee +
        aX * morphAmount;
      const Ti = (faceTurnSpring.x * _t + Kr * _t) * tiltScale + Yr * _t + wl * morphAmount;
      const Ui = _t + wre * morphAmount;
      const Si = bodyScaleSpring.x * _t + wre * morphAmount;
      nodes.face.setAttribute(
        "transform",
        `translate(${(bodyCenter + gn).toFixed(2)} ${(bodyCenter + Gn).toFixed(2)}) rotate(${Ti.toFixed(2)}) scale(${Ui.toFixed(4)} ${Si.toFixed(4)}) translate(${-bodyCenter} ${-bodyCenter})`,
      );
      const Ea = morphWeight("standby");
      const Ca = Ea > 0 ? (0.28 + 0.2 * Math.sin(now * 0.0016)) * Ea : 0;
      nodes.face.style.opacity = ((1 - (1 - centerDotPulse.tone) * Lee) * (1 - Ca)).toFixed(3);
    }
    if (((badgeSpring.t = config.state === "notifying" ? 1 : 0), nodes.badge)) {
      const _t = clampMotion(badgeSpring.x, 0, 1.4);
      _t <= 0.01
        ? (nodes.badge.style.display = "none")
        : ((nodes.badge.style.display = ""),
          (nodes.badge.style.fill = config.badgeColor),
          nodes.badge.setAttribute("cx", badgeAnchor[0].toFixed(1)),
          nodes.badge.setAttribute("cy", badgeAnchor[1].toFixed(1)),
          nodes.badge.setAttribute("r", (20 * _t).toFixed(2)));
    }
    for (const _t of morphNames) {
      const gn = morphWeight(_t);
      gn <= 0.004 ||
        (_t === "dots"
          ? renderDots(gn, now)
          : _t === "orbit"
            ? renderOrbit(gn, now)
            : _t === "radar"
              ? renderRadar(gn, now, morphEyeGap)
              : _t === "progress"
                ? renderProgress(gn, now)
                : _t === "gather"
                  ? renderGather(gn, now)
                  : _t === "wave"
                    ? renderWave(gn, now)
                    : _t === "send"
                      ? renderSend(gn, now)
                      : _t === "receive"
                        ? renderReceive(gn, now)
                        : _t === "dock"
                          ? renderDock(gn, now)
                          : _t === "pencil"
                            ? renderPencil(gn, now)
                            : _t === "bang"
                              ? renderAlert(gn, now)
                              : _t === "standby" && renderStandby(gn, now));
    }
    if (nodes.svg) {
      const _t = 1 - smoothstep(clampMotion((avatarWidth - 44) / 90, 0, 1));
      const gn = config.pose.scale;
      const Gn = morphZoomScale(activeMorph, gn);
      const Ti = outgoingMorph ? morphZoomScale(outgoingMorph, gn) : Gn;
      const Ui =
        1 + (Gn * morphTransitionAmount + Ti * (1 - morphTransitionAmount) - 1) * morphAmount * _t;
      const Si = viewBoxHalfWidth / Ui;
      const Ea = `${(viewBoxCenter - Si).toFixed(2)} ${(viewBoxCenter - Si).toFixed(2)} ${(Si * 2).toFixed(2)} ${(Si * 2).toFixed(2)}`;
      Ea !== ds && (nodes.svg.setAttribute("viewBox", Ea), (ds = Ea));
    }
    const Dee = clampMotion(hummingSpring.x, 0, 1);
    if (Dee > 0.01)
      for (let _t = 0; _t < 2; _t++) {
        const gn = nodes.parts[3 + _t];
        if (!gn) continue;
        const Gn = continuousSpinAngle * 0.85 + _t * Math.PI;
        const Ti = shape.radius * 1.3;
        const Ui = Math.cos(Gn);
        const Si = 0.55 + 0.45 * clampMotion((Ui + 1) / 2, 0, 1);

        gn.style.display = "";
        gn.setAttribute("cx", (bodyCenter + Ti * Math.sin(Gn)).toFixed(1));
        gn.setAttribute("cy", (bodyCenter - Ti * 0.38 * Math.cos(Gn) - 8).toFixed(1));
        gn.setAttribute("r", (7.5 * Si * Dee).toFixed(2));
        gn.setAttribute("opacity", ((0.3 + 0.7 * Si) * Dee).toFixed(3));
      }
  };
  const tick = (now: number) => {
    const Pt = Math.min((now - lastFrameAt) / 1e3, 0.1);

    lastFrameAt = now;
    frameDelta = Pt;

    const mt = stateMorphs[config.state] ?? null;
    mt !== lastStateMorph && ((lastStateMorph = mt), (morphStartedAt = now), (morphResting = !1));
    let Dt = mt != null;
    const Mt = config.state;

    mt &&
      cyclingMorphStates.has(Mt) &&
      (!morphResting && now - morphStartedAt > (morphDurations[Mt] ?? 2500)
        ? ((morphResting = !0), (morphRestStartedAt = now))
        : morphResting &&
          now - morphRestStartedAt > morphRestDuration &&
          ((morphResting = !1), (morphStartedAt = now)),
      (Dt = !morphResting));
    morphSpring.t = Dt ? 1 : 0;

    const Lt = () => {
      reducedMotion ||
        ((morphTurnTarget += morphHalfTurn * morphTurnDirection),
        (morphTurnSpring.t = morphTurnTarget));
    };

    mt &&
      mt !== activeMorph &&
      (activeMorph && morphSpring.x > 0.02
        ? ((previousMorph = activeMorph),
          (morphTransitionSpring.x = 0),
          (morphTransitionSpring.v = 0),
          (morphTransitionSpring.t = 1),
          reducedMotion && (morphTransitionSpring.x = 1))
        : ((previousMorph = null),
          (morphTransitionSpring.x = 1),
          (morphTransitionSpring.v = 0),
          (morphTransitionSpring.t = 1)),
      (activeMorph = mt),
      (morphAnimationStartedAt = now));
    !mt && morphSpring.x < 0.004 && ((activeMorph = null), (previousMorph = null));
    morphTransitionSpring.x > 0.996 && (previousMorph = null);
    Dt !== wasMorphing &&
      (Dt && !reducedMotion && (morphTurnDirection = Math.random() < 0.5 ? 1 : -1),
      Lt(),
      (wasMorphing = Dt));
    reducedMotion
      ? (setEyeContour(stateEyeContours[config.state][0]),
        (faceTurnSpring.t = 0),
        (faceTiltSpring.t = 0),
        (faceRollSpring.t = 0),
        (bodyScaleSpring.t = 1),
        (eyeOpenSpring.t = 1),
        (eyeSizeSpring.t = 1))
      : updateStateMotion(now);
    config.emphasis &&
      ((eyeSizeSpring.t = Math.max(eyeSizeSpring.t, 1.32)),
      (eyeOpenSpring.t = Math.max(eyeOpenSpring.t, 1.18)));

    const yn = springSubstepCount(Pt);
    const an = Pt / yn;
    for (let Zt = 0; Zt < yn; Zt++) {
      stepSpring(eyeMorphSpring, eyeMorphFrequency, 1, an);
      spinSpring && stepSpring(spinSpring, 6.2, 1, an);
      stepSpring(faceTurnSpring, 5, 0.9, an);
      stepSpring(faceTiltSpring, 3.5, 1, an);
      stepSpring(faceRollSpring, 4, 1, an);
      stepSpring(bodyScaleSpring, 10, 0.8, an);
      stepSpring(eyeOpenSpring, 26, 1, an);
      stepSpring(eyeSizeSpring, 9, 0.85, an);
      stepSpring(badgeSpring, 9, 0.55, an);
      stepSpring(hummingSpring, 6, 1, an);
      stepSpring(gazeXSpring, 13, 1, an);
      stepSpring(gazeYSpring, 13, 1, an);
      stepSpring(morphSpring, 14, 1, an);
      stepSpring(morphTransitionSpring, 11, 1, an);
      stepSpring(shapeMorphSpring, 10, 1, an);
      stepSpring(morphTurnSpring, 14, 1, an);
    }

    reducedMotion &&
      ((morphTransitionSpring.x = 1),
      (morphTurnSpring.x = morphTurnSpring.t),
      (morphSpring.x = morphSpring.t));
    renderFrame(now);
    updateSizeScale(now);

    const Et = config.state === "humming";
    const En = config.state === "loading";
    if (((hummingSpring.t = Et ? 1 : 0), (Et || En) && !reducedMotion)) {
      const Zt = (now - config.changedAt) / 1e3;
      const dn = En ? 3 : 1.6;
      const on =
        Zt < 0.5
          ? 7 * easeInOutCubic(Zt / 0.5)
          : Zt < 1.3
            ? 7 + (dn - 7) * easeInOutCubic((Zt - 0.5) / 0.8)
            : dn + 0.3 * Math.sin(Zt * 0.5);
      continuousSpinAngle += on * Pt;
    }
    if (
      (spinSpring
        ? (particleSpinAngle = spinSpring.x)
        : specialSpinAngle !== null
          ? (particleSpinAngle = specialSpinAngle)
          : (Et || En) && (particleSpinAngle = continuousSpinAngle),
      particles.update(now, Pt, {
        spinAngle: particleSpinAngle,
        sizeScale: particleSizeScale,
        wideStyle: specialSpin?.kind === "spinWild" || wideSpin || Et,
        sustainBelts: Et || En,
      }),
      config.paused &&
        !specialSpin &&
        !spinSpring &&
        bounceStartedAt < 0 &&
        !particles.hasLife() &&
        Math.abs(morphSpring.x - morphSpring.t) < 0.001 &&
        Math.abs(morphTurnSpring.t - morphTurnSpring.x) < 0.01 &&
        morphTransitionSpring.x > 0.996)
    ) {
      for (const Zt of [faceTurnSpring, faceTiltSpring, faceRollSpring, gazeXSpring, gazeYSpring]) {
        Zt.x = 0;
        Zt.v = 0;
        Zt.t = 0;
      }
      for (const Zt of [bodyScaleSpring, eyeOpenSpring, eyeSizeSpring]) {
        Zt.x = 1;
        Zt.v = 0;
        Zt.t = 1;
      }

      blinkQueue = [];
      winkStartedAt = -1e9;
      currentEyeContours = [eyeContours[0][0], eyeContours[0][1]];
      targetEyeContours = currentEyeContours;
      eyeContourIndex = 0;
      eyeMorphSpring.x = 1;
      eyeMorphSpring.v = 0;
      eyeMorphSpring.t = 1;
      renderFrame(0);
      animationFrameId = 0;

      return;
    }
    animationFrameId = requestAnimationFrame(tick);
  };

  actions = {
    spin: (ze = 1) => startSpin(ze),
    bounce: () => startBounce(),
    burst: () => {
      config.paused || particles.burst(22, 1.1, 0.3);
    },
  };
  resume = () => {
    animationFrameId === 0 &&
      ((lastFrameAt = performance.now()), (animationFrameId = requestAnimationFrame(tick)));
  };
  animationFrameId = requestAnimationFrame(tick);

  return {
    ...actions,
    resume: () => resume(),
    get running() {
      return animationFrameId !== 0;
    },
    dispose() {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
      particles.clear();
    },
  };
}
