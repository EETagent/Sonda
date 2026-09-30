// Preserve the reference engine's short-circuit and comma expression evaluation order.
/* oxlint-disable no-unused-expressions */
/** SVG renderers for activity morphs and their private trail state. */
import {
  bodyCenter,
  clampMotion,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  randomBetween,
} from "./math.js";
import {
  alertGlyphPath,
  dotIdleScale,
  dotOutlineScale,
  dotPulseScale,
  dotRadius,
  dotSpacing,
  pencilGlyphPath,
} from "./morphs.js";
import { morphDurations } from "./state-presets.js";
import type { BuddyEngineConfig, BuddyEngineNodes, Point } from "./types.js";

export const sendPeriod = 1500;
export const receivePeriod = 1700;

interface MorphRenderContext {
  readonly morphStartedAt: number;
  readonly morphAnimationStartedAt: number;
}

export function createMorphRenderers(
  nodes: BuddyEngineNodes,
  config: BuddyEngineConfig,
  reducedMotion: boolean,
  context: MorphRenderContext,
) {
  let pencilTrail: Point[] = [];
  let receiveCycleIndex = -1;
  let receiveAngle = -0.7;
  const br = 9;
  const waveAmplitude = (now: number) =>
    0.42 +
    0.29 * Math.sin(now * 0.0021) * Math.sin(now * 0.0034) +
    0.29 * Math.sin(now * 0.0013 + 1.7);
  const waveLaneAmplitude = (now: number, lane: number) =>
    waveAmplitude(now) * (0.55 + 0.45 * Math.sin(now * 0.012 - Math.abs(lane) * 1.05));
  const Fa = 1400;
  const dotPulse = (now: number, index: number, amount: number) => {
    const Dt = ((((now - context.morphAnimationStartedAt) / Fa + 0.119) % 1) + 1) % 1;
    let Mt = Math.abs(Dt - index / 3);
    Mt = Math.min(Mt, 1 - Mt);
    const Lt = reducedMotion ? 1 : Math.exp(-(Mt * Mt) / (2 * 0.15 * 0.15));
    const yn = reducedMotion ? 0 : 1;
    return {
      lift: Lt * br * amount * yn,
      pop: 1 + yn * (dotIdleScale + dotPulseScale * Lt - 1),
      tone: 1 - yn * 0.5 * (1 - Lt),
    };
  };
  const renderDots = (amount: number, now: number) => {
    const mt = [bodyCenter - dotSpacing, bodyCenter + dotSpacing];
    for (let Dt = 0; Dt < 2; Dt++) {
      const Mt = nodes.silhouettes[Dt];
      if (!Mt) continue;
      const Lt = clampMotion((amount - Dt * 0.12) / (1 - Dt * 0.12), 0, 1);
      if (Lt <= 0.004) {
        Mt.style.display = "none";
        continue;
      }
      const yn = easeOutCubic(Lt);
      const an = easeOutBack(Lt);
      const Et = dotPulse(now, Dt === 0 ? 0 : 2, amount);
      const En = ((dotRadius * yn * Et.pop) / bodyCenter) * dotOutlineScale;

      Mt.style.display = "";
      Mt.setAttribute(
        "transform",
        `translate(${(bodyCenter + (mt[Dt] - bodyCenter) * an).toFixed(1)} ${(bodyCenter - Et.lift).toFixed(1)}) scale(${En.toFixed(4)}) translate(${-bodyCenter} ${-bodyCenter})`,
      );
      Mt.setAttribute("opacity", (yn * Et.tone).toFixed(3));
    }
  };
  const renderOrbit = (amount: number, now: number) => {
    const mt = easeOutCubic(amount);
    const Mt = 52 * easeOutBack(amount);
    const Lt = 12;
    const yn = now * 0.0017;
    for (let an = 0; an < 5; an++) {
      const Et = nodes.parts[an];
      if (!Et) continue;
      const En = yn + (an * Math.PI * 2) / 5;
      const Zt = Math.cos(En);
      const dn = 0.5 + 0.5 * clampMotion(Zt, 0, 1);

      Et.style.display = "";
      Et.setAttribute("cx", (bodyCenter + Mt * Math.sin(En)).toFixed(1));
      Et.setAttribute("cy", (bodyCenter - Mt * 0.42 * Math.cos(En)).toFixed(1));
      Et.setAttribute("r", Math.max(Lt * dn * mt, 0.3).toFixed(2));
      Et.setAttribute("opacity", (clampMotion((Zt + 0.4) / 0.6, 0.18, 1) * mt).toFixed(3));
    }
  };
  const renderRadar = (amount: number, now: number, innerRadius: number) => {
    const Dt = easeOutCubic(amount);
    const Mt = 1300;
    const Lt = 104;
    for (let yn = 0; yn < 3; yn++) {
      const an = nodes.rings[yn];
      if (!an) continue;
      const Et = (now / Mt + yn / 3) % 1;

      an.style.display = "";
      an.removeAttribute("stroke-dasharray");
      an.removeAttribute("transform");
      an.setAttribute("r", (innerRadius + (Lt - innerRadius) * Et).toFixed(1));
      an.setAttribute("stroke-width", (3.4 * (1 - Et * 0.55)).toFixed(2));
      an.setAttribute("opacity", (Dt * (1 - Et) * 0.9).toFixed(3));
    }
  };
  const renderProgress = (amount: number, now: number) => {
    const mt = easeOutCubic(amount);
    const Dt = easeOutBack(amount);
    const Mt = 62;
    const Lt = clampMotion((now - context.morphStartedAt) / morphDurations.progress, 0, 1);
    const yn = clampMotion(Lt / 0.85, 0, 1);
    const an = nodes.rings[3];
    an &&
      ((an.style.display = ""),
      an.setAttribute("r", (Mt * Dt).toFixed(1)),
      an.setAttribute("stroke-width", "5"),
      an.removeAttribute("stroke-dasharray"),
      an.removeAttribute("transform"),
      an.setAttribute("opacity", (mt * 0.16).toFixed(3)));
    const Et = nodes.rings[4];
    if (Et) {
      const En = Mt * Dt;
      const Zt = 2 * Math.PI * En;

      Et.style.display = "";
      Et.setAttribute("r", En.toFixed(1));
      Et.setAttribute("stroke-width", "5");
      Et.setAttribute("stroke-dasharray", `${Zt.toFixed(1)}`);
      Et.setAttribute("stroke-dashoffset", (Zt * (1 - yn)).toFixed(1));
      Et.setAttribute("transform", `rotate(-90 ${bodyCenter} ${bodyCenter})`);
      Et.setAttribute("opacity", mt.toFixed(3));
    }
  };
  const renderGather = (amount: number, now: number) => {
    const mt = easeOutCubic(amount);
    const Dt = morphDurations.spawning;
    for (let Mt = 0; Mt < 5; Mt++) {
      const Lt = nodes.parts[Mt];
      if (!Lt) continue;
      const yn = clampMotion(((now - context.morphStartedAt) / Dt - Mt * 0.09) / 0.62, 0, 1);
      if (yn >= 1) {
        Lt.style.display = "none";
        continue;
      }
      const an = 1 - Math.pow(1 - yn, 3);
      const Et = Mt * 2.4 + yn * 2.2;
      const En = 96 * (1 - an);

      Lt.style.display = "";
      Lt.setAttribute("cx", (bodyCenter + En * Math.cos(Et)).toFixed(1));
      Lt.setAttribute("cy", (bodyCenter + En * Math.sin(Et) * 0.8).toFixed(1));
      Lt.setAttribute("r", (9 * (0.5 + 0.5 * an) * mt).toFixed(2));
      Lt.setAttribute("opacity", (mt * clampMotion(yn * 5, 0, 1) * (1 - an * 0.25)).toFixed(3));
    }
  };
  const renderWave = (amount: number, now: number) => {
    const mt = [-2, -1, 1, 2];
    const Dt = 44;
    for (let Mt = 0; Mt < 4; Mt++) {
      const Lt = Mt < 2 ? nodes.silhouettes[Mt] : nodes.parts[3 + Mt];
      if (!Lt) continue;
      const yn = mt[Mt];
      const an = clampMotion((amount - Math.abs(yn) * 0.1) / (1 - Math.abs(yn) * 0.1), 0, 1);
      if (an <= 0.004) {
        Lt.style.display = "none";
        continue;
      }
      const Et = easeOutBack(an);
      const En = waveLaneAmplitude(now, yn);
      const Zt = (7 + 9 * clampMotion(En, 0.08, 1)) * easeOutCubic(an);
      const dn = 6 * clampMotion(En, 0, 1) * an;
      if (((Lt.style.display = ""), Mt < 2)) {
        const on = (Zt / bodyCenter) * 1.02;

        Lt.setAttribute(
          "transform",
          `translate(${(bodyCenter + yn * Dt * Et).toFixed(1)} ${(bodyCenter - dn).toFixed(1)}) scale(${on.toFixed(4)}) translate(${-bodyCenter} ${-bodyCenter})`,
        );
        Lt.setAttribute("opacity", an.toFixed(3));
      } else {
        Lt.setAttribute("cx", (bodyCenter + yn * Dt * Et).toFixed(1));
        Lt.setAttribute("cy", (bodyCenter - dn).toFixed(1));
        Lt.setAttribute("r", Zt.toFixed(2));
        Lt.setAttribute("opacity", an.toFixed(3));
      }
    }
  };
  const renderSend = (amount: number, now: number) => {
    const mt = easeOutCubic(amount);
    const Dt = ((((now - config.changedAt) / sendPeriod) % 1) + 1) % 1;
    const Mt = clampMotion((Dt - 0.18) / 0.55, 0, 1);
    const Lt = Mt * Mt * (0.4 + 0.6 * Mt);
    const yn = 0.74;
    const an = -0.62;
    const Et = 108 * Lt;
    const En = nodes.parts[5];
    if (En) {
      const on = Mt > 0 && Mt < 1;

      En.style.display = on ? "" : "none";
      on &&
        (En.setAttribute("cx", (bodyCenter + yn * Et).toFixed(1)),
        En.setAttribute("cy", (bodyCenter + an * Et).toFixed(1)),
        En.setAttribute("r", (10 * (1 - Lt * 0.55) * mt).toFixed(2)),
        En.setAttribute("opacity", (mt * (1 - Lt * Lt)).toFixed(3)));
    }
    const Zt = nodes.parts[6];
    if (Zt) {
      const on = clampMotion((Dt - 0.26) / 0.55, 0, 1);
      const bn = on * on * (0.4 + 0.6 * on);
      const Cn = Mt > 0 && on > 0 && on < 1;
      if (((Zt.style.display = Cn ? "" : "none"), Cn)) {
        const bi = 108 * bn;

        Zt.setAttribute("cx", (bodyCenter + yn * bi).toFixed(1));
        Zt.setAttribute("cy", (bodyCenter + an * bi).toFixed(1));
        Zt.setAttribute("r", (5 * (1 - bn * 0.6) * mt).toFixed(2));
        Zt.setAttribute("opacity", (mt * 0.3 * (1 - bn)).toFixed(3));
      }
    }
    const dn = nodes.rings[5];
    if (dn) {
      const on = clampMotion((Dt - 0.18) / 0.3, 0, 1);
      const bn = on > 0 && on < 1;

      dn.style.display = bn ? "" : "none";
      bn &&
        (dn.removeAttribute("stroke-dasharray"),
        dn.removeAttribute("transform"),
        dn.setAttribute("r", (20 + 34 * easeOutCubic(on)).toFixed(1)),
        dn.setAttribute("stroke-width", (2.8 * (1 - on)).toFixed(2)),
        dn.setAttribute("opacity", (mt * (1 - on) * 0.8).toFixed(3)));
    }
  };
  const renderReceive = (amount: number, now: number) => {
    const mt = easeOutCubic(amount);
    const Dt = now - config.changedAt;
    const Mt = Math.floor(Dt / receivePeriod);
    Mt !== receiveCycleIndex &&
      ((receiveCycleIndex = Mt), (receiveAngle = randomBetween(-Math.PI * 1.25, Math.PI * 0.25)));
    const Lt = (((Dt / receivePeriod) % 1) + 1) % 1;
    const yn = clampMotion(Lt / 0.6, 0, 1);
    const an = 1 - Math.pow(1 - yn, 3);
    const Et = Math.cos(receiveAngle);
    const En = Math.sin(receiveAngle);
    const Zt = 108 * (1 - an);
    const dn = nodes.parts[5];
    if (dn) {
      const bn = yn < 1;
      if (((dn.style.display = bn ? "" : "none"), bn)) {
        const Cn = 18 * Math.sin(yn * Math.PI) * (1 - an * 0.7);

        dn.setAttribute("cx", (bodyCenter + Et * Zt + -En * Cn).toFixed(1));
        dn.setAttribute("cy", (bodyCenter + En * Zt + Et * Cn).toFixed(1));
        dn.setAttribute("r", (3.5 + 6.5 * an).toFixed(2));
        dn.setAttribute(
          "opacity",
          (mt * clampMotion(yn * 3.5, 0, 1) * (0.3 + 0.7 * an)).toFixed(3),
        );
      }
    }
    const on = nodes.rings[6];
    if (on) {
      const bn = clampMotion((Lt - 0.58) / 0.32, 0, 1);
      const Cn = bn > 0 && bn < 1;

      on.style.display = Cn ? "" : "none";
      Cn &&
        (on.removeAttribute("stroke-dasharray"),
        on.removeAttribute("transform"),
        on.setAttribute("r", (20 + 26 * easeOutCubic(bn)).toFixed(1)),
        on.setAttribute("stroke-width", (2.8 * (1 - bn)).toFixed(2)),
        on.setAttribute("opacity", (mt * (1 - bn) * 0.8).toFixed(3)));
    }
  };
  const renderDock = (amount: number, now: number) => {
    const mt = easeOutCubic(amount);
    const Dt = (now - config.changedAt) / 1e3;
    const Mt = 42;
    const Lt = 1.1;
    for (let yn = 0; yn < 2; yn++) {
      const an = nodes.parts[5 + yn];
      if (!an) continue;
      const Et = clampMotion((Dt - (0.2 + yn * 1.3)) / 0.9, 0, 1);
      if (Et <= 0) {
        an.style.display = "none";
        continue;
      }
      const En = 1 - Math.pow(1 - Et, 3);
      const Zt = now * 0.001 * Lt + yn * Math.PI;
      const dn = bodyCenter + Mt * Math.sin(Zt);
      const on = bodyCenter + Mt * 0.5 * Math.cos(Zt) + Math.sin(now * 0.003 + yn) * 2;
      const bn = bodyCenter - 120 + yn * 30;
      const Cn = bodyCenter + 95;

      an.style.display = "";
      an.setAttribute("cx", (bn + (dn - bn) * En).toFixed(1));
      an.setAttribute("cy", (Cn + (on - Cn) * En).toFixed(1));
      an.setAttribute("r", ((7 + 3 * En) * mt).toFixed(2));
      an.setAttribute("opacity", (mt * clampMotion(Et * 4, 0, 1)).toFixed(3));
    }
  };
  const Co = 2500;
  const pencilPose = (now: number) => {
    const Pt = now - config.changedAt;
    const mt = (((Pt / Co) % 1) + 1) % 1;
    if (mt < 0.68) {
      const Mt = mt / 0.68;
      const Lt = Mt * Mt * (3 - 2 * Mt);
      const yn = clampMotion(Mt / 0.08, 0, 1) * clampMotion((1 - Mt) / 0.08, 0, 1);
      return {
        x: -54 + 118 * Lt,
        y: 26,
        wig: Math.sin(Mt * 24) * 3.2 * yn,
        rot: 17 + Math.sin(Pt * 6e-4) * 1,
        lift: !1,
      };
    }
    const Dt = easeInOutCubic((mt - 0.68) / 0.32);
    return {
      x: 64 - 118 * Dt,
      y: 26 - 20 * Math.sin(Dt * Math.PI),
      wig: 0,
      rot: 17 - 2 * Math.sin(Dt * Math.PI) + Math.sin(Pt * 6e-4) * 1,
      lift: !0,
    };
  };
  const openSplinePath = (points: Point[]) => {
    const Pt = points.length;
    let mt = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    if (Pt === 2) return mt + `L${points[1][0].toFixed(1)} ${points[1][1].toFixed(1)}`;
    for (let Dt = 0; Dt < Pt - 1; Dt++) {
      const Mt = points[Math.max(Dt - 1, 0)];
      const Lt = points[Dt];
      const yn = points[Dt + 1];
      const an = points[Math.min(Dt + 2, Pt - 1)];
      const Et = Lt[0] + (yn[0] - Mt[0]) / 6;
      const En = Lt[1] + (yn[1] - Mt[1]) / 6;
      const Zt = yn[0] - (an[0] - Lt[0]) / 6;
      const dn = yn[1] - (an[1] - Lt[1]) / 6;
      mt += `C${Et.toFixed(1)} ${En.toFixed(1)} ${Zt.toFixed(1)} ${dn.toFixed(1)} ${yn[0].toFixed(1)} ${yn[1].toFixed(1)}`;
    }
    return mt;
  };
  const renderPencil = (amount: number, now: number) => {
    const mt = pencilPose(now);
    const Dt = nodes.glyphs[0];
    if (Dt) {
      const Lt = ((mt.rot - 90) * Math.PI) / 180;
      const yn = 68;
      const an = Math.cos(Lt) * yn;
      const Et = Math.sin(Lt) * yn;

      Dt.style.display = "";
      Dt.setAttribute("d", pencilGlyphPath);
      Dt.style.fill = "var(--fg)";
      Dt.setAttribute(
        "transform",
        `translate(${(bodyCenter + (mt.x + an) * amount).toFixed(1)} ${(bodyCenter + (mt.y + mt.wig * 0.15 + Et) * amount).toFixed(1)}) rotate(${(mt.rot * amount).toFixed(1)}) scale(${easeOutCubic(amount).toFixed(3)}) translate(${-bodyCenter} ${-bodyCenter})`,
      );
      Dt.setAttribute("opacity", clampMotion(amount * 1.6 - 0.3, 0, 1).toFixed(3));
    }
    if (amount > 0.6 && !mt.lift) {
      const Lt = bodyCenter + mt.x;
      const yn = bodyCenter + mt.y + mt.wig + 19;
      const an = pencilTrail[pencilTrail.length - 1];
      !an || Math.hypot(Lt - an[0], yn - an[1]) > 2.4
        ? (pencilTrail.push([Lt, yn]), pencilTrail.length > 64 && pencilTrail.shift())
        : an && ((an[0] = Lt), (an[1] = yn));
    } else pencilTrail.length && pencilTrail.splice(0, 2);
    const Mt = nodes.glyphs[1];
    Mt &&
      (pencilTrail.length < 2
        ? (Mt.style.display = "none")
        : ((Mt.style.display = ""),
          (Mt.style.fill = "none"),
          (Mt.style.stroke = "var(--fg)"),
          Mt.setAttribute("stroke-width", "6"),
          Mt.setAttribute("stroke-linecap", "round"),
          Mt.setAttribute("stroke-linejoin", "round"),
          Mt.setAttribute("d", openSplinePath(pencilTrail)),
          Mt.setAttribute("opacity", clampMotion(amount * 1.2, 0, 1).toFixed(3))));
  };
  const renderAlert = (amount: number, now: number) => {
    const mt = nodes.glyphs[2];
    if (!mt) return;
    const Dt = (now - config.changedAt) / 1e3;
    const Mt = easeOutCubic(clampMotion(amount * 1.1, 0, 1));
    const Lt = Math.exp(-(Dt % 2.2) * 5.5);
    const yn = Math.sin(Dt * 42) * 2.2 * Lt;

    mt.style.display = "";
    mt.setAttribute("d", alertGlyphPath);
    mt.style.fill = "var(--fg)";
    mt.setAttribute(
      "transform",
      `translate(0 ${(-26 - (1 - Mt) * 70).toFixed(1)}) rotate(${yn.toFixed(2)} ${bodyCenter} ${(bodyCenter - 74).toFixed(1)}) translate(${bodyCenter} ${bodyCenter}) scale(${clampMotion(amount * 1.2, 0, 1).toFixed(3)}) translate(${-bodyCenter} ${-bodyCenter})`,
    );
    mt.setAttribute("opacity", clampMotion(amount * 1.5 - 0.2, 0, 1).toFixed(3));
  };
  const renderStandby = (amount: number, now: number) => {
    const mt = easeOutCubic(amount);
    const Dt = nodes.parts[4];
    if (Dt) {
      const Lt = 0.5 + 0.5 * Math.sin(now * 0.0016);

      Dt.style.display = "";
      Dt.setAttribute("cx", `${bodyCenter}`);
      Dt.setAttribute("cy", `${bodyCenter}`);
      Dt.setAttribute("r", (26 + 7 * Lt).toFixed(1));
      Dt.setAttribute("opacity", (mt * (0.06 + 0.1 * Lt)).toFixed(3));
    }
    const Mt = nodes.rings[2];
    if (Mt) {
      const Lt = amount < 0.995;

      Mt.style.display = Lt ? "" : "none";
      Lt &&
        (Mt.removeAttribute("stroke-dasharray"),
        Mt.removeAttribute("transform"),
        Mt.setAttribute("r", (104 - 88 * mt).toFixed(1)),
        Mt.setAttribute("stroke-width", "2.4"),
        Mt.setAttribute("opacity", ((1 - mt) * 0.5).toFixed(3)));
    }
  };

  return {
    waveLaneAmplitude,
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
    reset() {
      receiveCycleIndex = -1;
      pencilTrail = [];
    },
  };
}
