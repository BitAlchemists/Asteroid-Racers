import type { Random } from "../random";

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
}

/**
 * "Major Tom": a fully connected feed-forward network with tanh activations, evolved (not trained by
 * backprop). Weights live in one Float64Array per layer, row-major per neuron: [bias, in_0, in_1, ...].
 */
export class MajorTom {
  name: string;
  generation = 0;
  biasOutput: number;
  /** Neuron count per layer, input layer first. */
  readonly layout: readonly number[];
  readonly weights: Float64Array[];
  private readonly activations: Float64Array[];

  constructor(
    layout: readonly number[],
    { name = "Major Tom", biasOutput = 1 }: { name?: string; biasOutput?: number } = {},
  ) {
    if (layout.length < 2 || layout.some((n) => !Number.isInteger(n) || n < 1)) {
      throw new Error(`invalid network layout ${JSON.stringify(layout)}`);
    }
    this.layout = [...layout];
    this.name = name;
    this.biasOutput = biasOutput;
    this.weights = [];
    this.activations = [new Float64Array(layout[0]!)];
    for (let l = 1; l < layout.length; l++) {
      this.weights.push(new Float64Array(layout[l]! * (layout[l - 1]! + 1)));
      this.activations.push(new Float64Array(layout[l]!));
    }
  }

  /** A network with random weights in [-1, 1]. */
  static random(layout: readonly number[], random: Random, name?: string): MajorTom {
    const network = new MajorTom(layout, name === undefined ? {} : { name });
    for (const layer of network.weights) {
      for (let i = 0; i < layer.length; i++) layer[i] = INITIAL_WEIGHT_RANGE * (random() * 2 - 1);
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
    const first = this.activations[0]!;
    for (let i = 0; i < first.length; i++) first[i] = inputs[i]!;

    for (let l = 1; l < this.layout.length; l++) {
      const previous = this.activations[l - 1]!;
      const current = this.activations[l]!;
      const weights = this.weights[l - 1]!;
      const stride = previous.length + 1;
      for (let n = 0; n < current.length; n++) {
        const row = n * stride;
        let sum = weights[row]! * this.biasOutput;
        for (let i = 0; i < previous.length; i++) sum += weights[row + 1 + i]! * previous[i]!;
        current[n] = Math.tanh(sum);
      }
    }
    return this.activations[this.activations.length - 1]!;
  }

  mutate(rate: number, strength: number, mutator: WeightMutator, random: Random): this {
    for (const layer of this.weights) {
      for (let i = 0; i < layer.length; i++) layer[i] = mutator(layer[i]!, rate, strength, random);
    }
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
    };
  }

  static fromJson(json: NetworkJson): MajorTom {
    const layout = [json.input_neurons_count, ...json.layers.map((layer) => layer.length)];
    const network = new MajorTom(layout, { biasOutput: json.bias_output ?? 0 });
    network.name = json.name ?? "Major Tom";
    network.generation = json.generation ?? 0;
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
