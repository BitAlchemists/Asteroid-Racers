import type { Random } from "../random";
import { LEGACY_SPEC, validateSpec, type ModelSpec } from "./model-spec";

/** A deep copy; `sensors` only when the spec has some (so specs without sensors serialize as before). */
function copySpec(spec: ModelSpec): ModelSpec {
  return {
    inputs: [...spec.inputs],
    outputs: spec.outputs,
    ...(spec.sensors && spec.sensors.length > 0 ? { sensors: spec.sensors.map((s) => ({ ...s })) } : {}),
    ...(spec.controller ? { controller: { ...spec.controller } } : {}),
  };
}

/** How {@link MajorTom.crossover} combines two parents: per weight or per whole layer. */
export type CrossoverKind = "uniform" | "layer";

/** Weights are initialised uniformly in [-INITIAL_WEIGHT_RANGE, +INITIAL_WEIGHT_RANGE]. */
export const INITIAL_WEIGHT_RANGE = 1;

/** A mutation operator applied to every single weight (it decides itself whether to change it). */
export type WeightMutator = (weight: number, rate: number, strength: number, random: Random) => number;

/**
 * Relative mutation (the Dart default): with probability `rate`, scale the weight by
 * 1 ± strength·U(0,1); weights that get very close to 0 may flip sign.
 */
export const mutateRelative: WeightMutator = (weight, rate, strength, random) => {
  if (random() >= rate) return weight;
  let next = weight * (1 + strength * (random() * 2 - 1));
  if (Math.abs(next) < 0.001 && random() > 0.5) next = -next;
  return next;
};

/**
 * Gaussian mutation: with probability `rate`, add N(0, strength²). Unbiased (weights do not drift
 * towards 0) and signs can flip. Draws two numbers per mutated weight (Box–Muller).
 */
export const mutateGaussian: WeightMutator = (weight, rate, strength, random) => {
  if (random() >= rate) return weight;
  const u1 = 1 - random(); // (0, 1], so the log is finite
  const u2 = random();
  return weight + strength * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/** A standard normal number from two draws (Box–Muller). */
export function standardNormal(random: Random): number {
  const u1 = 1 - random(); // (0, 1], so the log is finite
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Gaussian mutation settings, with the M6 schedules (each absent = off). */
export interface GaussianMutation {
  kind: "gaussian";
  sigma: number;
  /** Chance per weight (default: the config's `mutationRate`). */
  rate?: number;
  /** σ falls from `sigma` to `to` over `over` generations, `linear` (default) or `geometric`. */
  anneal?: { to: number; over: number; shape?: "linear" | "geometric" };
  /** Each model carries its own σ, mutated log-normally before its weights. */
  selfAdapt?: boolean;
}

/** Self-adaptive σ stays within these bounds. */
export const SELF_ADAPT_BOUNDS = [1e-4, 10] as const;

/**
 * The σ the children flown in generation `g` (1-based) are mutated with: `sigma`, or with
 * `anneal` the schedule at f = min(1, (g − 1) / over): linear σ + (to − σ)·f, geometric
 * σ·(to/σ)^f.
 */
export function scheduledSigma(m: GaussianMutation, g: number): number {
  const a = m.anneal;
  if (!a) return m.sigma;
  const f = Math.min(1, Math.max(0, (g - 1) / a.over));
  return a.shape === "geometric" ? m.sigma * (a.to / m.sigma) ** f : m.sigma + (a.to - m.sigma) * f;
}

/**
 * Mutates a child for generation `g` with Gaussian mutation and its schedules. With `selfAdapt`
 * the child's σ is first set to σ_parent · exp(τ·N(0, 1)), τ = 1/√(number of weights), clamped to
 * {@link SELF_ADAPT_BOUNDS} (a model without σ starts from `sigma`), and the weights then mutate
 * with that σ.
 */
export function mutateScheduled(
  network: MajorTom,
  m: GaussianMutation,
  rate: number,
  g: number,
  random: Random,
): void {
  let sigma = scheduledSigma(m, g);
  if (m.selfAdapt) {
    const n = network.weights.reduce((total, layer) => total + layer.length, 0);
    const own = network.sigma ?? m.sigma;
    sigma = Math.min(
      SELF_ADAPT_BOUNDS[1],
      Math.max(SELF_ADAPT_BOUNDS[0], own * Math.exp(standardNormal(random) / Math.sqrt(n))),
    );
    network.sigma = sigma;
  }
  network.mutate(rate, sigma, mutateGaussian, random);
}

/** Absolute mutation: with probability `rate`, add ±strength·U(0,1) and clamp to [-1, 1]. */
export const mutateAbsolute: WeightMutator = (weight, rate, strength, random) => {
  if (random() >= rate) return weight;
  return Math.min(1, Math.max(-1, weight + (random() * 2 - 1) * strength));
};

/**
 * Serialized form — the same JSON the Dart `MajorTomSerializer` wrote to `db/<name>/luke.txt`:
 * `layers[l][n]` lists neuron n's input weights, bias first, then one per neuron of the previous layer.
 */
export interface NetworkJson {
  name?: string;
  generation?: number;
  input_neurons_count: number;
  layers: number[][][];
  /**
   * Output of the bias neuron. The Dart network's bias ("Umbral") always output 0, so its weights did
   * nothing; files written by the Dart trainer lack this field and load with 0 to behave exactly as
   * they were trained. New networks use 1.
   */
  bias_output?: number;
  /** What the inputs and outputs mean. Missing in models from before specs: they use the legacy spec. */
  spec?: ModelSpec;
  /** Self-adaptive mutation (M6): the model's own mutation σ. Training only; the game ignores it. */
  sigma?: number;
}

/**
 * "Major Tom": a fully connected feed-forward network with tanh activations, evolved (not trained by
 * backprop). Weights live in one Float64Array per layer, row-major per neuron: [bias, in_0, in_1, ...].
 */
export class MajorTom {
  name: string;
  generation = 0;
  /** Self-adaptive mutation: this model's own σ (absent = not self-adaptive; never used in flight). */
  sigma: number | undefined;
  biasOutput: number;
  /** What the inputs and outputs mean (checked against the layout when the model flies). */
  spec: ModelSpec;
  /** Neuron count per layer, input layer first. */
  readonly layout: readonly number[];
  readonly weights: Float64Array[];
  private readonly activations: Float64Array[];

  constructor(
    layout: readonly number[],
    {
      name = "Major Tom",
      biasOutput = 1,
      spec = LEGACY_SPEC,
    }: { name?: string; biasOutput?: number; spec?: ModelSpec } = {},
  ) {
    if (layout.length < 2 || layout.some((n) => !Number.isInteger(n) || n < 1)) {
      throw new Error(`invalid network layout ${JSON.stringify(layout)}`);
    }
    this.layout = [...layout];
    this.name = name;
    this.biasOutput = biasOutput;
    this.spec = copySpec(spec);
    this.weights = [];
    this.activations = [new Float64Array(layout[0]!)];
    for (let l = 1; l < layout.length; l++) {
      this.weights.push(new Float64Array(layout[l]! * (layout[l - 1]! + 1)));
      this.activations.push(new Float64Array(layout[l]!));
    }
  }

  /** A network with random weights in [-1, 1]. */
  static random(
    layout: readonly number[],
    random: Random,
    name?: string,
    spec?: ModelSpec,
    initRange = INITIAL_WEIGHT_RANGE,
  ): MajorTom {
    const network = new MajorTom(layout, {
      ...(name === undefined ? {} : { name }),
      ...(spec === undefined ? {} : { spec }),
    });
    for (const layer of network.weights) {
      for (let i = 0; i < layer.length; i++) layer[i] = initRange * (random() * 2 - 1);
    }
    return network;
  }

  get inputCount(): number {
    return this.layout[0]!;
  }

  get outputCount(): number {
    return this.layout[this.layout.length - 1]!;
  }

  /** Forward pass. The returned array is reused by the next call; copy it if you keep it. */
  activate(inputs: ArrayLike<number>): Float64Array {
    if (inputs.length !== this.inputCount) {
      throw new Error(`expected ${this.inputCount} inputs, got ${inputs.length}`);
    }
    const activations = this.activations;
    const bias = this.biasOutput;
    const first = activations[0]!;
    for (let i = 0; i < first.length; i++) first[i] = inputs[i]!;

    // Same operations in the same order as ever (bias first, then the inputs by index), with the
    // lookups hoisted out of the loops.
    let previous = first;
    for (let l = 1; l < activations.length; l++) {
      const current = activations[l]!;
      const weights = this.weights[l - 1]!;
      const width = previous.length;
      const stride = width + 1;
      for (let n = 0, row = 0; n < current.length; n++, row += stride) {
        let sum = weights[row]! * bias;
        for (let i = 0; i < width; i++) sum += weights[row + 1 + i]! * previous[i]!;
        current[n] = Math.tanh(sum);
      }
      previous = current;
    }
    return previous;
  }

  mutate(rate: number, strength: number, mutator: WeightMutator, random: Random): this {
    for (const layer of this.weights) {
      for (let i = 0; i < layer.length; i++) layer[i] = mutator(layer[i]!, rate, strength, random);
    }
    return this;
  }

  /**
   * Crossover with `other` (same layout), in place: `uniform` takes each weight from `other` with
   * probability ½ (one draw per weight), `layer` takes each whole layer from `other` with
   * probability ½ (one draw per layer).
   */
  crossover(other: MajorTom, kind: CrossoverKind, random: Random): this {
    if (other.layout.length !== this.layout.length || other.layout.some((n, i) => n !== this.layout[i]))
      throw new Error("crossover needs two networks with the same layout");
    this.weights.forEach((layer, l) => {
      const theirs = other.weights[l]!;
      if (kind === "layer") {
        if (random() < 0.5) layer.set(theirs);
        return;
      }
      for (let i = 0; i < layer.length; i++) if (random() < 0.5) layer[i] = theirs[i]!;
    });
    return this;
  }

  clone(): MajorTom {
    return MajorTom.fromJson(this.toJson());
  }

  toJson(): NetworkJson {
    const layers = this.weights.map((weights, l) => {
      const stride = this.layout[l]! + 1;
      const neurons: number[][] = [];
      for (let n = 0; n < this.layout[l + 1]!; n++)
        neurons.push(Array.from(weights.subarray(n * stride, (n + 1) * stride)));
      return neurons;
    });
    return {
      name: this.name,
      generation: this.generation,
      input_neurons_count: this.inputCount,
      layers,
      bias_output: this.biasOutput,
      spec: copySpec(this.spec),
      ...(this.sigma === undefined ? {} : { sigma: this.sigma }),
    };
  }

  static fromJson(json: NetworkJson): MajorTom {
    const layout = [json.input_neurons_count, ...json.layers.map((layer) => layer.length)];
    if (json.spec) validateSpec(json.spec, layout);
    const network = new MajorTom(layout, {
      biasOutput: json.bias_output ?? 0,
      spec: json.spec ?? LEGACY_SPEC,
    });
    network.name = json.name ?? "Major Tom";
    network.generation = json.generation ?? 0;
    if (json.sigma !== undefined) network.sigma = json.sigma;
    json.layers.forEach((layer, l) => {
      const stride = layout[l]! + 1;
      layer.forEach((neuron, n) => {
        if (neuron.length !== stride) {
          throw new Error(`layer ${l + 1} neuron ${n}: expected ${stride} weights, got ${neuron.length}`);
        }
        network.weights[l]!.set(neuron, n * stride);
      });
    });
    return network;
  }
}

/**
 * The model in a parsed JSON file: a network, a trainer `luke.txt` list (the first is used), an
 * evo-lab snapshot (`{ model }`) or a training result (`{ winner }`).
 */
export function modelFromJson(json: unknown, source = "the file"): MajorTom {
  const candidate = Array.isArray(json)
    ? json[0]
    : typeof json === "object" && json !== null && "model" in json
      ? json.model
      : typeof json === "object" && json !== null && "winner" in json
        ? json.winner
        : json;
  if (typeof candidate !== "object" || candidate === null || !("layers" in candidate))
    throw new Error(`${source} holds no model (expected a network, a luke.txt, a snapshot or a result.json)`);
  return MajorTom.fromJson(candidate as NetworkJson);
}
