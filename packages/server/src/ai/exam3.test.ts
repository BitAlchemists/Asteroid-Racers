import { EntityType } from "@ar/shared";
import { describe, expect, it } from "vitest";
import { GameServer } from "../game-server";
import { seededRandom } from "../random";
import { parseExamConfig } from "./exam";
import {
  EXAM3,
  exam3Metrics,
  exam3Races,
  raceValue,
  runExam3,
  scoreExam3,
  skillsValue,
  type Exam3Flight,
} from "./exam3";
import { scriptedModel } from "./scripted-controller";
import type { SkillResult } from "./skills";

/** FNV-1a of the JSON (as the other fingerprint tests). */
function sha(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

describe("exam v3", () => {
  it("is frozen: definition, race list (ids, world seeds, par) and every built world are fingerprinted", () => {
    const races = exam3Races();
    expect(races).toHaveLength(80);
    const counts: Record<string, number> = {};
    for (const r of races) counts[r.category] = (counts[r.category] ?? 0) + 1;
    expect(counts).toEqual({ easy: 20, medium: 20, hard: 20, handmade: 7, goals: 13 });
    expect(new Set(races.map((r) => r.id)).size).toBe(races.length);
    expect(Object.values(EXAM3.weights).reduce((s, w) => s + w, 0)).toBeCloseTo(1, 12);

    expect(EXAM3.version).toBe("3.0");
    expect(sha(EXAM3)).toBe("0a5722dc");
    expect(sha(races.map(({ id, category, goal, seed, par }) => [id, category, goal, seed, par]))).toBe(
      "c2d00b41",
    );
    // The worlds: every rock, every race point and the race rules, as the exam builds them.
    const worlds = races.map((race) => {
      const server = new GameServer({ random: seededRandom(race.seed) }).loadTrack(race.track);
      const race2 = server.raceController!;
      const round = (v: number) => Math.round(v * 1000) / 1000;
      return [
        [...server.world.entities.values()]
          .filter((e) => e.type === EntityType.ASTEROID)
          .map((e) => [round(e.position.x), round(e.position.y), round(e.radius)]),
        race2.checkpoints.map((c, i) => [
          round(c.position.x),
          round(c.position.y),
          round(c.radius),
          race2.gateWidth(i) ?? 0,
        ]),
        race2.rules,
      ];
    });
    expect(sha(worlds)).toBe("4e4a5351");
  });

  it("race value: 0.6 progress + 0.2 goal met + 0.2 min(1, par / time), the time only when finished", () => {
    expect(raceValue({ checkpoints: 3, totalCheckpoints: 6, finished: false, seconds: 180 }, 30)).toEqual({
      value: 0.3,
      timeFactor: 0,
    });
    expect(
      raceValue({ checkpoints: 6, totalCheckpoints: 6, finished: true, seconds: 60 }, 30).value,
    ).toBeCloseTo(0.6 + 0.2 + 0.1, 12);
    expect(raceValue({ checkpoints: 6, totalCheckpoints: 6, finished: true, seconds: 20 }, 30)).toEqual({
      value: 1,
      timeFactor: 1,
    });
  });

  it("skills: mean success − 0.05 per crash per episode, clamped to [0, 1]; categories weighted", () => {
    const skill = (success: number, crashesPerEpisode: number) =>
      ({ success, crashesPerEpisode }) as SkillResult;
    expect(skillsValue([skill(1, 0), skill(0.5, 2)]).value).toBeCloseTo(0.75 - 0.05, 12);
    expect(skillsValue([skill(0.1, 10)]).value).toBe(0);
    const flight = (category: Exam3Flight["category"], value: number, crashes = 0) =>
      ({
        category,
        goal: "race",
        value,
        crashes,
        finished: false,
        seconds: 180,
        exam3Par: 30,
      }) as Exam3Flight;
    const r = scoreExam3(
      [
        flight("easy", 1, 2),
        flight("medium", 0.5),
        flight("hard", 0),
        flight("hard", 0.5),
        flight("handmade", 1),
        flight("goals", 0.2),
      ],
      [skill(0.6, 0)],
    );
    expect(r.categories).toEqual({ easy: 100, medium: 50, hard: 25, handmade: 100, goals: 20, skills: 60 });
    expect(r.score).toBeCloseTo(10 + 10 + 6.25 + 20 + 3 + 6, 10);
    expect(r.crashes).toBeCloseTo(2 / 6, 12);
    expect(exam3Metrics(r)).not.toHaveProperty("exam3TimeVsPar"); // nothing finished
    expect(Object.keys(exam3Metrics(r))).toEqual([
      "exam3",
      "exam3Easy",
      "exam3Medium",
      "exam3Hard",
      "exam3Handmade",
      "exam3Goals",
      "exam3Skills",
      "exam3Finished",
      "exam3Crashes",
    ]);
  });

  it("the scripted controller's exam v3 is pinned (deterministic flights, tracks and scoring)", async () => {
    const a = await runExam3(scriptedModel());
    expect(a.flights).toHaveLength(80);
    expect(a.skills).toHaveLength(9);
    expect(sha(exam3Metrics(a))).toBe("bbee0264");
    expect(a.score.toFixed(6)).toBe("52.630751");
  }, 120_000);

  it("the exam config takes v3: {} and nothing else", () => {
    expect(parseExamConfig({ v3: {} }).v3).toEqual({});
    expect(parseExamConfig({})).not.toHaveProperty("v3");
    expect(() => parseExamConfig({ v3: { tracks: 3 } })).toThrow(/exam.v3/);
    expect(() => parseExamConfig({ v3: true })).toThrow(/exam.v3/);
  });
});
