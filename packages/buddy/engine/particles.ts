// Preserve the reference engine's short-circuit and comma expression evaluation order.
/* oxlint-disable no-unused-expressions */
/** Confetti and orbit belts with depth-split gradient trails. */
import { starParticleColor, starParticlePath } from "./artwork.js";
import { bodyCenter, clampMotion, randomBetween } from "./math.js";
import type { Orbit, Particle, ParticleFrame, ParticleSystemOptions, TrailPoint } from "./types.js";

const particleColors = ["#f9705c", "#5b95f0", "#3fbe86", "#f5b13f", "#9a72ee", "#35c3bd"];

const svgNamespace = "http://www.w3.org/2000/svg";

export const particleTuning = { width: 1, smallBoost: 1, length: 1, lanes: 1, hueDrift: 1 };

const trailGradientStopCount = 5;

const trailAngularStep = 0.09;

export function createParticleSystem({
  back,
  front,
  idPrefix,
  reduceMotion: reducedMotion,
  radius,
}: ParticleSystemOptions) {
  const radiusScale = () => radius() / 114.2705;
  let spinAngle = 0;
  let sizeScale = 1;
  let wideStyle = !1;
  let sustainBelts = !1;
  let lastUpdateAt = -1;
  let particles: Particle[] = [];
  const burst = (count: number = 20, strength: number = 1, swirl: number = 0) => {
    if (!(reducedMotion || !back) && !(particles.length > 120))
      for (let Y = 0; Y < count; Y++) {
        const U = (Y / count) * Math.PI * 2 + randomBetween(-0.35, 0.35);
        const ee = randomBetween(96, 116) * radiusScale();
        const te = randomBetween(170, 360) * strength;
        const ne = -Math.sin(U);
        const j = Math.cos(U);
        const Z = swirl * te * 0.2;
        const X = Math.random() < 0.18;
        particles.push({
          x: bodyCenter + Math.cos(U) * ee,
          y: bodyCenter + Math.sin(U) * ee,
          vx: Math.cos(U) * te + ne * Z,
          vy: Math.sin(U) * te + j * Z - randomBetween(20, 75),
          life: 0,
          max: randomBetween(0.45, 0.85),
          r: X ? randomBetween(4, 7) : randomBetween(3.5, 8),
          rot: randomBetween(0, 360),
          vr: randomBetween(-260, 260),
          curl: 0,
          color: X
            ? starParticleColor
            : particleColors[(Math.random() * particleColors.length) | 0],
          round: !X && Math.random() < 0.3,
          star: X,
          ret: 0,
          orbit: null,
          el: null,
        });
      }
  };
  let orbitPhase = randomBetween(0, Math.PI * 2);
  let beltEmitted = !1;
  let beltPending = !1;
  let emissionQueue: { at: number; i: number }[] = [];
  let gradientIndex = 0;
  let orbitLanes: { tilt: number; roll: number }[] = [];
  let baseHue = 0;
  let beltParticleCount = 4;
  const chooseOrbitLanes = (count: number = 1) => {
    const H = randomBetween(-0.85, 0.85);
    orbitLanes = [];
    for (let G = 0; G < count; G++)
      orbitLanes.push({
        tilt: randomBetween(0.16, 0.5),
        roll: H + (G * Math.PI) / count + randomBetween(-0.12, 0.12),
      });

    beltParticleCount = count > 1 ? count * 3 : Math.round(randomBetween(3, 5));
    baseHue = randomBetween(0, 360);
  };
  const emitOrbitParticle = (phase: number, direction: number, index: number) => {
    if (particles.length > 110) return;
    orbitLanes.length || chooseOrbitLanes();
    const Y = orbitLanes[index % orbitLanes.length];
    const U = !1;
    particles.push({
      x: bodyCenter,
      y: bodyCenter,
      vx: 0,
      vy: 0,
      ret: 0,
      life: 0,
      max: 9,
      r:
        (beltParticleCount <= 3
          ? randomBetween(8, 10.5)
          : beltParticleCount === 4
            ? randomBetween(6.6, 8.6)
            : randomBetween(5.6, 7.4)) * particleTuning.width,
      rot: randomBetween(0, 360),
      vr: randomBetween(-240, 240),
      curl: 0,
      color: particleColors[(Math.random() * particleColors.length) | 0],
      round: !U,
      star: U,
      hue: baseHue + (index * 360) / Math.max(beltParticleCount, 1) + randomBetween(-14, 14),
      hueSpan: randomBetween(45, 95) * (Math.random() < 0.5 ? 1 : -1),
      hueVel: randomBetween(18, 42) * particleTuning.hueDrift * (Math.random() < 0.5 ? 1 : -1),
      orbit: {
        lam: phase,
        lamVel: direction * randomBetween(0.5, 1.1),
        tilt: Y.tilt + randomBetween(-0.04, 0.04),
        roll: Y.roll + randomBetween(-0.05, 0.05),
        rad:
          radiusScale() * 116 +
          ((index / orbitLanes.length) | 0) *
            ((38 * particleTuning.lanes) /
              Math.max(Math.ceil(beltParticleCount / orbitLanes.length) - 1, 1)) +
          randomBetween(-1.5, 1.5),
        radVel: randomBetween(0, 2.5),
        follow: randomBetween(0.74, 0.94),
        carry: 0,
        arc: randomBetween(2.2, 3.4) * particleTuning.length,
      },
      hist: [],
      el: null,
    });
  };
  let previousSpinAngle = 0;
  let spinVelocity = 0;
  const minimumBeltVelocity = 0.9;
  const burstBeltVelocity = 5;
  const updateSpinVelocity = (delta: number) => {
    let angleDelta = spinAngle - previousSpinAngle;

    (!isFinite(angleDelta) || Math.abs(angleDelta) > 1.2) && (angleDelta = 0);
    previousSpinAngle = spinAngle;

    const wasActive = Math.abs(spinVelocity) >= minimumBeltVelocity;
    spinVelocity = delta > 0 ? angleDelta / delta : 0;
    const isActive = Math.abs(spinVelocity) >= minimumBeltVelocity;

    !wasActive &&
      isActive &&
      (chooseOrbitLanes(wideStyle ? 3 : 1), (beltEmitted = !1), (beltPending = !1));
    wasActive && !isActive && ((emissionQueue.length = 0), (beltPending = !1));
  };
  const emitBelts = (now: number) => {
    if (reducedMotion || !back) return;
    orbitPhase = spinAngle;
    const speed = Math.abs(spinVelocity);
    const hasOrbitParticles = particles.some((U) => U.orbit != null && U.ret < 1);
    if (
      (sustainBelts &&
        beltEmitted &&
        emissionQueue.length === 0 &&
        speed >= minimumBeltVelocity &&
        !hasOrbitParticles &&
        ((beltEmitted = !1), (beltPending = !0)),
      !beltEmitted &&
        (speed >= burstBeltVelocity ||
          (sustainBelts && beltPending && speed >= minimumBeltVelocity)))
    ) {
      beltEmitted = !0;
      beltPending = !1;
      emissionQueue = [];

      for (let emission = 0; emission < beltParticleCount; emission++)
        emissionQueue.push({ at: now + emission * randomBetween(55, 105), i: emission });
    }
    for (; emissionQueue.length && now >= emissionQueue[0].at;) {
      const emission = emissionQueue.shift()!;
      emitOrbitParticle(
        orbitPhase - randomBetween(0, 0.18),
        Math.sign(spinVelocity) || 1,
        emission.i,
      );
    }
  };
  const roundTenth = (value: number) => Math.round(value * 10) / 10;
  const trailPaths = (history: TrailPoint[], width: number) => {
    const count = history.length;
    let length = 0;
    for (let le = 1; le < count; le++)
      length += Math.hypot(history[le].x - history[le - 1].x, history[le].y - history[le - 1].y);
    const halfWidth = Math.min(width, length * 0.34);
    const offsetX: number[] = [];
    const offsetY: number[] = [];
    for (let le = 0; le < count; le++) {
      const Q = history[le > 0 ? le - 1 : 0];
      const ae = history[le < count - 1 ? le + 1 : count - 1];
      let ce = ae.x - Q.x;
      let xe = ae.y - Q.y;
      const Se = Math.hypot(ce, xe) || 1;

      ce /= Se;
      xe /= Se;

      const fe = (halfWidth * (0.5 + 0.5 * (le / (count - 1)))) / 2;

      offsetX.push(-xe * fe);
      offsetY.push(ce * fe);
    }
    const ne = (le: number) => {
      const Q = Math.max(Math.hypot(offsetX[le], offsetY[le]), 0.2);
      return `A${roundTenth(Q)} ${roundTenth(Q)} 0 0 0 `;
    };
    const j = (le: number, Q: number) => {
      let ae = "";
      for (let ce = le; ce <= Q; ce++)
        ae += `${ce === le ? "M" : "L"}${roundTenth(history[ce].x + offsetX[ce])} ${roundTenth(history[ce].y + offsetY[ce])}`;
      ae += Q === count - 1 ? ne(Q) : "L";
      for (let ce = Q; ce >= le; ce--)
        ae += `${ce === Q ? "" : "L"}${roundTenth(history[ce].x - offsetX[ce])} ${roundTenth(history[ce].y - offsetY[ce])}`;
      return (
        le === 0 &&
          (ae += `${ne(0)}${roundTenth(history[0].x + offsetX[0])} ${roundTenth(history[0].y + offsetY[0])}`),
        ae + "Z"
      );
    };
    if (length < 2) return { front: "", back: "" };
    let Z = "";
    let X = "";
    let se = 0;
    for (; se < count;) {
      const le = history[se].z >= 0;
      let Q = se;
      for (; Q + 1 < count && history[Q + 1].z >= 0 === le;) Q++;
      const ae = Math.max(se - 1, 0);
      const ce = Math.min(Q + 1, count - 1);
      if (ce > ae) {
        const xe = j(ae, ce);
        le ? (Z += xe) : (X += xe);
      }
      se = Q + 1;
    }
    return { front: Z, back: X };
  };
  const orbitPosition = (orbit: Orbit, phase: number) => {
    const localX = orbit.rad * Math.sin(phase);
    const localY = -orbit.rad * Math.cos(phase) * Math.sin(orbit.tilt);
    const cosRoll = Math.cos(orbit.roll);
    const sinRoll = Math.sin(orbit.roll);
    return {
      x: bodyCenter + localX * cosRoll - localY * sinRoll,
      y: bodyCenter + localX * sinRoll + localY * cosRoll,
    };
  };
  const orbitDepth = (orbit: Orbit, phase: number) => Math.cos(phase) * Math.cos(orbit.tilt);
  const stepParticles = (delta: number, elapsed: number) => {
    const backGroup = back;
    const frontGroup = front;
    if (!backGroup || !particles.length) return;
    const orbitActive = Math.abs(spinVelocity) >= minimumBeltVelocity;
    const angularVelocity = spinVelocity;
    const angleDelta = spinVelocity * delta;
    const survivors: Particle[] = [];
    for (const particle of particles) {
      particle.life += particle.life > 0 ? elapsed : delta;
      const lifeProgress = clampMotion(particle.life / particle.max, 0, 1);
      if (particle.orbit) {
        const retiring = !orbitActive || lifeProgress > 0.55;
        if (
          ((particle.ret = clampMotion(
            particle.ret + (retiring ? elapsed / 0.5 : -elapsed / 0.35),
            0,
            1,
          )),
          particle.ret >= 1)
        ) {
          particle.trailEl?.remove();
          particle.trailFrontEl?.remove();
          particle.gradEl?.remove();

          continue;
        }
      } else if (particle.life >= particle.max) {
        particle.el?.remove();
        continue;
      }
      const opacity = particle.orbit
        ? Math.min(1, particle.life / 0.26)
        : lifeProgress < 0.1
          ? lifeProgress / 0.1
          : Math.pow(1 - (lifeProgress - 0.1) / 0.9, 1.7);
      if (particle.orbit) {
        const orbit = particle.orbit;
        orbitActive
          ? ((orbit.carry = angularVelocity * orbit.follow),
            (orbit.lam += angleDelta * orbit.follow + orbit.lamVel * delta),
            (orbit.rad += orbit.radVel * delta))
          : ((orbit.lam += (orbit.carry + orbit.lamVel) * delta),
            (orbit.carry *= Math.exp(-2.6 * delta)),
            (orbit.lamVel *= Math.exp(-2.6 * delta)),
            (orbit.rad += orbit.radVel * delta));
        const xe = orbitPosition(orbit, orbit.lam);

        particle.x = xe.x;
        particle.y = xe.y;

        const Se = orbitDepth(orbit, orbit.lam);
        const fe = 0.72 + 0.28 * clampMotion(Se, 0, 1);
        const ke = Math.min(particle.life / 0.34, 1);
        const be = ke * ke * (3 - 2 * ke);
        const Ne = Math.max(
          particle.r * fe * 1.7 * sizeScale * be * (1 - 0.72 * particle.ret * particle.ret),
          0.5,
        );
        if (!particle.trailEl) {
          const de = document.createElementNS(svgNamespace, "path");

          de.setAttribute("data-trail", "");
          de.setAttribute("stroke", "none");

          const Te = document.createElementNS(svgNamespace, "linearGradient");
          const Je = `${idPrefix}t${gradientIndex++}`;

          Te.setAttribute("id", Je);
          Te.setAttribute("gradientUnits", "userSpaceOnUse");
          particle.stops = [];

          for (let Ie = 0; Ie < trailGradientStopCount; Ie++) {
            const qe = document.createElementNS(svgNamespace, "stop");

            qe.setAttribute("offset", (Ie / (trailGradientStopCount - 1)).toFixed(3));
            Te.appendChild(qe);
            particle.stops.push(qe);
          }

          backGroup.appendChild(Te);
          particle.gradEl = Te;
          de.setAttribute("fill", `url(#${Je})`);
          backGroup.appendChild(de);
          particle.trailEl = de;

          const Ce = document.createElementNS(svgNamespace, "path");

          Ce.setAttribute("data-trail", "");
          Ce.setAttribute("stroke", "none");
          Ce.setAttribute("fill", particle.trailEl.getAttribute("fill") ?? particle.color);
          frontGroup?.appendChild(Ce);
          particle.trailFrontEl = Ce;
        }
        const Ae = particle.hist!;
        const oe = Ae.length ? Ae[Ae.length - 1].l : orbit.lam;
        const ve = orbit.lam - oe;
        const ge = Math.min(Math.ceil(Math.abs(ve) / trailAngularStep), 24);
        for (let de = 1; de <= ge; de++) {
          const Te = oe + (ve * de) / ge;
          const Je = orbitPosition(orbit, Te);
          Ae.push({ x: Je.x, y: Je.y, l: Te, z: orbitDepth(orbit, Te) });
        }
        Ae.length || Ae.push({ x: particle.x, y: particle.y, l: orbit.lam, z: Se });
        const ye = orbit.arc * (1 - particle.ret * particle.ret * (3 - 2 * particle.ret));
        for (; Ae.length > 2 && Math.abs(orbit.lam - Ae[0].l) > ye;) Ae.shift();
        const ue = Math.abs(orbit.lam - Ae[0].l) - ye;
        if (Ae.length >= 2 && ue > 0) {
          const de = Ae[0].l + Math.sign(orbit.lam - Ae[0].l) * ue;
          const Te = orbitPosition(orbit, de);
          Ae[0] = { x: Te.x, y: Te.y, l: de, z: orbitDepth(orbit, de) };
        }
        if ((Ae.length > 48 && Ae.splice(0, Ae.length - 48), Ae.length >= 2)) {
          const { front: de, back: Te } = trailPaths(Ae, Ne);
          const Je = opacity.toFixed(3);
          if (
            (particle.trailEl.setAttribute("d", Te),
            particle.trailEl.setAttribute("opacity", Je),
            particle.trailFrontEl?.setAttribute("d", de),
            particle.trailFrontEl?.setAttribute("opacity", Je),
            particle.stops)
          ) {
            const qe = (particle.hue ?? 0) + (particle.hueVel ?? 0) * particle.life;
            for (let we = 0; we < particle.stops.length; we++) {
              const Pe = we / (particle.stops.length - 1);
              const je = qe + Pe * (particle.hueSpan ?? 120);
              particle.stops[we].setAttribute(
                "stop-color",
                `hsl(${(((je % 360) + 360) % 360).toFixed(0)} 56% ${(56 + 11 * Pe).toFixed(0)}%)`,
              );
            }
          }
          const Ce = Ae[0];
          const Ie = Ae[Ae.length - 1];

          particle.gradEl?.setAttribute("x1", Ce.x.toFixed(1));
          particle.gradEl?.setAttribute("y1", Ce.y.toFixed(1));
          particle.gradEl?.setAttribute("x2", Ie.x.toFixed(1));
          particle.gradEl?.setAttribute("y2", Ie.y.toFixed(1));
        } else {
          particle.trailEl.setAttribute("opacity", "0");
          particle.trailFrontEl?.setAttribute("opacity", "0");
        }
        survivors.push(particle);
        continue;
      }
      if (particle.curl) {
        const curlCosine = Math.cos(particle.curl * delta);
        const xe = Math.sin(particle.curl * delta);
        const Se = particle.vx * curlCosine - particle.vy * xe;
        const fe = particle.vx * xe + particle.vy * curlCosine;

        particle.vx = Se;
        particle.vy = fe;
      }

      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;

      const se = Math.pow(0.94, delta * 60);

      particle.vx *= se;
      particle.vy = particle.vy * se + 40 * delta;

      const le = particle.life / particle.max;
      const Q = le < 0.1 ? le / 0.1 : Math.pow(1 - (le - 0.1) / 0.9, 1.7);
      const ae = Math.max(particle.r * (1 - le * 0.4), 0.5);
      if (!particle.el) {
        const element = document.createElementNS(
          svgNamespace,
          particle.star ? "path" : particle.round ? "circle" : "rect",
        );

        particle.star && element.setAttribute("d", starParticlePath);
        element.setAttribute("fill", particle.color);
        backGroup.appendChild(element);
        particle.el = element;
      }
      if ((particle.el.setAttribute("opacity", Q.toFixed(3)), particle.star)) {
        particle.rot += particle.vr * delta;
        particle.el.setAttribute(
          "transform",
          `translate(${particle.x.toFixed(1)} ${particle.y.toFixed(1)}) rotate(${particle.rot.toFixed(1)}) scale(${ae.toFixed(2)})`,
        );
      } else if (particle.round) {
        particle.el.setAttribute("cx", particle.x.toFixed(1));
        particle.el.setAttribute("cy", particle.y.toFixed(1));
        particle.el.setAttribute("r", ae.toFixed(2));
      } else {
        const speed = Math.hypot(particle.vx, particle.vy);
        const xe = Math.max(ae * 2, Math.min(speed * 0.05, 30));
        const Se = ae * 1.5;
        const fe = (Math.atan2(particle.vy, particle.vx) * 180) / Math.PI;

        particle.el.setAttribute("width", xe.toFixed(1));
        particle.el.setAttribute("height", Se.toFixed(1));
        particle.el.setAttribute("rx", (Se / 2).toFixed(2));
        particle.el.setAttribute("x", (particle.x - xe / 2).toFixed(1));
        particle.el.setAttribute("y", (particle.y - Se / 2).toFixed(1));
        particle.el.setAttribute(
          "transform",
          `rotate(${fe.toFixed(1)} ${particle.x.toFixed(1)} ${particle.y.toFixed(1)})`,
        );
      }
      survivors.push(particle);
    }
    particles = survivors;
  };
  return {
    burst: burst,
    clear: () => {
      for (const W of particles) {
        W.el?.remove();
        W.trailEl?.remove();
        W.trailFrontEl?.remove();
        W.gradEl?.remove();
      }

      particles = [];
      emissionQueue = [];
      beltEmitted = !1;
      beltPending = !1;
    },
    update: (W: number, H: number, G: ParticleFrame) => {
      const Y = lastUpdateAt < 0 ? H : Math.max((W - lastUpdateAt) / 1e3, 0);

      lastUpdateAt = W;
      sizeScale = G.sizeScale;
      spinAngle = G.spinAngle;
      wideStyle = G.wideStyle;
      sustainBelts = G.sustainBelts === !0;
      updateSpinVelocity(H);
      emitBelts(W);
      stepParticles(H, Y);
    },
    hasLife: () => particles.length > 0 || emissionQueue.length > 0,
  };
}
