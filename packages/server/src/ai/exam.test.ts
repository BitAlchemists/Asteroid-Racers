import { describe, expect, it } from "vitest";
import { seededRandom } from "../random";
import { parseTrackFile, TRACK_FORMAT_V2, trackFromFile } from "../track-file";
import { DEFAULT_EXAM, examFlight, examFlights, parseExamConfig, runExam } from "./exam";
import { bundledModels, DEFAULT_LAYOUT, DEFAULT_MODEL_NAME } from "./index";
import { MajorTom } from "./network";

const bundled = () => bundledModels().load(DEFAULT_MODEL_NAME)![0]!;
const weights = DEFAULT_EXAM.weights;

describe("race exam", () => {
  it("goal races (M7): laps count over all laps; goalMet, par and timeVsPar only on goal tracks", async () => {
    const plain = await examFlight(bundled(), "short", 1, 30, weights);
    expect(Object.keys(plain)).not.toContain("goalMet");
    expect(Object.keys(plain)).not.toContain("par");

    const loop = trackFromFile(
      parseTrackFile({
        format: TRACK_FORMAT_V2,
        name: "loop",
        description: "two laps of a square",
        race: {
          start: { x: 0, y: 0, heading: 0 },
          checkpoints: [
            { x: 0, y: -700 },
            { x: 700, y: -700 },
          ],
          finish: { x: 700, y: 0 },
          laps: 2,
          par: 30,
        },
      }),
    );
    const flight = await examFlight(bundled(), loop, 1, 90, weights);
    expect(flight).toMatchObject({ track: "loop", totalCheckpoints: 6, par: 30 });
    expect(flight.goalMet).toBe(flight.finished);
    if (flight.finished) expect(flight.timeVsPar).toBeCloseTo(flight.seconds / 30, 12);
    else expect(flight.timeVsPar).toBeUndefined();
    expect(flight.checkpoints).toBeGreaterThan(3); // into the second lap at least
  });

  it("the bundled model finishes the short track (one lap, no crash)", async () => {
    const flight = await examFlight(bundled(), "short", 1, 30, weights);
    expect(flight).toMatchObject({
      track: "short",
      finished: true,
      checkpoints: 2,
      totalCheckpoints: 2,
      distanceLeft: 0,
    });
    expect(flight.seconds).toBeLessThan(30);
    expect(flight.score).toBeCloseTo(flight.seconds);
  });

  it("a flight that runs out of time scores missed checkpoints, the full time and the distance left", async () => {
    // A random network on the corridor track: it reaches nothing in 5 s.
    const flight = await examFlight(MajorTom.random(DEFAULT_LAYOUT, seededRandom(4)), "demo", 1, 5, weights);
    expect(flight.finished).toBe(false);
    expect(flight.seconds).toBeCloseTo(5);
    expect(flight.distanceLeft).toBeGreaterThan(0);
    expect(flight.score).toBeCloseTo(
      1000 * (flight.totalCheckpoints - flight.checkpoints) + flight.seconds + 0.01 * flight.distanceLeft,
    );
  });

  it("is deterministic: same model, config and seed give the same result", async () => {
    const config = { ...DEFAULT_EXAM, randomTracks: 2, timeLimitSeconds: 20 };
    const a = await runExam(bundled(), config);
    const b = await runExam(bundled(), config);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.flights).toHaveLength(4);
    expect(a.score).toBeCloseTo(a.flights.reduce((s, f) => s + f.score, 0));
    expect(a.checkpoints).toBeGreaterThan(0);
  });

  it("derives one seed per flight from the exam seed", () => {
    const flights = examFlights({ ...DEFAULT_EXAM, randomTracks: 3 });
    expect(flights.map((f) => f.track)).toEqual(["demo", "short", "random", "random", "random"]);
    expect(new Set(flights.map((f) => f.seed)).size).toBe(5);
    expect(examFlights({ ...DEFAULT_EXAM, seed: 2 })[0]!.seed).not.toBe(flights[0]!.seed);
  });

  it("parses the exam config with defaults and rejects bad values", () => {
    expect(parseExamConfig(undefined)).toEqual(DEFAULT_EXAM);
    expect(parseExamConfig({ tracks: ["short"], weights: { second: 2 } })).toMatchObject({
      tracks: ["short"],
      weights: { checkpoint: 1000, second: 2, distance: 0.01 },
    });
    expect(() => parseExamConfig({ tracks: ["moon"] })).toThrow(/unknown track/);
    expect(() => parseExamConfig({ tracks: [], randomTracks: 0 })).toThrow(/no flights/);
    expect(() => parseExamConfig({ timeLimitSeconds: 0 })).toThrow(/timeLimit/);
    expect(() => parseExamConfig({ weights: { speed: 1 } })).toThrow(/weights.speed/);
  });
});
