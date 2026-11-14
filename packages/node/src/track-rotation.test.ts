import { describe, expect, it } from "vitest";
import { TrackRotation } from "./track-rotation";

const TRACKS = ["a", "b", "c", "d"];

describe("track rotation", () => {
  it("goes round in order with no votes, and wraps", () => {
    const r = new TrackRotation(TRACKS);
    expect(r.current).toBe("a");
    expect(r.next).toBe("b");
    expect(r.nextBy).toBe("rotation");
    expect([r.advance(), r.advance(), r.advance(), r.advance()]).toEqual(["b", "c", "d", "a"]);
  });

  it("starts anywhere in the list; the current track comes last in the order", () => {
    const r = new TrackRotation(TRACKS, "c");
    expect(r.order()).toEqual(["d", "a", "b", "c"]);
    expect(r.next).toBe("d");
  });

  it("takes the track with the most votes", () => {
    const r = new TrackRotation<string>(TRACKS);
    r.vote("p1", "d");
    r.vote("p2", "d");
    r.vote("p3", "b");
    expect(r.next).toBe("d");
    expect(r.nextBy).toBe("vote");
    expect(r.tally()).toEqual([
      { track: "b", votes: 1 },
      { track: "d", votes: 2 },
    ]);
  });

  it("breaks ties by rotation order after the current track", () => {
    const r = new TrackRotation<string>(TRACKS, "c");
    r.vote("p1", "b");
    r.vote("p2", "d");
    expect(r.next).toBe("d"); // d comes before b after c
    r.vote("p3", "b");
    expect(r.next).toBe("b");
  });

  it("a vote for the current track keeps it", () => {
    const r = new TrackRotation<string>(TRACKS);
    r.vote("p1", "a");
    expect(r.next).toBe("a");
    expect(r.advance()).toBe("a");
  });

  it("one vote per voter: voting again replaces it", () => {
    const r = new TrackRotation<string>(TRACKS);
    r.vote("p1", "c");
    r.vote("p1", "d");
    expect(r.voteCount).toBe(1);
    expect(r.voteOf("p1")).toBe("d");
    expect(r.next).toBe("d");
  });

  it("a voter who leaves takes their vote along", () => {
    const r = new TrackRotation<string>(TRACKS);
    r.vote("p1", "d");
    r.vote("p2", "c");
    r.vote("p3", "d");
    expect(r.withdraw("p1")).toBe(true);
    expect(r.withdraw("p1")).toBe(false);
    expect(r.next).toBe("c"); // c 1, d 1: c first in rotation order
    r.withdraw("p2");
    r.withdraw("p3");
    expect(r.next).toBe("b");
    expect(r.nextBy).toBe("rotation");
  });

  it("refuses unknown tracks; advancing clears the votes and continues from the new track", () => {
    const r = new TrackRotation<string>(TRACKS);
    expect(r.vote("p1", "zzz")).toBe(false);
    expect(r.voteCount).toBe(0);
    r.vote("p1", "c");
    expect(r.advance()).toBe("c");
    expect(r.voteCount).toBe(0);
    expect(r.next).toBe("d");
  });

  it("checks its list", () => {
    expect(() => new TrackRotation([])).toThrow(/at least one/);
    expect(() => new TrackRotation(["a", "a"])).toThrow(/duplicate/);
    expect(() => new TrackRotation(["a"], "b")).toThrow(/not in the rotation/);
    const single = new TrackRotation(["a"]);
    expect(single.advance()).toBe("a");
  });
});
