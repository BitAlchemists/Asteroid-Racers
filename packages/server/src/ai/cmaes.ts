import type { Random } from "../random";
import { standardNormal } from "./network";

/**
 * CMA-ES (Hansen, "The CMA Evolution Strategy: A Tutorial", arXiv:1604.00772): a search
 * distribution N(m, σ²C) over the flat weight vector. Each generation samples λ candidates; the best
 * μ = ⌊λ/2⌋ (by rank, log weights) move the mean, adapt the step size σ (cumulative step-size
 * adaptation) and the covariance C (rank-one + rank-μ update).
 *
 * Deterministic: every random number comes from the caller's seeded generator (Box–Muller, as in
 * Gaussian mutation), the eigen-decomposition is a fixed cyclic Jacobi, and all loops run in a fixed
 * order. The whole state round-trips through {@link CmaEs.toJson} exactly (JSON keeps doubles exact),
 * so a resumed run continues bit for bit.
 *
 * `separable` (sep-CMA-ES, Ros & Hansen 2008) keeps only the diagonal of C: O(n) per sample and no
 * eigen-decomposition, with larger learning rates; meant for large n.
 */
export interface CmaEsOptions {
  /** Population λ (default 4 + ⌊3 ln n⌋). */
  population?: number;
  /** Initial step size σ₀ (default 0.3). */
  sigma?: number;
  /** Diagonal covariance (sep-CMA-ES). */
  separable?: boolean;
}

export interface CmaEsJson {
  format: "asteroid-racers/cmaes/v1";
  n: number;
  lambda: number;
  separable: boolean;
  /** Generations updated so far. */
  generation: number;
  /** Generation of the last eigen-decomposition (full C only). */
  eigenGeneration: number;
  sigma: number;
  mean: number[];
  pc: number[];
  ps: number[];
  /** Full: n×n row-major; separable: the diagonal (n). */
  C: number[];
  /** Full only: eigenvectors, n×n row-major, column j = eigenvector j. */
  B: number[];
  /** sqrt of the eigenvalues (full) or of the diagonal (separable). */
  D: number[];
}

export const CMAES_DEFAULT_SIGMA = 0.3;

export function defaultPopulation(n: number): number {
  return 4 + Math.floor(3 * Math.log(n));
}

export class CmaEs {
  readonly n: number;
  readonly lambda: number;
  readonly mu: number;
  readonly separable: boolean;
  readonly weights: Float64Array;
  readonly mueff: number;
  readonly cc: number;
  readonly cs: number;
  readonly c1: number;
  readonly cmu: number;
  readonly damps: number;
  readonly chiN: number;
  /** Generations between eigen-decompositions (full C), Hansen's lazy update. */
  readonly eigenInterval: number;

  generation = 0;
  eigenGeneration = 0;
  sigma: number;
  mean: Float64Array;
  pc: Float64Array;
  ps: Float64Array;
  C: Float64Array;
  B: Float64Array;
  D: Float64Array;
  /** The samples of the last {@link sample} call (x), needed by {@link update}. */
  private lastSamples: Float64Array[] = [];

  constructor(n: number, mean: ArrayLike<number>, options: CmaEsOptions = {}) {
    if (!Number.isInteger(n) || n < 1) throw new Error("CMA-ES needs n ≥ 1");
    this.n = n;
    this.lambda = options.population ?? defaultPopulation(n);
    if (!Number.isInteger(this.lambda) || this.lambda < 2) throw new Error("CMA-ES population must be ≥ 2");
    this.mu = Math.floor(this.lambda / 2);
    this.separable = options.separable ?? false;
    const w = new Float64Array(this.mu);
    let sum = 0;
    for (let i = 0; i < this.mu; i++) {
      w[i] = Math.log(this.mu + 0.5) - Math.log(i + 1);
      sum += w[i]!;
    }
    let sumSq = 0;
    for (let i = 0; i < this.mu; i++) {
      w[i] = w[i]! / sum;
      sumSq += w[i]! * w[i]!;
    }
    this.weights = w;
    this.mueff = 1 / sumSq;
    const N = n;
    const mueff = this.mueff;
    this.cc = (4 + mueff / N) / (N + 4 + (2 * mueff) / N);
    this.cs = (mueff + 2) / (N + mueff + 5);
    let c1 = 2 / ((N + 1.3) * (N + 1.3) + mueff);
    let cmu = Math.min(1 - c1, (2 * (mueff - 2 + 1 / mueff)) / ((N + 2) * (N + 2) + mueff));
    if (this.separable) {
      c1 = Math.min(1, (c1 * (N + 2)) / 3);
      cmu = Math.min(1 - c1, (cmu * (N + 2)) / 3);
    }
    this.c1 = c1;
    this.cmu = cmu;
    this.damps = 1 + 2 * Math.max(0, Math.sqrt((mueff - 1) / (N + 1)) - 1) + this.cs;
    this.chiN = Math.sqrt(N) * (1 - 1 / (4 * N) + 1 / (21 * N * N));
    this.eigenInterval = Math.max(1, Math.floor(1 / ((c1 + cmu) * N * 10)));

    this.sigma = options.sigma ?? CMAES_DEFAULT_SIGMA;
    if (!(this.sigma > 0)) throw new Error("CMA-ES sigma must be > 0");
    if (mean.length !== n) throw new Error(`CMA-ES mean has ${mean.length} entries, expected ${n}`);
    this.mean = Float64Array.from(mean);
    this.pc = new Float64Array(n);
    this.ps = new Float64Array(n);
    if (this.separable) {
      this.C = new Float64Array(n).fill(1);
      this.B = new Float64Array(0);
      this.D = new Float64Array(n).fill(1);
    } else {
      this.C = new Float64Array(n * n);
      this.B = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        this.C[i * n + i] = 1;
        this.B[i * n + i] = 1;
      }
      this.D = new Float64Array(n).fill(1);
    }
  }

  /** λ samples x = m + σ·B·(D ⊙ z), z ~ N(0, I) drawn in order (sample k, coordinate i). */
  sample(random: Random): Float64Array[] {
    const { n, lambda } = this;
    const z = new Float64Array(n);
    const dz = new Float64Array(n);
    const samples: Float64Array[] = [];
    for (let k = 0; k < lambda; k++) {
      for (let i = 0; i < n; i++) z[i] = standardNormal(random);
      const x = new Float64Array(n);
      if (this.separable) {
        for (let i = 0; i < n; i++) x[i] = this.mean[i]! + this.sigma * this.D[i]! * z[i]!;
      } else {
        for (let i = 0; i < n; i++) dz[i] = this.D[i]! * z[i]!;
        for (let i = 0; i < n; i++) {
          let s = 0;
          const row = i * n;
          for (let j = 0; j < n; j++) s += this.B[row + j]! * dz[j]!;
          x[i] = this.mean[i]! + this.sigma * s;
        }
      }
      samples.push(x);
    }
    this.lastSamples = samples;
    return samples;
  }

  /**
   * Updates the distribution from the last samples, given their indices ordered best first
   * (`order[0]` = best). Only the first μ are used.
   */
  update(order: readonly number[]): void {
    const { n, mu, weights, cs, cc, c1, cmu, mueff } = this;
    if (this.lastSamples.length !== this.lambda) throw new Error("CMA-ES update without a matching sample()");
    if (order.length < mu) throw new Error(`CMA-ES update needs at least ${mu} ranked samples`);
    const old = this.mean;
    const mean = new Float64Array(n);
    for (let k = 0; k < mu; k++) {
      const x = this.lastSamples[order[k]!]!;
      const w = weights[k]!;
      for (let i = 0; i < n; i++) mean[i] = mean[i]! + w * x[i]!;
    }
    const yw = new Float64Array(n);
    for (let i = 0; i < n; i++) yw[i] = (mean[i]! - old[i]!) / this.sigma;

    // C^{-1/2} y_w
    const inv = new Float64Array(n);
    if (this.separable) {
      for (let i = 0; i < n; i++) inv[i] = yw[i]! / this.D[i]!;
    } else {
      const t = new Float64Array(n);
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += this.B[i * n + j]! * yw[i]!;
        t[j] = s / this.D[j]!;
      }
      for (let i = 0; i < n; i++) {
        let s = 0;
        const row = i * n;
        for (let j = 0; j < n; j++) s += this.B[row + j]! * t[j]!;
        inv[i] = s;
      }
    }
    const csFactor = Math.sqrt(cs * (2 - cs) * mueff);
    let psNorm2 = 0;
    for (let i = 0; i < n; i++) {
      this.ps[i] = (1 - cs) * this.ps[i]! + csFactor * inv[i]!;
      psNorm2 += this.ps[i]! * this.ps[i]!;
    }
    const psNorm = Math.sqrt(psNorm2);
    const hsig =
      psNorm / Math.sqrt(1 - Math.pow(1 - cs, 2 * (this.generation + 1))) / this.chiN < 1.4 + 2 / (n + 1)
        ? 1
        : 0;
    const ccFactor = hsig * Math.sqrt(cc * (2 - cc) * mueff);
    for (let i = 0; i < n; i++) this.pc[i] = (1 - cc) * this.pc[i]! + ccFactor * yw[i]!;

    const keep = 1 - c1 - cmu;
    const hsigFix = (1 - hsig) * cc * (2 - cc);
    const ys: Float64Array[] = [];
    for (let k = 0; k < mu; k++) {
      const x = this.lastSamples[order[k]!]!;
      const y = new Float64Array(n);
      for (let i = 0; i < n; i++) y[i] = (x[i]! - old[i]!) / this.sigma;
      ys.push(y);
    }
    if (this.separable) {
      for (let i = 0; i < n; i++) {
        let rankMu = 0;
        for (let k = 0; k < mu; k++) rankMu += weights[k]! * ys[k]![i]! * ys[k]![i]!;
        const c = this.C[i]!;
        this.C[i] = keep * c + c1 * (this.pc[i]! * this.pc[i]! + hsigFix * c) + cmu * rankMu;
        this.D[i] = Math.sqrt(this.C[i]!);
      }
    } else {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          let rankMu = 0;
          for (let k = 0; k < mu; k++) rankMu += weights[k]! * ys[k]![i]! * ys[k]![j]!;
          const c = this.C[i * n + j]!;
          const v = keep * c + c1 * (this.pc[i]! * this.pc[j]! + hsigFix * c) + cmu * rankMu;
          this.C[i * n + j] = v;
          this.C[j * n + i] = v;
        }
      }
    }
    this.sigma = this.sigma * Math.exp((cs / this.damps) * (psNorm / this.chiN - 1));
    this.mean = mean;
    this.generation++;
    this.lastSamples = [];
    if (!this.separable && this.generation - this.eigenGeneration >= this.eigenInterval) this.decompose();
  }

  /** B and D from C (cyclic Jacobi); eigenvalues are floored at a tiny positive value. */
  private decompose(): void {
    const { n } = this;
    const { values, vectors } = jacobiEigen(this.C, n);
    for (let j = 0; j < n; j++) this.D[j] = Math.sqrt(Math.max(values[j]!, 1e-20));
    this.B = vectors;
    this.eigenGeneration = this.generation;
  }

  toJson(): CmaEsJson {
    return {
      format: "asteroid-racers/cmaes/v1",
      n: this.n,
      lambda: this.lambda,
      separable: this.separable,
      generation: this.generation,
      eigenGeneration: this.eigenGeneration,
      sigma: this.sigma,
      mean: Array.from(this.mean),
      pc: Array.from(this.pc),
      ps: Array.from(this.ps),
      C: Array.from(this.C),
      B: Array.from(this.B),
      D: Array.from(this.D),
    };
  }

  static fromJson(json: CmaEsJson): CmaEs {
    if (json.format !== "asteroid-racers/cmaes/v1")
      throw new Error(`unknown CMA-ES state ${String(json.format)}`);
    const cma = new CmaEs(json.n, json.mean, {
      population: json.lambda,
      sigma: json.sigma,
      separable: json.separable,
    });
    cma.generation = json.generation;
    cma.eigenGeneration = json.eigenGeneration;
    cma.pc = Float64Array.from(json.pc);
    cma.ps = Float64Array.from(json.ps);
    cma.C = Float64Array.from(json.C);
    cma.B = Float64Array.from(json.B);
    cma.D = Float64Array.from(json.D);
    return cma;
  }
}

/**
 * Eigen-decomposition of a symmetric n×n matrix (row-major) by the cyclic Jacobi method: sweeps
 * over (p, q) with p < q in fixed order, a rotation for every off-diagonal entry above a threshold,
 * until the off-diagonal sum of squares falls below 1e-30 relative to the total or after 100 sweeps.
 * Returns the eigenvalues and the eigenvectors as columns of a row-major n×n matrix, both in the
 * order Jacobi leaves them (no sorting needed by CMA-ES). Deterministic for a given input.
 */
export function jacobiEigen(
  matrix: ArrayLike<number>,
  n: number,
): { values: Float64Array; vectors: Float64Array } {
  const a = Float64Array.from(matrix);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;
  let total = 0;
  for (let i = 0; i < n * n; i++) total += a[i]! * a[i]!;
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q]! * a[p * n + q]!;
    if (off <= 1e-30 * total || off === 0) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q]!;
        if (Math.abs(apq) < 1e-300) continue;
        const app = a[p * n + p]!;
        const aqq = a[q * n + q]!;
        const theta = (aqq - app) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p]!;
          const akq = a[k * n + q]!;
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k]!;
          const aqk = a[q * n + k]!;
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p]!;
          const vkq = v[k * n + q]!;
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const values = new Float64Array(n);
  for (let i = 0; i < n; i++) values[i] = a[i * n + i]!;
  return { values, vectors: v };
}

/** The weights of a network as one flat vector, layer by layer (the order {@link setFlatWeights} reads). */
export function flatWeights(layers: readonly Float64Array[]): Float64Array {
  const n = layers.reduce((total, layer) => total + layer.length, 0);
  const out = new Float64Array(n);
  let offset = 0;
  for (const layer of layers) {
    out.set(layer, offset);
    offset += layer.length;
  }
  return out;
}

export function setFlatWeights(layers: readonly Float64Array[], flat: ArrayLike<number>): void {
  let offset = 0;
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) layer[i] = flat[offset + i]!;
    offset += layer.length;
  }
}
