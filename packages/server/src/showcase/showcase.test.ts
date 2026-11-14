import { describe, expect, it } from "vitest";
import { bundledModels, DEFAULT_MODEL_NAME } from "../ai/index";
import { ExamReplay } from "../ai/exam";
import { DemoDirector } from "../ai/directors";
import { MajorTom } from "../ai/network";
import { RaceTargetScript } from "../ai/scripts";
import { GameServer } from "../game-server";
import { seededRandom } from "../random";
import { TRACKS } from "../tracks";
import {
  ACCEPTED_MODEL,
  DEFAULT_OPPONENT,
  loadShowcaseModel,
  registerRacingBots,
  replayResult,
  runChallenge,
  SHOWCASE_MODELS,
  showcaseChallenges,
  showcaseModelInfo,
} from "./index";

/** The ship's path on `short` (x, y, orientation per frame) for `model`. */
async function shortPath(model: MajorTom): Promise<number[]> {
  const replay = await ExamReplay.create(model, "short", 7, 20);
  const path: number[] = [];
  while (!replay.done && replay.frame < 600) {
    replay.step(1);
    const s = replay.ship!;
    path.push(s.position.x, s.position.y, s.orientation);
  }
  replay.dispose();
  return path;
}

describe("showcase models", () => {
  it("every manifest entry loads; the default is the game's bundled model, unchanged", () => {
    for (const info of SHOWCASE_MODELS) expect(loadShowcaseModel(info.id)).toBeInstanceOf(MajorTom);
    const bundled = bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
    const fromShowcase = loadShowcaseModel(DEFAULT_OPPONENT)!;
    expect(fromShowcase.toJson().layers).toEqual(bundled.toJson().layers);
    expect(fromShowcase.spec).toEqual(bundled.spec);
    expect(loadShowcaseModel("nope")).toBeUndefined();
  });

  it("the accepted models carry the residual controller and fly with it", async () => {
    expect(showcaseModelInfo(ACCEPTED_MODEL)).toBeDefined();
    for (const id of ["train-502-g150", "train-504-g150"])
      expect(loadShowcaseModel(id)!.spec.controller).toEqual({ kind: "residual", scale: 0.5 });
    expect(loadShowcaseModel("train-327-g300")!.spec.controller).toBeUndefined();

    // Same weights without the controller fly a different path: the controller is really applied.
    const model = loadShowcaseModel(ACCEPTED_MODEL)!;
    const json = model.toJson();
    const { controller: _, ...plainSpec } = json.spec!;
    const plain = MajorTom.fromJson({ ...json, spec: plainSpec });
    const [withController, without] = [await shortPath(model), await shortPath(plain)];
    expect(withController).not.toEqual(without);
  });

  it("the headless exam v2 reproduces the training run's exam of the accepted model", async () => {
    const exam = showcaseChallenges().find((c) => c.id === "exam:v2")!;
    const result = await runChallenge(loadShowcaseModel(ACCEPTED_MODEL)!, exam);
    const recorded = showcaseModelInfo(ACCEPTED_MODEL)!.exam!;
    expect(result.runs).toBe(102);
    expect(result.reached / result.total).toBeCloseTo(recorded.checkpoints, 4);
    expect(result.completed / result.runs).toBeCloseTo(recorded.finished, 4);
    expect(result.crashes).toBe(recorded.crashes);
  }, 30_000);
});

describe("showcase challenges", () => {
  it("lists every track but random, the nine skill arenas and exam v2", () => {
    const ids = showcaseChallenges().map((c) => c.id);
    for (const name of Object.keys(TRACKS)) expect(ids.includes(`track:${name}`)).toBe(name !== "random");
    expect(ids.filter((id) => id.startsWith("skill:"))).toHaveLength(9);
    expect(ids.at(-1)).toBe("exam:v2");
  });

  it("watching and running headless give the same result", async () => {
    const model = loadShowcaseModel(ACCEPTED_MODEL)!;
    for (const id of ["track:short", "skill:Stop"]) {
      const challenge = showcaseChallenges().find((c) => c.id === id)!;
      const headless = await runChallenge(model, challenge);
      // The viewer steps in small chunks.
      const replay = await challenge.source(model).open(0);
      while (!replay.done) replay.step(3);
      expect(replayResult(id, replay)).toEqual(headless);
      replay.dispose();
    }
  });
});

describe("opponent choice", () => {
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));
  async function setup(opponent: string | null = null) {
    const server = new GameServer({ random: seededRandom(1) }).prepareDemoConfiguration();
    const choice = registerRacingBots(server, { opponent, delaySeconds: 0.5 });
    await server.start();
    await flush();
    return { server, choice, bot: () => [...server.clients][0] };
  }

  it("flies the bundled model as Major Tom by default", async () => {
    const { server, choice, bot } = await setup();
    expect(choice.current).toBe(DEFAULT_OPPONENT);
    expect(bot()?.playerName).toBe("Major Tom");
    server.stop();
  });

  it("switches the bots to a chosen model and back when the last player leaves", async () => {
    const { server, choice, bot } = await setup(null);
    // A bot that ran under 1 s of game time restarts only after 5 s: let it fly a while first.
    for (let i = 0; i < 100; i++) server.tick();
    const leaveA = choice.join(ACCEPTED_MODEL);
    for (let i = 0; i < 3; i++) {
      server.tick();
      await flush();
    }
    expect(choice.current).toBe(ACCEPTED_MODEL);
    expect(bot()?.playerName).toBe(`Major Tom (${ACCEPTED_MODEL})`);
    const leaveB = choice.join(null); // no choice: keeps the current one
    expect(choice.current).toBe(ACCEPTED_MODEL);
    expect(choice.choose("no-such-model")).toBe(false);
    leaveA();
    expect(choice.current).toBe(ACCEPTED_MODEL);
    leaveB();
    leaveB(); // twice is harmless
    expect(choice.current).toBe(DEFAULT_OPPONENT);
    for (let i = 0; i < 100; i++) server.tick();
    for (let i = 0; i < 3; i++) {
      server.tick();
      await flush();
    }
    expect(bot()?.playerName).toBe("Major Tom");
    server.stop();
  });

  it("waits with a switch while a human is racing, so no race is cut short", async () => {
    const { server, choice } = await setup(null);
    // A stand-in for a human player: a racer the opponent choice does not own.
    const humans = new DemoDirector(DEFAULT_MODEL_NAME, bundledModels());
    humans.scriptFactories.push((n) => new RaceTargetScript(n, 0, "Human"));
    server.registerService(humans);
    humans.start();
    for (let i = 0; i < 100; i++) server.tick();
    await flush();
    const human = [...server.clients].find((c) => c.playerName === "Human")!;
    server.teleportPlayerTo(human, server.raceController!.start!.position, 0);
    server.tick();
    await flush();
    expect(server.raceController!.isClientInRace(human)).toBe(true);

    choice.choose(ACCEPTED_MODEL);
    server.tick();
    expect(choice.current).toBe(DEFAULT_OPPONENT);
    expect(choice.pending).toBe(ACCEPTED_MODEL);

    humans.stop(); // the human leaves the race (and the server)
    await flush();
    server.tick();
    expect(choice.current).toBe(ACCEPTED_MODEL);
    expect(choice.pending).toBeUndefined();
    server.stop();
  });
});
