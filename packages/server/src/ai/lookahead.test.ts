import { Movable, Vector2 } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { GameServer } from "../game-server";
import { seededRandom } from "../random";
import { ArenaScript } from "./arena-script";
import type { Scenario } from "./arenas";
import { placeScenario } from "./directors";
import { ExamReplay } from "./exam";
import { ENCODINGS, INPUTS, inputNames, layoutFor, lookaheadInputs, type ModelSpec } from "./model-spec";
import { MajorTom } from "./network";
import { ReplayDirector, startScript } from "./replay";
import { chainArena } from "./tier-arenas";

/** A ship at the origin, nose along +y (orientation 0). */
function ship(orientation = 0): Movable {
  return new Movable({ position: Vector2.zero(), radius: 20, orientation });
}

const spec: ModelSpec = { inputs: [...ENCODINGS.v2!, ...lookaheadInputs(2)], outputs: "thrustTurn" };
const model = () => MajorTom.random(layoutFor(spec, [6]), seededRandom(4), "Looker", spec);

describe("lookahead inputs", () => {
  it("lookahead n appends present, sin, cos and soft length per leg", () => {
    expect(lookaheadInputs(1)).toEqual(["next2Present", "next2Sin", "next2Cos", "next2DistanceSoft"]);
    expect(lookaheadInputs(2).slice(4)).toEqual([
      "next3Present",
      "next3Sin",
      "next3Cos",
      "next3DistanceSoft",
    ]);
    for (const bad of [0, 3, 1.5]) expect(() => lookaheadInputs(bad)).toThrow(/lookahead/);
    expect(inputNames(spec)).toHaveLength(5 + 8);
    // Stored with the model: a lookahead model loads back with the same spec.
    const loaded = MajorTom.fromJson(JSON.parse(JSON.stringify(model().toJson())));
    expect(loaded.spec).toEqual(spec);
  });

  it("encode each leg like v2: direction relative to the nose, length squashed, 0 with present 0 when missing", () => {
    const target = new Vector2(0, 500);
    const after = [new Vector2(500, 500), new Vector2(500, -1500)];
    const ctx = { ship: ship(), target, next: (k: number) => after[k - 1] };
    const read = (name: string, c: Parameters<(typeof INPUTS)[string]>[0] = ctx) => INPUTS[name]!(c);
    // Leg 1 runs along +x (a quarter turn), length 500: like targetSin/Cos of a target at (500, 0).
    const quarter = { ship: ship(), target: new Vector2(500, 0) };
    expect(read("next2Present")).toBe(1);
    expect(read("next2Sin")).toBeCloseTo(read("targetSin", quarter), 12);
    expect(read("next2Cos")).toBeCloseTo(0, 12);
    expect(read("next2DistanceSoft")).toBeCloseTo(0.5, 12);
    // Leg 2 runs straight back (−y), length 2000.
    expect(read("next3Present")).toBe(1);
    expect(read("next3Sin")).toBeCloseTo(0, 12);
    expect(read("next3Cos")).toBeCloseTo(-1, 12);
    expect(read("next3DistanceSoft")).toBeCloseTo(2000 / 2500, 12);
    // Relative to the nose: turning the ship a half turn flips the leg's cosine.
    expect(read("next3Cos", { ...ctx, ship: ship(Math.PI) })).toBeCloseTo(1, 12);
    // Missing targets read 0 everywhere, the present flag included.
    const short = { ship: ship(), target, next: (k: number) => (k === 1 ? after[0] : undefined) };
    for (const f of ["Present", "Sin", "Cos", "DistanceSoft"]) {
      expect(read(`next3${f}`, short)).toBe(0);
      expect(read(`next2${f}`, { ship: ship(), target })).toBe(0);
    }
  });

  it("training: the arena script feeds the episode's targets after the current one", async () => {
    // One episode of M5's `chain` arena: a row of 3–5 targets.
    const scenario: Scenario = chainArena.generate(seededRandom(9), { episodes: 1, frames: 200 });
    const targets = scenario.episodes[0]!.targets.map((t) => t.position);
    expect(targets.length).toBeGreaterThanOrEqual(3);
    const server = new GameServer({
      random: seededRandom(1),
      entityUpdatesPerTick: 0,
      sendOwnShipEveryTick: true,
    });
    const director = new ReplayDirector({ autoRespawn: false });
    server.registerService(director);
    await server.start();
    const placed = placeScenario(server, scenario);
    const script = new ArenaScript(model(), placed.episodes, "end", server.tickSeconds);
    const { proxy } = await startScript(director, script);
    const vehicle = script.vehicleController!;
    for (let i = 0; i < targets.length; i++) {
      expect(vehicle.target!.position).toEqual(targets[i]);
      expect(vehicle.next!(1)).toEqual(targets[i + 1]);
      expect(vehicle.next!(2)).toEqual(targets[i + 2]);
      server.tick();
      const seen = vehicle.lastActivation()!;
      const present = seen.names.indexOf("next2Present");
      expect(seen.values[present]).toBe(i + 1 < targets.length ? 1 : 0);
      expect(seen.values[present + 4]).toBe(i + 2 < targets.length ? 1 : 0);
      server.teleportPlayerTo(proxy, targets[i]!, 0, Vector2.zero());
      server.tick();
    }
    expect(script.records[0]!.reached).toBe(targets.length);
    script.stop();
    server.stop();
  });

  it("races: the game's bot feeds the checkpoints after its target, none after the finish", async () => {
    const replay = await ExamReplay.create(model(), "demo", 1, 30);
    const race = replay.server.raceController!;
    const proxy = [...replay.server.clients][0]!;
    const vehicle = replay.script.vehicleController!;
    replay.step(2); // the bot joins at once and goes for checkpoint 1
    const n = race.checkpoints.length;
    expect(n).toBeGreaterThan(3);
    for (let i = 1; i < n; i++) {
      expect(vehicle.target!.id).toBe(race.checkpoints[i]!.id);
      expect(vehicle.next!(1)).toEqual(race.checkpoints[i + 1]?.position);
      expect(vehicle.next!(2)).toEqual(race.checkpoints[i + 2]?.position);
      if (i === n - 1) break;
      replay.server.teleportPlayerTo(proxy, race.checkpoints[i]!.position, 0);
      replay.step(2);
    }
    expect(vehicle.next!(1)).toBeUndefined();
    replay.dispose();
  });
});
