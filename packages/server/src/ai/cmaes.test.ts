import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { CmaEs, defaultPopulation, flatWeights, jacobiEigen, setFlatWeights } from "./cmaes";

/** Minimises `f` for `generations`, returns the best value seen and the final optimiser. */
function minimise(
  f: (x: Float64Array) => number,
  n: number,
  options: { separable?: boolean; population?: number; sigma?: number },
  generations: number,
  seed = 1,
) {
  const random = seededRandom(seed);
  const cma = new CmaEs(n, new Float64Array(n).fill(3), { sigma: 1, ...options });
  let best = Infinity;
  for (let g = 0; g < generations; g++) {
    const xs = cma.sample(random);
    const fx = xs.map(f);
    best = Math.min(best, ...fx);
    const order = fx
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v || a.i - b.i)
      .map((e) => e.i);
    cma.update(order);
  }
  return { best, cma };
}

const sphere = (x: Float64Array) => x.reduce((s, v) => s + v * v, 0);
/** Ill-conditioned ellipsoid: axis i scaled by 1000^(i/(n−1)). */
const ellipsoid = (x: Float64Array) =>
  x.reduce((s, v, i) => s + Math.pow(1e6, i / (x.length - 1)) * v * v, 0);

describe("CMA-ES", () => {
  it("Jacobi: A·v = λ·v for every eigenpair, and the eigenvectors are orthonormal", () => {
    const n = 12;
    const random = seededRandom(5);
    const a = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) a[i * n + j] = a[j * n + i] = random() * 2 - 1;
    const { values, vectors } = jacobiEigen(a, n);
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        let av = 0;
        for (let j = 0; j < n; j++) av += a[i * n + j]! * vectors[j * n + k]!;
        expect(av).toBeCloseTo(values[k]! * vectors[i * n + k]!, 9);
      }
      for (let l = 0; l < n; l++) {
        let dot = 0;
        for (let i = 0; i < n; i++) dot += vectors[i * n + k]! * vectors[i * n + l]!;
        expect(dot).toBeCloseTo(k === l ? 1 : 0, 9);
      }
    }
  });

  it("converges on the sphere and on an ill-conditioned ellipsoid (full covariance)", () => {
    expect(minimise(sphere, 10, {}, 300).best).toBeLessThan(1e-10);
    // The ellipsoid needs the covariance to learn the scaling: full CMA solves it.
    expect(minimise(ellipsoid, 8, {}, 600).best).toBeLessThan(1e-8);
  });

  it("separable CMA-ES converges on the sphere and on the (axis-aligned) ellipsoid", () => {
    expect(minimise(sphere, 30, { separable: true }, 400).best).toBeLessThan(1e-8);
    expect(minimise(ellipsoid, 10, { separable: true }, 600).best).toBeLessThan(1e-8);
  });

  it("is deterministic and resumes exactly from its JSON state", () => {
    const a = minimise(sphere, 6, {}, 40, 9).cma;
    const b = minimise(sphere, 6, {}, 40, 9).cma;
    expect(JSON.stringify(a.toJson())).toBe(JSON.stringify(b.toJson()));

    // Run 20 generations, save, continue 20 more: same as 40 straight (with the same generator).
    const random = seededRandom(9);
    let cma = new CmaEs(6, new Float64Array(6).fill(3), { sigma: 1 });
    const step = () => {
      const xs = cma.sample(random);
      const fx = xs.map(sphere);
      cma.update(
        fx
          .map((v, i) => ({ v, i }))
          .sort((p, q) => p.v - q.v || p.i - q.i)
          .map((e) => e.i),
      );
    };
    for (let g = 0; g < 20; g++) step();
    cma = CmaEs.fromJson(JSON.parse(JSON.stringify(cma.toJson())));
    for (let g = 0; g < 20; g++) step();
    expect(JSON.stringify(cma.toJson())).toBe(JSON.stringify(a.toJson()));
  });

  it("defaults, flat weights round trip and argument checks", () => {
    expect(defaultPopulation(250)).toBe(4 + Math.floor(3 * Math.log(250)));
    const layers = [Float64Array.from([1, 2, 3]), Float64Array.from([4, 5])];
    const flat = flatWeights(layers);
    expect([...flat]).toEqual([1, 2, 3, 4, 5]);
    setFlatWeights(layers, [5, 4, 3, 2, 1]);
    expect([...layers[0]!, ...layers[1]!]).toEqual([5, 4, 3, 2, 1]);
    expect(() => new CmaEs(3, [0, 0], {})).toThrow(/mean/);
    expect(() => new CmaEs(3, [0, 0, 0], { population: 1 })).toThrow(/population/);
    expect(() => new CmaEs(3, [0, 0, 0], { sigma: 0 })).toThrow(/sigma/);
    const cma = new CmaEs(3, [0, 0, 0]);
    expect(() => cma.update([0, 1])).toThrow(/without a matching sample/);
  });
});
