import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  botName,
  bundledModels,
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_VERSION,
  DEFAULT_OPPONENT,
  ExamReplay,
  LEGACY_SPEC,
  loadShowcaseModel,
  MajorTom,
  opponentChoice,
  showcaseModelInfo,
} from "@ar/server";
import { describe, expect, it } from "vitest";
import { createDefaultGameServer } from "./host";
import { RACE_ROTATION } from "./track-categories";
import { trackLobby } from "./track-lobby";

/**
 * The release checks of doc/model-release.md that run as tests: the bundled model is the released
 * one, flies with its residual controller, carries the version label, and races with track rotation.
 */
const bundled = () => bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
const releasedId = `${DEFAULT_MODEL_VERSION.run}-g${DEFAULT_MODEL_VERSION.generation}`;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The ship's path on `short` (x, y, orientation per frame). */
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

describe("the released model", () => {
  it("is the bundled model, named with the version label, and equal to its showcase entry", () => {
    const model = bundled();
    expect(DEFAULT_MODEL_VERSION.label).toBe(
      `AI v${DEFAULT_MODEL_VERSION.version} (${DEFAULT_MODEL_VERSION.run} g${DEFAULT_MODEL_VERSION.generation})`,
    );
    expect(model.name).toBe(DEFAULT_MODEL_VERSION.label);
    const entry = showcaseModelInfo(releasedId)!;
    expect(entry.run).toBe(DEFAULT_MODEL_VERSION.run);
    expect(entry.generation).toBe(DEFAULT_MODEL_VERSION.generation);
    const showcase = loadShowcaseModel(releasedId)!;
    expect(model.toJson().layers).toEqual(showcase.toJson().layers);
    expect(model.spec).toEqual(showcase.spec);
    expect(showcaseModelInfo(DEFAULT_OPPONENT)!.label).toContain(DEFAULT_MODEL_VERSION.label);
  });

  it("carries the adopted spec: lineCheck and the residual controller, which the game applies", async () => {
    const model = bundled();
    expect(model.spec.controller).toEqual({ kind: "residual", scale: 0.5 });
    expect(model.spec.sensors).toEqual([{ type: "lineCheck", range: 1000 }]);
    // Same weights without the controller fly a different path: the controller is really applied.
    const json = model.toJson();
    const { controller: _, ...plainSpec } = json.spec!;
    const plain = MajorTom.fromJson({ ...json, spec: plainSpec });
    expect(await shortPath(model)).not.toEqual(await shortPath(plain));
  });

  it("keeps the previous version in the showcase (ai-v1, the legacy spec)", () => {
    const old = loadShowcaseModel("ai-v1")!;
    expect(old.spec).toEqual(LEGACY_SPEC);
    expect(old.name).toBe(showcaseModelInfo("ai-v1")!.label);
  });

  it("does not freeze at the start: on every race track it is well away from the start after 5 s", async () => {
    for (const track of RACE_ROTATION) {
      const replay = await ExamReplay.create(bundled(), track, 1, 5);
      const start = replay.start!;
      while (!replay.done) replay.step(1);
      const ship = replay.ship!.position;
      expect(Math.hypot(ship.x - start.x, ship.y - start.y), track).toBeGreaterThan(300);
      replay.dispose();
    }
  }, 60_000);
});

describe("the released model in multiplayer", () => {
  it("bots fly it with the version in their name and race on every track of the rotation", async () => {
    const server = createDefaultGameServer({
      bots: 2,
      modelDir: join(tmpdir(), "ar-release-model-test-no-models"),
      rotation: ["demo", "short", "canyon"],
    });
    const lobby = trackLobby(server)!;
    expect(opponentChoice(server)!.current).toBe(DEFAULT_OPPONENT);
    await server.start();
    const names = [0, 1].map((i) => botName(DEFAULT_OPPONENT, i, 2));
    expect(names).toEqual([
      `Major Tom 1 (${DEFAULT_MODEL_VERSION.short})`,
      `Major Tom 2 (${DEFAULT_MODEL_VERSION.short})`,
    ]);
    const bots = () => [...server.clients].filter((c) => names.includes(c.playerName ?? ""));
    for (const track of ["demo", "short", "canyon"]) {
      expect(lobby.rotation.current).toBe(track);
      // The bots wait 5 s for humans (none here), then race: each clears a checkpoint within 25 s.
      let cleared = false;
      // Flush after every tick, as the live server's event loop does: a bot that hears of the
      // world only every few ticks steers on stale state and does not race.
      for (let i = 0; i < 2000 && !cleared; i++) {
        server.tick();
        await flush();
        const race = server.raceController!;
        cleared = bots().length === 2 && bots().every((b) => (race.progressOf(b) ?? 0) >= 1);
      }
      expect(cleared, track).toBe(true);
      lobby.endRound();
      for (let i = 0; i < 5; i++) {
        server.tick();
        await flush();
      }
    }
    server.stop();
  }, 60_000);
});
