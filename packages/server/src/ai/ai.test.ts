import { Checkpoint, EntityType, Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { GameServer } from "../game-server";
import { LocalServerConnection } from "../local-connection";
import { seededRandom } from "../random";
import { AIGameClient } from "./ai-game-client";
import { MemoryBrainStore } from "./brain-store";
import { DemoDirector } from "./directors";
import {
  LeastDistanceToTargetsEvaluator,
  QuadraticSumOfDistanceToTargetsEvaluator,
  SumOfDistanceToTargetsEvaluator,
  TimeToTargetEvaluator,
} from "./evaluators";
import {
  bundledBrains,
  createTrainingServer,
  DEFAULT_BRAIN_NAME,
  DEFAULT_LAYOUT,
  registerAIRacingService,
  registerAITrainingService,
} from "./index";
import { MajorTom, mutateAbsolute, mutateRelative, type NetworkJson } from "./network";
import { RaceTargetScript, type RaceTargetTrainingScript } from "./scripts";
import { TargetGenerator } from "./target-generator";
import { targetInputs } from "./target-vehicle-controller";

/** A random source that replays the given values (then repeats the last). */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe("MajorTom network", () => {
  it("computes tanh(bias·w0 + Σ wᵢ·xᵢ) layer by layer", () => {
    const json: NetworkJson = {
      input_neurons_count: 2,
      layers: [
        [
          [0.5, 1, -1], // hidden 0
          [0, 0.25, 0.25], // hidden 1
        ],
        [[-0.1, 2, 1]], // output
      ],
      bias_output: 1,
    };
    const net = MajorTom.fromJson(json);
    const h0 = Math.tanh(0.5 + 0.3 - 0.1);
    const h1 = Math.tanh(0.25 * 0.3 + 0.25 * 0.1);
    expect(net.activate([0.3, 0.1])[0]).toBeCloseTo(Math.tanh(-0.1 + 2 * h0 + h1), 12);
  });

  it("loads Dart-era brains with the bias switched off, exactly as they were trained", () => {
    const dart: NetworkJson = { generation: 7, name: "Luke", input_neurons_count: 1, layers: [[[5, 1]]] };
    const net = MajorTom.fromJson(dart);
    expect(net.biasOutput).toBe(0);
    expect(net.activate([0.5])[0]).toBeCloseTo(Math.tanh(0.5), 12); // the bias weight 5 has no effect
    expect(net).toMatchObject({ generation: 7, name: "Luke" });
  });

  it("round-trips through JSON in the Dart serializer layout (bias weight first)", () => {
    const net = MajorTom.random(DEFAULT_LAYOUT, seededRandom(3));
    const json = net.toJson();
    expect(json.input_neurons_count).toBe(4);
    expect(json.layers.map((l) => l.length)).toEqual([10, 8, 6, 4, 2]);
    expect(json.layers[0]![0]).toHaveLength(5); // bias + 4 inputs
    const copy = MajorTom.fromJson(JSON.parse(JSON.stringify(json)) as NetworkJson);
    const input = [0.1, 0.5, -0.3, 0.2];
    expect(Array.from(copy.activate(input))).toEqual(Array.from(net.activate(input)));
  });

  it("rejects malformed layouts and weight lists", () => {
    expect(() => new MajorTom([4])).toThrow();
    expect(() => MajorTom.fromJson({ input_neurons_count: 2, layers: [[[1, 2]]] })).toThrow(
      /expected 3 weights/,
    );
    expect(() => MajorTom.random([2, 1], Math.random).activate([1])).toThrow(/expected 2 inputs/);
  });

  it("random weights lie in [-1, 1]", () => {
    const net = MajorTom.random(DEFAULT_LAYOUT, seededRandom(9));
    for (const layer of net.weights) for (const w of layer) expect(Math.abs(w)).toBeLessThanOrEqual(1);
  });

  it("relative mutation scales by 1 ± strength and may flip tiny weights", () => {
    expect(mutateRelative(0.5, 0.1, 1, sequence(0.5))).toBe(0.5); // not selected (0.5 ≥ rate)
    expect(mutateRelative(0.5, 0.1, 1, sequence(0.05, 1))).toBeCloseTo(1, 12); // ×(1 + 1)
    expect(mutateRelative(0.5, 0.1, 1, sequence(0.05, 0))).toBeCloseTo(0, 12); // ×(1 − 1) → flips? needs > 0.5
    expect(mutateRelative(0.0005, 0.1, 0, sequence(0.05, 0.5, 0.9))).toBe(-0.0005); // tiny → sign flip
  });

  it("absolute mutation adds ±strength and clamps", () => {
    expect(mutateAbsolute(0.9, 1, 0.5, sequence(0, 1))).toBe(1);
    expect(mutateAbsolute(0, 1, 0.5, sequence(0, 0))).toBe(-0.5);
  });

  it("the bundled brain loads and steers", () => {
    const net = bundledBrains().load(DEFAULT_BRAIN_NAME)![0]!;
    expect(net.layout).toEqual(DEFAULT_LAYOUT);
    const [thrust, turn] = net.activate([0, 0.5, 0, 0]);
    expect(Math.abs(thrust!)).toBeLessThanOrEqual(1);
    expect(Math.abs(turn!)).toBeLessThanOrEqual(1);
  });
});

describe("targetInputs", () => {
  function ship(orientation: number, velocity = Vector2.zero()): Movable {
    const m = new Movable();
    m.orientation = orientation;
    m.velocity = velocity;
    return m;
  }

  it("measures the target angle relative to the nose (+y at orientation 0), in half turns", () => {
    expect(targetInputs(ship(0), new Vector2(0, 100))[0]).toBeCloseTo(0, 12); // dead ahead
    expect(targetInputs(ship(0), new Vector2(100, 0))[0]).toBeCloseTo(-0.5, 12); // quarter turn
    expect(targetInputs(ship(0), new Vector2(-100, 0))[0]).toBeCloseTo(0.5, 12);
    expect(Math.abs(targetInputs(ship(0), new Vector2(0, -100))[0])).toBeCloseTo(1, 12); // behind
    expect(targetInputs(ship(Math.PI / 2), new Vector2(-100, 0))[0]).toBeCloseTo(0, 12); // turned towards it
  });

  it("scales distance and speed by 1/1000 and gives the velocity direction", () => {
    const [, distance, velocityAngle, speed] = targetInputs(
      ship(0, new Vector2(0, 300)),
      new Vector2(300, 400),
    );
    expect(distance).toBeCloseTo(0.5, 12);
    expect(velocityAngle).toBeCloseTo(0, 12);
    expect(speed).toBeCloseTo(0.3, 12);
  });

  it("always stays within [-1, 1] for angles", () => {
    const random = seededRandom(5);
    for (let i = 0; i < 500; i++) {
      const s = ship(random() * 20 - 10, new Vector2(random() - 0.5, random() - 0.5));
      const [a, , v] = targetInputs(s, new Vector2(random() * 2000 - 1000, random() * 2000 - 1000));
      expect(Math.abs(a)).toBeLessThanOrEqual(1);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });
});

describe("AIGameClient", () => {
  it("connects like a real client and keeps track of ships, checkpoints and its own ship", async () => {
    const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
    const bot = new AIGameClient(new LocalServerConnection(server, { delivery: "sync" }), "Bot");
    await bot.connect();
    expect(bot.ship?.displayName).toBe("Bot");
    expect([...bot.entities.values()].some((e) => e.type === EntityType.CHECKPOINT)).toBe(true);
    expect([...bot.entities.values()].some((e) => e.type === EntityType.ASTEROID)).toBe(false);

    const human = new AIGameClient(new LocalServerConnection(server, { delivery: "sync" }), "Human");
    await human.connect();
    for (let i = 0; i < 5; i++) server.tick();
    expect([...bot.otherShips].map((s) => s.displayName)).toContain("Human");
    human.disconnect();
    expect([...bot.otherShips].map((s) => s.displayName)).not.toContain("Human");
  });

  it("connect() rejects when the server drops it before the handshake completes", async () => {
    const server = new GameServer();
    const connection = new LocalServerConnection(server, { delivery: "sync" });
    const bot = new AIGameClient(connection);
    const pending = bot.connect();
    connection.disconnect();
    await expect(pending).rejects.toThrow();
  });

  it("ghost bots fly through asteroids", async () => {
    const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
    const bot = new AIGameClient(new LocalServerConnection(server, { delivery: "sync", canCollide: false }));
    await bot.connect();
    const proxy = [...server.clients][0]!;
    server.teleportPlayerTo(proxy, server.world.passiveCollisionEntities[0]!.position, 0);
    server.tick();
    expect(proxy.movable!.canMove).toBe(true);
  });
});

describe("evaluators", () => {
  function fakeScript(shipAt: Vector2, target: Checkpoint, rotationSpeed = 0) {
    const ship = new Movable({ position: shipAt });
    ship.rotationSpeed = rotationSpeed;
    return { currentTarget: target, client: { ship } } as unknown as RaceTargetTrainingScript;
  }

  it("score distance (and spin) over time; lower is better", () => {
    const target = new Checkpoint({ position: new Vector2(0, 0) });
    const far = fakeScript(new Vector2(300, 400), target, -2);
    const near = fakeScript(new Vector2(30, 40), target);

    const quadratic = new QuadraticSumOfDistanceToTargetsEvaluator();
    quadratic.evaluate(far, 0.5);
    expect(quadratic.finalScore).toBeCloseTo((500 + 2) * 0.5, 12);

    const sum = new SumOfDistanceToTargetsEvaluator();
    sum.evaluate(far, 0.5);
    expect(sum.finalScore).toBeCloseTo(250, 12);

    const least = new LeastDistanceToTargetsEvaluator();
    least.evaluate(far, 0.1);
    least.evaluate(near, 0.1);
    expect(least.finalScore).toBeCloseTo(50, 12);

    const time = new TimeToTargetEvaluator();
    time.evaluate(far, 0.25);
    time.evaluate(far, 0.25);
    expect(time.finalScore).toBe(0.5);
  });
});

describe("TargetGenerator", () => {
  it("builds the 16-target training course on rings up to 1000 units", () => {
    const server = createTrainingServer(1);
    const course = TargetGenerator.fluxCompensator(server, seededRandom(2));
    expect(course).toHaveLength(16);
    expect(course[0]!.position).toEqual(Vector2.zero());
    expect(Math.max(...course.map((c) => c.position.length))).toBeCloseTo(1000, 9);
    expect(course.every((c) => c.radius === 30 && server.world.entities.has(c.id))).toBe(true);
    TargetGenerator.teardown(server, course);
    expect(server.world.entities.size).toBe(0);
  });
});

describe("TrainingDirector", () => {
  async function train(store: MemoryBrainStore, generations: number, seed = 1) {
    const server = createTrainingServer(seed);
    const reports: { generation: number; best: number; brainGeneration: number; sampleSize: number }[] = [];
    const director = registerAITrainingService(server, {
      store,
      sampleSize: 6,
      framesPerTarget: 30,
      maxGenerations: generations,
      random: seededRandom(seed + 1),
      onGeneration: (r) =>
        reports.push({
          generation: r.generation,
          best: r.bestScore,
          brainGeneration: r.brainGeneration,
          sampleSize: r.sampleSize,
        }),
    });
    await server.start();
    let done = false;
    void director.done.then(() => (done = true));
    for (let guard = 0; !done && guard < 100_000; guard++) {
      server.tick();
      if (guard % 20 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }
    expect(done).toBe(true);
    return { server, director, reports };
  }

  it("evolves generations, saving each winner, and continues from the stored brain", async () => {
    const store = new MemoryBrainStore();
    const first = await train(store, 2);
    expect(first.reports.map((r) => r.generation)).toEqual([1, 2]);
    expect(first.reports.every((r) => r.sampleSize === 6)).toBe(true);
    expect(first.director.botCount).toBe(0); // every bot disconnected after its flight
    expect(first.server.clients.size).toBe(0);

    const saved = store.load(DEFAULT_BRAIN_NAME)!;
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toBe("Winner from last round");

    // The winner is always part of the next generation, so the best score never gets worse.
    expect(first.reports[1]!.best).toBeLessThanOrEqual(first.reports[0]!.best + 1e-9);

    const second = await train(store, 1, 1);
    expect(second.reports[0]!.brainGeneration).toBeGreaterThanOrEqual(saved[0]!.generation);
  });

  it("candidates are the stored parent plus mutated, renamed children", () => {
    const parent = MajorTom.random(DEFAULT_LAYOUT, seededRandom(4), "Parent");
    parent.generation = 3;
    const store = new MemoryBrainStore();
    store.save(DEFAULT_BRAIN_NAME, [parent]);
    const director = registerAITrainingService(createTrainingServer(1), { store, sampleSize: 5 });
    const candidates = director.createCandidates();
    expect(candidates).toHaveLength(5);
    expect(candidates[0]!.name).toBe("Parent");
    expect(candidates.slice(1).every((c) => c.generation === 4 && c.name.startsWith("Major Tom #"))).toBe(
      true,
    );
    expect(candidates.slice(1).some((c) => c.weights[0]!.some((w, i) => w !== parent.weights[0]![i]))).toBe(
      true,
    );
  });
});

describe("racing bots", () => {
  it("a racing bot targets the portal, joins the race and chases the announced checkpoint", async () => {
    const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
    const director = registerAIRacingService(server, bundledBrains(), { delaySeconds: 0.5 });
    await server.start();
    const flush = () => new Promise<void>((r) => setTimeout(r, 0));
    await flush(); // bot connects and handshakes (microtask delivery)
    expect(director.botCount).toBe(1);
    const bot = [...server.clients][0]!;
    expect(bot.playerName).toBe("Major Tom");

    // Put it on the portal (where its own flight would take it) and let the race pick it up.
    server.teleportPlayerTo(bot, server.raceController!.start!.position, 0);
    server.tick();
    await flush();
    expect(server.raceController!.isClientInRace(bot)).toBe(true);
    const ship = bot.movable!;
    expect(ship.acceleration.length + Math.abs(ship.rotationSpeed)).toBe(0); // still waiting out the delay

    for (let i = 0; i < 50; i++) {
      server.tick();
      await flush();
    }
    // After the delay the network steers towards the announced checkpoint.
    expect(ship.acceleration.length + Math.abs(ship.rotationSpeed)).toBeGreaterThan(0);

    director.stop();
    await flush();
    expect(server.clients.size).toBe(0);
  });

  it("without a brain the demo director shows nothing", async () => {
    const server = new GameServer();
    const director = new DemoDirector("missing", new MemoryBrainStore());
    director.scriptFactories.push((n) => new RaceTargetScript(n));
    server.registerService(director);
    await server.start();
    server.tick();
    expect(director.botCount).toBe(0);
  });
});
