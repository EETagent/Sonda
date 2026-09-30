// Preserve the reference engine's short-circuit and comma expression evaluation order.
/* oxlint-disable no-unused-expressions */
/** SVG paths, contour sampling, face fitting, and solid projection. */
import { bodyCenter, clampGeometry, fullTurn, roundHundredth } from "./math.js";
import type { Circle, FaceFit, Point, ShapeGeometry, ShapeOptions, SolidSphere } from "./types.js";

export const interpolateContours = (from: Point[], to: Point[], progress: number): Point[] =>
  from.map(([s, r], i) => [s + (to[i][0] - s) * progress, r + (to[i][1] - r) * progress]);

export const polygonPath = (points: Point[]) =>
  "M" + points.map((e) => `${e[0].toFixed(2)} ${e[1].toFixed(2)}`).join("L") + "Z";

export const contourCentroid = (points: Point[]): Point => {
  let sumX = 0;
  let sumY = 0;
  for (const [s, r] of points) {
    sumX += s;
    sumY += r;
  }
  return [sumX / points.length, sumY / points.length];
};

class SvgPathBuilder {
  d = "";
  x = 0;
  y = 0;
  move(x: number, y: number) {
    return (
      (this.d += `M${roundHundredth(x)} ${roundHundredth(y)}`), (this.x = x), (this.y = y), this
    );
  }
  line(x: number, y: number) {
    return (
      (this.d += `L${roundHundredth(x)} ${roundHundredth(y)}`), (this.x = x), (this.y = y), this
    );
  }
  curve(
    control1X: number,
    control1Y: number,
    control2X: number,
    control2Y: number,
    x: number,
    y: number,
  ) {
    return (
      (this.d += `C${roundHundredth(control1X)} ${roundHundredth(control1Y)} ${roundHundredth(control2X)} ${roundHundredth(control2Y)} ${roundHundredth(x)} ${roundHundredth(y)}`),
      (this.x = x),
      (this.y = y),
      this
    );
  }
  corner(previous: Point, vertex: Point, next: Point, radius: number) {
    const i = (d: Point, m: Point) => {
      const f = d[0] - m[0];
      const h = d[1] - m[1];
      const y = Math.hypot(f, h) || 1;
      return [f / y, h / y];
    };
    const o = i(previous, vertex);
    const l = i(next, vertex);
    const c = [vertex[0] + o[0] * radius, vertex[1] + o[1] * radius];
    const u = [vertex[0] + l[0] * radius, vertex[1] + l[1] * radius];
    return (
      this.d ? this.line(c[0], c[1]) : this.move(c[0], c[1]),
      (this.d += `Q${roundHundredth(vertex[0])} ${roundHundredth(vertex[1])} ${roundHundredth(u[0])} ${roundHundredth(u[1])}`),
      (this.x = u[0]),
      (this.y = u[1]),
      this
    );
  }
  arc(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    startAngle: number,
    endAngle: number,
  ) {
    const l = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / (Math.PI / 2)));
    const c = (endAngle - startAngle) / l;
    const u = (4 / 3) * Math.tan(c / 4);
    let d = startAngle;
    for (let m = 0; m < l; m++) {
      const f = d + c;
      const h = [centerX + radiusX * Math.cos(d), centerY + radiusY * Math.sin(d)];
      const y = [centerX + radiusX * Math.cos(f), centerY + radiusY * Math.sin(f)];

      this.curve(
        h[0] - u * radiusX * Math.sin(d),
        h[1] + u * radiusY * Math.cos(d),
        y[0] + u * radiusX * Math.sin(f),
        y[1] - u * radiusY * Math.cos(f),
        y[0],
        y[1],
      );
      d = f;
    }
    return this;
  }
  close() {
    return this.d + "Z";
  }
}

const closedSplinePath = (points: Point[]) => {
  const count = points.length;
  let path = `M${roundHundredth(points[0][0])} ${roundHundredth(points[0][1])}`;
  for (let index = 0; index < count; index++) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const afterNext = points[(index + 2) % count];
    path += `C${roundHundredth(current[0] + (next[0] - previous[0]) / 6)} ${roundHundredth(current[1] + (next[1] - previous[1]) / 6)} ${roundHundredth(next[0] - (afterNext[0] - current[0]) / 6)} ${roundHundredth(next[1] - (afterNext[1] - current[1]) / 6)} ${roundHundredth(next[0])} ${roundHundredth(next[1])}`;
  }
  return path + "Z";
};

const samplePolarPath = (sample: (angle: number) => Point, count: number = 128) => {
  const points = [];
  for (let index = 0; index < count; index++) points.push(sample((index / count) * fullTurn));
  return closedSplinePath(points);
};

export const roundedPolygonPath = (points: Point[], radii: number | number[]) => {
  const builder = new SvgPathBuilder();
  const count = points.length;
  for (let index = 0; index < count; index++) {
    const radius = typeof radii == "number" ? radii : radii[index % radii.length];
    builder.corner(
      points[(index - 1 + count) % count],
      points[index],
      points[(index + 1) % count],
      radius,
    );
  }
  return builder.close();
};

export const regularPolygonPath = (
  radius: number,
  sides: number,
  cornerRadius: number,
  rotation: number = 0,
) =>
  roundedPolygonPath(
    Array.from({ length: sides }, (r, i) => {
      const angle = rotation + (i / sides) * fullTurn;
      return [bodyCenter + Math.cos(angle) * radius, bodyCenter + Math.sin(angle) * radius];
    }),
    cornerRadius,
  );

export const circleUnionPath = (circles: Circle[], count: number = 160) =>
  samplePolarPath((t) => {
    const s = Math.cos(t);
    const r = Math.sin(t);
    let i = 0;
    for (const [o, l, c] of circles) {
      const u = o - bodyCenter;
      const d = l - bodyCenter;
      const m = s * u + r * d;
      const f = m * m - (u * u + d * d) + c * c;
      if (f <= 0) continue;
      const h = m + Math.sqrt(f);
      h > i && (i = h);
    }
    return [bodyCenter + s * i, bodyCenter + r * i];
  }, count);

export const superellipsePath = (halfWidth: number, halfHeight: number, exponent: number) =>
  samplePolarPath((s) => {
    const cosine = Math.cos(s);
    const sine = Math.sin(s);
    return [
      bodyCenter + Math.sign(cosine) * Math.pow(Math.abs(cosine), 2 / exponent) * halfWidth,
      bodyCenter + Math.sign(sine) * Math.pow(Math.abs(sine), 2 / exponent) * halfHeight,
    ];
  });

export const horizontalCapsulePath = (halfWidth: number, radius: number) =>
  new SvgPathBuilder()
    .move(bodyCenter - halfWidth + radius, bodyCenter - radius)
    .line(bodyCenter + halfWidth - radius, bodyCenter - radius)
    .arc(bodyCenter + halfWidth - radius, bodyCenter, radius, radius, -Math.PI / 2, Math.PI / 2)
    .line(bodyCenter - halfWidth + radius, bodyCenter + radius)
    .arc(
      bodyCenter - halfWidth + radius,
      bodyCenter,
      radius,
      radius,
      Math.PI / 2,
      (Math.PI * 3) / 2,
    )
    .close();

export const verticalCapsulePath = (radius: number, halfHeight: number) =>
  new SvgPathBuilder()
    .move(bodyCenter - radius, bodyCenter + halfHeight - radius)
    .line(bodyCenter - radius, bodyCenter - halfHeight + radius)
    .arc(bodyCenter, bodyCenter - halfHeight + radius, radius, radius, Math.PI, fullTurn)
    .line(bodyCenter + radius, bodyCenter + halfHeight - radius)
    .arc(bodyCenter, bodyCenter + halfHeight - radius, radius, radius, 0, Math.PI)
    .close();

export const cylinderPath = (halfWidth: number, halfHeight: number, capRadius: number) =>
  new SvgPathBuilder()
    .move(bodyCenter - halfWidth, bodyCenter - halfHeight + capRadius)
    .arc(bodyCenter, bodyCenter - halfHeight + capRadius, halfWidth, capRadius, Math.PI, fullTurn)
    .line(bodyCenter + halfWidth, bodyCenter + halfHeight - capRadius)
    .arc(bodyCenter, bodyCenter + halfHeight - capRadius, halfWidth, capRadius, 0, Math.PI)
    .close();

export const domePath = (halfWidth: number, halfHeight: number, cornerRadius: number) => {
  const s = bodyCenter + halfHeight;
  return new SvgPathBuilder()
    .move(bodyCenter - halfWidth, s - cornerRadius)
    .arc(bodyCenter, s - cornerRadius, halfWidth, 2 * halfHeight - cornerRadius, Math.PI, fullTurn)
    .line(bodyCenter + halfWidth, s - cornerRadius)
    .curve(
      bodyCenter + halfWidth,
      s,
      bodyCenter + halfWidth,
      s,
      bodyCenter + halfWidth - cornerRadius,
      s,
    )
    .line(bodyCenter - halfWidth + cornerRadius, s)
    .curve(
      bodyCenter - halfWidth,
      s,
      bodyCenter - halfWidth,
      s,
      bodyCenter - halfWidth,
      s - cornerRadius,
    )
    .close();
};

export const archPath = (radius: number, halfHeight: number, cornerRadius: number) => {
  const s = bodyCenter + halfHeight;
  const r = bodyCenter - halfHeight + radius;
  return new SvgPathBuilder()
    .move(bodyCenter - radius, r)
    .arc(bodyCenter, r, radius, radius, Math.PI, fullTurn)
    .line(bodyCenter + radius, s - cornerRadius)
    .curve(bodyCenter + radius, s, bodyCenter + radius, s, bodyCenter + radius - cornerRadius, s)
    .line(bodyCenter - radius + cornerRadius, s)
    .curve(bodyCenter - radius, s, bodyCenter - radius, s, bodyCenter - radius, s - cornerRadius)
    .close();
};

export const shieldPath = (halfWidth: number, halfHeight: number, cornerRadius: number) => {
  const s = bodyCenter - halfHeight;
  const r = bodyCenter + halfHeight;
  return new SvgPathBuilder()
    .move(bodyCenter - halfWidth, s + cornerRadius)
    .curve(bodyCenter - halfWidth, s - 2, bodyCenter - halfWidth * 0.5, s - 10, bodyCenter, s - 10)
    .curve(
      bodyCenter + halfWidth * 0.5,
      s - 10,
      bodyCenter + halfWidth,
      s - 2,
      bodyCenter + halfWidth,
      s + cornerRadius,
    )
    .curve(
      bodyCenter + halfWidth,
      bodyCenter + halfHeight * 0.42,
      bodyCenter + halfWidth * 0.62,
      r,
      bodyCenter,
      r,
    )
    .curve(
      bodyCenter - halfWidth * 0.62,
      r,
      bodyCenter - halfWidth,
      bodyCenter + halfHeight * 0.42,
      bodyCenter - halfWidth,
      s + cornerRadius,
    )
    .close();
};

export const eggPath = (halfWidth: number, halfHeight: number, taper: number) =>
  samplePolarPath((s) => {
    const r = Math.cos(s);
    const i = Math.sin(s);
    const o = (1 - i) / 2;
    return [bodyCenter + r * halfWidth * (1 - taper * o * o), bodyCenter + i * halfHeight];
  });

export const teardropPath = (
  radius: number,
  tipY: number,
  circleY: number,
  cornerRadius: number,
) => {
  const r = clampGeometry(radius / (circleY - tipY), -1, 1);
  const i = Math.sqrt(1 - r * r);
  const o: Point = [bodyCenter + radius * i, circleY - radius * r];
  const l: Point = [bodyCenter - radius * i, circleY - radius * r];
  const c = Math.atan2(o[1] - circleY, o[0] - bodyCenter);
  return new SvgPathBuilder()
    .corner(o, [bodyCenter, tipY], l, cornerRadius)
    .line(l[0], l[1])
    .arc(bodyCenter, circleY, radius, radius, Math.PI - c, c)
    .close();
};

export const leafPath = (halfWidth: number, halfHeight: number, exponent: number) =>
  samplePolarPath((s) => {
    const r = Math.cos(s);
    const i = Math.sin(s);
    return [
      bodyCenter + r * halfWidth * Math.pow(Math.max(1 - i * i, 0), exponent / 2 - 0.5) * 1,
      bodyCenter + i * halfHeight,
    ];
  });

export const beanPath = (
  halfWidth: number,
  halfHeight: number,
  indent: number,
  indentAngle: number,
) =>
  samplePolarPath((r) => {
    const i = (l: number) => {
      const c = Math.abs(((((r - l + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI);
      return Math.exp(-(c * c) / 0.4232);
    };
    const o = 1 - indent * i(indentAngle) + indent * 0.34 * i(indentAngle + Math.PI);
    return [bodyCenter + Math.cos(r) * halfWidth * o, bodyCenter + Math.sin(r) * halfHeight * o];
  });

export const pebblePath = (radius: number, irregularity: number, phase: number) =>
  samplePolarPath((s) => {
    const r =
      radius * (1 + irregularity * (Math.sin(s * 2 + phase) * 0.6 + Math.sin(s * 3 - phase) * 0.4));
    return [bodyCenter + Math.cos(s) * r, bodyCenter + Math.sin(s) * r * 0.98];
  });

const sampleSvgPath = (path: string, spacing: number = 4): Point[] => {
  const t = path.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const s: Point[] = [];
  let r = 0;
  let i = "";
  let o = 0;
  let l = 0;
  let c = 0;
  let u = 0;
  const d = () => parseFloat(t[r++]);
  const m = (f: (fraction: number) => Point, h: number) => {
    const y = Math.max(2, Math.ceil(h / spacing));
    for (let k = 1; k <= y; k++) s.push(f(k / y));
  };
  for (; r < t.length;) {
    if ((/[a-z]/i.test(t[r]) && (i = t[r++].toUpperCase()), i === "Z")) {
      Math.hypot(c - o, u - l) > 0.01 &&
        m((f) => [o + (c - o) * f, l + (u - l) * f], Math.hypot(c - o, u - l));
      o = c;
      l = u;

      continue;
    }
    if (r >= t.length) break;
    if (i === "M") {
      o = d();
      l = d();
      c = o;
      u = l;
      s.push([o, l]);
      i = "L";
    } else if (i === "L") {
      const f = d();
      const h = d();

      m((y) => [o + (f - o) * y, l + (h - l) * y], Math.hypot(f - o, h - l));
      o = f;
      l = h;
    } else if (i === "Q") {
      const f = d();
      const h = d();
      const y = d();
      const k = d();
      const v = o;
      const b = l;

      m(
        (x) => {
          const N = 1 - x;
          return [N * N * v + 2 * N * x * f + x * x * y, N * N * b + 2 * N * x * h + x * x * k];
        },
        Math.hypot(f - o, h - l) + Math.hypot(y - f, k - h),
      );
      o = y;
      l = k;
    } else if (i === "C") {
      const f = d();
      const h = d();
      const y = d();
      const k = d();
      const v = d();
      const b = d();
      const x = o;
      const N = l;

      m(
        (E) => {
          const A = 1 - E;
          return [
            A * A * A * x + 3 * A * A * E * f + 3 * A * E * E * y + E * E * E * v,
            A * A * A * N + 3 * A * A * E * h + 3 * A * E * E * k + E * E * E * b,
          ];
        },
        Math.hypot(f - o, h - l) + Math.hypot(y - f, k - h) + Math.hypot(v - y, b - k),
      );
      o = v;
      l = b;
    } else r++;
  }
  return s;
};

const buildHorizontalSpans = (points: Point[], count: number = 160) => {
  let t = 1 / 0;
  let s = -1 / 0;
  for (const m of points) {
    m[1] < t && (t = m[1]);
    m[1] > s && (s = m[1]);
  }
  const r = s - t;
  const i = (m: number) => t + (r * (m + 0.5)) / count;
  const o = new Float64Array(count);
  const l = new Float64Array(count);
  const c = new Float64Array(count);
  const u = new Float64Array(count);
  for (let m = 0; m < count; m++) {
    const f = i(m);
    let h = -1 / 0;
    let y = 1 / 0;
    let k = 1 / 0;
    let v = -1 / 0;
    for (let b = 0; b < points.length; b++) {
      const x = points[b];
      const N = points[(b + 1) % points.length];
      if (x[1] <= f == N[1] <= f) continue;
      const E = x[0] + ((N[0] - x[0]) * (f - x[1])) / (N[1] - x[1]);

      E <= bodyCenter ? E > h && (h = E) : E < y && (y = E);
      E < k && (k = E);
      E > v && (v = E);
    }

    o[m] = Number.isFinite(h) ? h : bodyCenter;
    l[m] = Number.isFinite(y) ? y : bodyCenter;
    c[m] = Number.isFinite(k) ? k : bodyCenter;
    u[m] = Number.isFinite(v) ? v : bodyCenter;
  }
  const d =
    (m: Float64Array, f: Float64Array) =>
    (h: number): Point => {
      const y = clampGeometry(((h - t) / r) * count - 0.5, 0, count - 1);
      const k = Math.floor(y);
      const v = y - k;
      const b = Math.min(k + 1, count - 1);
      return [m[k] + (m[b] - m[k]) * v, f[k] + (f[b] - f[k]) * v];
    };
  return { top: t, bottom: s, spanAt: d(o, l), outerAt: d(c, u) };
};

const faceAspectRatios = [1 / 1.45, 1 / 1.25, 1 / 1.12, 1, 1.12, 1.25, 1.45];

const fitFace = (points: Point[]) => {
  const e: Point[] = [];
  for (let c = 0; c < points.length; c += Math.max(1, Math.round(points.length / 110)))
    e.push(points[c]);
  let t = { score: -1, x: bodyCenter, y: bodyCenter, a: 1, b: 1 };
  const s = (c: number, u: number, d: number) => {
    let m = 1 / 0;
    for (const y of e) {
      const k = y[0] - c;
      const v = (y[1] - u) * d;
      const b = k * k + v * v;
      b < m && (m = b);
    }
    m = Math.sqrt(m);
    const f = m / d;
    const h = m * f * (1 - 0.0018 * Math.abs(u - bodyCenter) - 0.004 * Math.abs(c - bodyCenter));
    h > t.score && (t = { score: h, x: c, y: u, a: m, b: f });
  };
  for (let c = bodyCenter - 56; c <= bodyCenter + 56; c += 8)
    for (let u = bodyCenter - 16; u <= bodyCenter + 16; u += 8)
      for (const d of faceAspectRatios) s(u, c, d);
  const { x: r, y: i } = t;
  for (let c = i - 8; c <= i + 8; c += 2)
    for (let u = r - 8; u <= r + 8; u += 2) for (const d of faceAspectRatios) s(u, c, d);
  const o = clampGeometry(t.a / bodyCenter, 0.3, 1);
  const l = clampGeometry(t.b / bodyCenter, 0.3, 1);
  return {
    x: roundHundredth(t.x - bodyCenter),
    y: roundHundredth(t.y - bodyCenter),
    sx: roundHundredth(o),
    sy: roundHundredth(l),
    eye: roundHundredth(
      clampGeometry((Math.min(o, l) * 0.7 + Math.max(o, l) * 0.3) * 1.12, 0.64, 1),
    ),
  };
};

export const ringPath = (points: Point[]) => closedSplinePath(points);

const projectSolidRadii = (spheres: SolidSphere[], angle: number) => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const projectedCircles = spheres.map(([l, c, u, d]) => [l * cosine + u * sine, c, d]);
  const radii = Array.from({ length: ringSampleCount }, (l, c) => {
    const u = (c / ringSampleCount) * fullTurn;
    const d = Math.cos(u);
    const m = Math.sin(u);
    let f = 0;
    for (const [h, y, k] of projectedCircles) {
      const v = d * h + m * y;
      const b = v * v - (h * h + y * y) + k * k;
      if (b <= 0) continue;
      const x = v + Math.sqrt(b);
      x > f && (f = x);
    }
    return f;
  });
  const count = radii.length;
  return radii.map(
    (l, c) =>
      (radii[(c - 2 + count) % count] +
        4 * radii[(c - 1 + count) % count] +
        6 * radii[c] +
        4 * radii[(c + 1) % count] +
        radii[(c + 2) % count]) /
      16,
  );
};

const polygonTurnScale = (sides: number, angle: number) => {
  const t = fullTurn / sides;
  const s = (((angle % t) + t) % t) - t / 2;
  return Math.cos(s) / Math.cos(t / 2);
};

const ringSampleCount = 96;

export const circleRing: Point[] = Array.from({ length: ringSampleCount }, (n, e) => {
  const t = (e / ringSampleCount) * fullTurn;
  return [bodyCenter + Math.cos(t) * bodyCenter, bodyCenter + Math.sin(t) * bodyCenter];
});

const sampleRadialContour = (points: Point[]): Point[] =>
  Array.from({ length: ringSampleCount }, (e, t) => {
    const s = (t / ringSampleCount) * fullTurn;
    const r = Math.cos(s);
    const i = Math.sin(s);
    let o = 0;
    for (let l = 0; l < points.length; l++) {
      const c = points[l];
      const u = points[(l + 1) % points.length];
      const d = c[0] - bodyCenter;
      const m = c[1] - bodyCenter;
      const f = u[0] - bodyCenter;
      const h = u[1] - bodyCenter;
      const y = (f - d) * i - (h - m) * r;
      if (Math.abs(y) < 1e-9) continue;
      const k = (d * i - m * r) / -y;
      if (k < 0 || k > 1) continue;
      const v = (d + (f - d) * k) * r + (m + (h - m) * k) * i;
      v > o && (o = v);
    }
    return [bodyCenter + r * o, bodyCenter + i * o];
  });

const estimateTiltScale = (outerSpanAt: (y: number) => Point, bottom: number) => {
  const t = (i: number) => {
    const [o, l] = outerSpanAt(bottom - i);
    return l - o;
  };
  const s = t(9);
  const r = s < 1 ? 0 : t(1) / s;
  return roundHundredth(clampGeometry(1 - 1.9 * (r - 0.36), 0.15, 1));
};

const transformPathCoordinates = (
  path: string,
  scale: number,
  offsetX: number,
  offsetY: number,
) => {
  let r = 0;
  return path.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (i) => {
    r ^= 1;
    const o = parseFloat(i) + (r ? offsetX : offsetY);
    return String(roundHundredth(bodyCenter + (o - bodyCenter) * scale));
  });
};

const normalizedBodySize = 228.44;

const normalizeBodyPath = (path: string, points: Point[]) => {
  let t = 1 / 0;
  let s = -1 / 0;
  let r = 1 / 0;
  let i = -1 / 0;
  for (const u of points) {
    u[0] < t && (t = u[0]);
    u[0] > s && (s = u[0]);
    u[1] < r && (r = u[1]);
    u[1] > i && (i = u[1]);
  }
  const o = bodyCenter - (t + s) / 2;
  const l = bodyCenter - (r + i) / 2;
  const c = clampGeometry(normalizedBodySize / Math.max(s - t, i - r), 0.9, 1.35);
  return Math.abs(c - 1) < 0.005 && Math.abs(o) < 0.5 && Math.abs(l) < 0.5
    ? path
    : transformPathCoordinates(path, c, o, l);
};

export const createShapeGeometry = (
  label: string,
  path: string,
  options: ShapeOptions = {},
): ShapeGeometry => {
  const normalizedPath = normalizeBodyPath(path, sampleSvgPath(path));
  const points = sampleSvgPath(normalizedPath);
  let radius = 0;
  for (const h of points)
    radius = Math.max(radius, Math.hypot(h[0] - bodyCenter, h[1] - bodyCenter));
  const { top: o, bottom: l, spanAt: c, outerAt: u } = buildHorizontalSpans(points);
  const ring = sampleRadialContour(points);
  let beltRadius = 0;
  for (let h = o; h <= l; h += 2) {
    const [y, k] = u(h);
    beltRadius = Math.max(beltRadius, (k - y) / 2);
  }
  const geometry: ShapeGeometry = {
    label: label,
    path: normalizedPath,
    radius: roundHundredth(radius),
    beltRadius: roundHundredth(beltRadius),
    tiltScale: estimateTiltScale(u, l),
    face: fitFace(points),
    spanAt: c,
    ring: ring,
    sides: 0,
    turnAt: null,
    top: roundHundredth(o),
    bottom: roundHundredth(l),
    ...options,
  };
  if (geometry.solid) {
    const h = projectSolidRadii(geometry.solid, 0);
    geometry.turnAt = (y) => {
      let v = projectSolidRadii(geometry.solid!, y).map((x, N) =>
        clampGeometry((x + 12) / (h[N] + 12), 0.32, 1.5),
      );
      const b = v.length;
      for (let x = 0; x < 3; x++) {
        const N = v;
        v = N.map(
          (E, A) =>
            (N[(A - 2 + b) % b] +
              4 * N[(A - 1 + b) % b] +
              6 * N[A] +
              4 * N[(A + 1) % b] +
              N[(A + 2) % b]) /
            16,
        );
      }
      return ring.map(([x, N], E) => [
        bodyCenter + (x - bodyCenter) * v[E],
        bodyCenter + (N - bodyCenter) * v[E],
      ]);
    };
  } else
    geometry.sides &&
      (geometry.turnAt = (h) => {
        const y = 1 + (polygonTurnScale(geometry.sides, h) - 1) * 0.45;
        return ring.map(([k, v]) => [bodyCenter + (k - bodyCenter) * y, v]);
      });
  return geometry;
};

export const interpolateFaceFit = (from: FaceFit, to: FaceFit, progress: number) => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
  sx: from.sx + (to.sx - from.sx) * progress,
  sy: from.sy + (to.sy - from.sy) * progress,
  eye: from.eye + (to.eye - from.eye) * progress,
  leftDX: (from.leftDX ?? 0) + ((to.leftDX ?? 0) - (from.leftDX ?? 0)) * progress,
});

const spanScratch: Point = [0, 0];

export const contourSpanAt = (points: Point[], y: number) => {
  let t = -1 / 0;
  let s = 1 / 0;
  for (let r = 0; r < points.length; r++) {
    const i = points[r];
    const o = points[(r + 1) % points.length];
    if (i[1] <= y == o[1] <= y) continue;
    const l = i[0] + ((o[0] - i[0]) * (y - i[1])) / (o[1] - i[1]);
    l <= bodyCenter ? l > t && (t = l) : l < s && (s = l);
  }
  return (
    (spanScratch[0] = Number.isFinite(t) ? t : bodyCenter),
    (spanScratch[1] = Number.isFinite(s) ? s : bodyCenter),
    spanScratch
  );
};
