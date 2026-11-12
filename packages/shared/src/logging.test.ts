import { afterEach, describe, expect, it } from "vitest";
import {
  consoleSink,
  effectiveLevel,
  getLogger,
  Level,
  resetLogLevels,
  setLogLevel,
  setLogSink,
  type LogRecord,
} from "./logging";

describe("logging", () => {
  afterEach(() => {
    resetLogLevels();
    setLogSink(consoleSink);
  });

  it("inherits levels from the nearest configured ancestor", () => {
    setLogLevel("", Level.WARNING);
    setLogLevel("services.ai", Level.FINE);
    expect(effectiveLevel("services.ai.TrainingDirector")).toBe(Level.FINE);
    expect(effectiveLevel("services.chat")).toBe(Level.WARNING);
    expect(effectiveLevel("GameServer")).toBe(Level.WARNING);
  });

  it("filters below the effective level and only builds lazy messages when enabled", () => {
    const records: LogRecord[] = [];
    setLogSink((r) => records.push(r));
    setLogLevel("GameServer", Level.INFO);
    const log = getLogger("GameServer.ClientProxy");

    let built = 0;
    log.fine(() => `expensive ${++built}`);
    log.info(() => `cheap ${++built}`);

    expect(built).toBe(1);
    expect(records.map((r) => [r.level, r.logger, r.message])).toEqual([
      [Level.INFO, "GameServer.ClientProxy", "cheap 1"],
    ]);
  });

  it("returns the same logger instance per name", () => {
    expect(getLogger("a.b")).toBe(getLogger("a.b"));
  });
});
