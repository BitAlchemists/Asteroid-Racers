import {
  createEnvelope,
  decodeEnvelope,
  encodeEnvelope,
  MessageType,
  readPayload,
  type Connection,
  type Envelope,
  type PayloadArgs,
  type Unsubscribe,
  Vector2,
} from "@ar/shared";
import {
  ChatServer,
  ClientProxy,
  GameServer,
  registerRacingBots,
  seededRandom,
  trackByName,
} from "@ar/server";
import { describe, expect, it } from "vitest";
import { createDefaultGameServer } from "./host";
import { RACE_ROTATION } from "./track-categories";
import {
  LOBBY_SENDER,
  registerTrackLobby,
  serverInternals,
  trackLobby,
  type TrackLobby,
} from "./track-lobby";

/** A human player over an in-memory connection (what the host's WebSocket clients look like). */
class Human implements Connection {
  readonly received: Envelope[] = [];
  readonly proxy: ClientProxy;
  connected = true;
  private messageListeners: ((envelope: Envelope) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];
  private readonly leave: (() => void) | undefined;

  constructor(
    readonly server: GameServer,
    name: string,
    lobby: TrackLobby | undefined,
  ) {
    this.proxy = new ClientProxy(this, server);
    server.connectClient(this.proxy);
    this.leave = lobby?.join(this.proxy);
    this.sendToServer(MessageType.HANDSHAKE, { username: name });
  }

  send(envelope: Envelope): void {
    this.received.push(decodeEnvelope(encodeEnvelope(envelope)));
  }
  onMessage(listener: (envelope: Envelope) => void): Unsubscribe {
    this.messageListeners.push(listener);
    return () => (this.messageListeners = this.messageListeners.filter((l) => l !== listener));
  }
  onDisconnect(listener: () => void): Unsubscribe {
    this.disconnectListeners.push(listener);
    return () => (this.disconnectListeners = this.disconnectListeners.filter((l) => l !== listener));
  }
  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    for (const listener of [...this.disconnectListeners]) listener();
    this.leave?.();
  }

  sendToServer<T extends MessageType>(type: T, ...args: PayloadArgs<T>): void {
    const envelope = decodeEnvelope(encodeEnvelope(createEnvelope(type, ...args)));
    for (const listener of [...this.messageListeners]) listener(envelope);
  }

  chats(): { from: string; text: string }[] {
    return this.received
      .filter((e) => e.messageType === MessageType.CHAT)
      .map((e) => readPayload(MessageType.CHAT, e));
  }
  lobbyLines(): string[] {
    return this.chats()
      .filter((c) => c.from === LOBBY_SENDER)
      .map((c) => c.text);
  }
  count(type: MessageType): number {
    return this.received.filter((e) => e.messageType === type).length;
  }

  get racing(): boolean {
    return this.server.raceController!.isClientInRace(this.proxy);
  }

  /** Flies into the portal (teleported onto it) and joins the race. */
  joinRace(): void {
    this.server.teleportPlayerTo(this.proxy, this.server.raceController!.start!.position, 0);
    this.server.tick();
  }

  /** Sets off: clears the next checkpoint (teleported onto it), so they are no longer on the grid. */
  clearNext(): void {
    const next = this.server.raceController!.nextCheckpointOf(this.proxy)!;
    this.server.teleportPlayerTo(this.proxy, next.position, next.orientation);
    this.server.tick();
  }

  /** Touches the next checkpoints in order (teleported onto each) until the race is finished. */
  finishRace(): void {
    const race = this.server.raceController!;
    for (let guard = 0; guard < 100; guard++) {
      const next = race.nextCheckpointOf(this.proxy);
      if (!next) return;
      const before = race;
      this.server.teleportPlayerTo(this.proxy, next.position, next.orientation);
      this.server.tick();
      if (this.server.raceController !== before) return; // finished, and the track switched
      if ((race.progressOf(this.proxy) ?? 0) === 0) return; // finished, back on the start line
    }
    throw new Error("could not finish the race");
  }
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(tracks: readonly string[] = ["demo", "short", "slalom"], roundSeconds = 240) {
  const server = new GameServer({ random: seededRandom(1) }).loadTrack(trackByName(tracks[0]!));
  server.registerService(new ChatServer());
  const lobby = registerTrackLobby(server, { tracks, roundSeconds });
  return { server, lobby };
}

/** Number of checkpoints `name` has when loaded on its own. */
const checkpointsOf = (name: string) =>
  new GameServer({ random: seededRandom(1) }).loadTrack(trackByName(name)).raceController!.checkpoints.length;

describe("track lobby: rotation", () => {
  it("switches to the next track after a finished round when nobody is racing", () => {
    const { server, lobby } = setup();
    const watcher = new Human(server, "Watcher", lobby);
    const oldEntities = server.world.entities.size - 1; // all but the watcher's ship
    const oldPortal = server.raceController!.start!;
    watcher.received.length = 0;

    server.tick();
    expect(lobby.rotation.current).toBe("demo");
    lobby.endRound();
    server.tick();

    expect(lobby.rotation.current).toBe("short");
    expect(server.raceController!.checkpoints.length).toBe(checkpointsOf("short"));
    // The old track is gone on the client, the new one was sent.
    expect(watcher.count(MessageType.ENTITY_REMOVE)).toBe(oldEntities);
    expect(server.world.entities.has(oldPortal.id)).toBe(false);
    expect(serverInternals(server).joinRace.passiveEntities).toEqual([server.raceController!.start]);
    const sent = new Set(
      watcher.received
        .filter((e) => e.messageType === MessageType.ENTITY)
        .map((e) => readPayload(MessageType.ENTITY, e).id),
    );
    for (const id of server.world.entities.keys())
      if (id !== watcher.proxy.movable!.id) expect(sent.has(id)).toBe(true);
    expect(watcher.lobbyLines().at(-1)).toMatch(/^Track: short\. .*Next track: slalom \(rotation\)\./);
  });

  it("keeps rotating with no players and no votes (round time limit)", () => {
    const { server, lobby } = setup(["demo", "short", "slalom"], 1);
    const seen: string[] = [];
    for (let i = 0; i < 300; i++) {
      server.tick();
      if (seen.at(-1) !== lobby.rotation.current) seen.push(lobby.rotation.current);
    }
    expect(seen.slice(0, 4)).toEqual(["demo", "short", "slalom", "demo"]);
    // Nothing piles up: one portal, and only the current track's obstacles.
    expect(serverInternals(server).joinRace.passiveEntities).toHaveLength(1);
    expect(server.stats().racers).toBe(0);
  });

  it("re-arms players so they can join the new track's race by its portal", () => {
    const { server, lobby } = setup(["short", "demo"]);
    const human = new Human(server, "Ann", lobby);
    human.joinRace();
    expect(human.racing).toBe(true);
    human.sendToServer(MessageType.RACE_LEAVE); // used their ticket, then left
    lobby.endRound();
    server.tick();
    expect(lobby.rotation.current).toBe("demo");
    expect(human.racing).toBe(false);
    // Placed next to the new start, not in an asteroid and not on the portal.
    const ship = human.proxy.movable!;
    const portal = server.raceController!.start!;
    expect(ship.position.distanceTo(portal.position)).toBeGreaterThan(portal.radius + ship.radius);
    for (const rock of server.world.passiveCollisionEntities)
      expect(ship.position.distanceTo(rock.position)).toBeGreaterThan(rock.radius + ship.radius);
    human.joinRace();
    expect(human.racing).toBe(true);
  });
});

describe("track lobby: never during a race", () => {
  it("waits while a human is racing, says so once, and switches when they leave the race", () => {
    const { server, lobby } = setup();
    const ann = new Human(server, "Ann", lobby);
    ann.joinRace();
    ann.clearNext();
    expect(ann.racing).toBe(true);

    lobby.endRound();
    for (let i = 0; i < 50; i++) server.tick();
    expect(lobby.rotation.current).toBe("demo");
    expect(lobby.status()).toMatchObject({ waiting: true });
    expect(ann.lobbyLines().filter((l) => l.includes("starts when the current race is over"))).toHaveLength(
      1,
    );

    ann.sendToServer(MessageType.RACE_LEAVE);
    server.tick();
    expect(lobby.rotation.current).toBe("short");
  });

  it("switches when the last racing human disconnects", () => {
    const { server, lobby } = setup();
    const ann = new Human(server, "Ann", lobby);
    ann.joinRace();
    ann.clearNext();
    lobby.endRound();
    server.tick();
    expect(lobby.rotation.current).toBe("demo");
    ann.disconnect();
    server.tick();
    expect(lobby.rotation.current).toBe("short");
  });

  it("a finish ends the round; the finisher is carried into the next track's race", () => {
    const { server, lobby } = setup(["short", "demo", "slalom"]);
    const ann = new Human(server, "Ann", lobby);
    const bob = new Human(server, "Bob", lobby);
    ann.joinRace();
    bob.joinRace();
    bob.clearNext();
    ann.finishRace();
    // Bob is still racing: no switch, Ann waits on the start grid.
    expect(lobby.rotation.current).toBe("short");
    expect(lobby.roundOver).toBe(true);
    bob.finishRace();
    expect(lobby.rotation.current).toBe("demo");
    expect(ann.racing).toBe(true);
    expect(bob.racing).toBe(true);
    expect(server.raceController!.progressOf(ann.proxy)).toBe(0);
  });

  it("a player idling on the start grid does not block the switch; they move to the new grid", () => {
    const { server, lobby } = setup(["short", "demo"]);
    const ann = new Human(server, "Ann", lobby);
    ann.joinRace();
    expect(ann.racing).toBe(true);
    lobby.endRound();
    server.tick();
    expect(lobby.rotation.current).toBe("demo");
    expect(ann.racing).toBe(true);
    const race = server.raceController!;
    expect(race.progressOf(ann.proxy)).toBe(0);
    expect(
      ann.proxy.movable!.position.distanceTo(race.spawnEntityForPlayer(ann.proxy).position),
    ).toBeLessThan(1);
  });

  it("a player who left the grid without a checkpoint is racing", () => {
    const { server, lobby } = setup(["short", "demo"]);
    const ann = new Human(server, "Ann", lobby);
    ann.joinRace();
    const slot = server.raceController!.spawnEntityForPlayer(ann.proxy);
    server.teleportPlayerTo(ann.proxy, slot.position.plus(new Vector2(0, -300)), 0);
    lobby.endRound();
    server.tick();
    expect(lobby.rotation.current).toBe("short");
  });

  it("a finisher who sets off again on the old track is racing again", () => {
    const { server, lobby } = setup(["short", "demo"]);
    const ann = new Human(server, "Ann", lobby);
    const bob = new Human(server, "Bob", lobby);
    ann.joinRace();
    bob.joinRace();
    bob.clearNext();
    ann.finishRace();
    ann.clearNext(); // the first checkpoint of her next run
    bob.sendToServer(MessageType.RACE_LEAVE);
    for (let i = 0; i < 10; i++) server.tick();
    expect(lobby.rotation.current).toBe("short");
    ann.sendToServer(MessageType.RACE_LEAVE);
    server.tick();
    expect(lobby.rotation.current).toBe("demo");
  });
});

describe("track lobby: votes", () => {
  it("/vote picks the next track; it is a lobby command, not a chat line; normal chat still works", () => {
    const { server, lobby } = setup(["demo", "short", "slalom"]);
    const ann = new Human(server, "Ann", lobby);
    const bob = new Human(server, "Bob", lobby);
    ann.sendToServer(MessageType.CHAT, { from: "", text: "/vote slalom" });
    expect(lobby.rotation.next).toBe("slalom");
    expect(bob.chats().some((c) => c.from === "Ann")).toBe(false);
    expect(bob.lobbyLines().at(-1)).toBe("Ann votes for slalom. Next track: slalom (votes: slalom 1).");
    expect(ann.lobbyLines().at(-1)).toBe("Your vote: slalom.");
    ann.sendToServer(MessageType.CHAT, { from: "", text: "hello" });
    expect(bob.chats().at(-1)).toMatchObject({ from: "Ann", text: "hello" });

    lobby.endRound();
    server.tick();
    expect(lobby.rotation.current).toBe("slalom");
    expect(lobby.status()).toMatchObject({ votes: {}, next: { name: "demo", by: "rotation" } });
  });

  it("ties go to rotation order; a voter who leaves takes the vote along", () => {
    const { server, lobby } = setup(["demo", "short", "slalom"]);
    const ann = new Human(server, "Ann", lobby);
    const bob = new Human(server, "Bob", lobby);
    lobby.vote(ann.proxy, "slalom");
    lobby.vote(bob.proxy, "short");
    expect(lobby.rotation.next).toBe("short");
    const cat = new Human(server, "Cat", lobby);
    lobby.vote(cat.proxy, "slalom");
    expect(lobby.status()).toMatchObject({
      next: { name: "slalom", by: "vote" },
      votes: { short: 1, slalom: 2 },
    });
    cat.disconnect();
    expect(lobby.rotation.next).toBe("short");
    ann.disconnect();
    bob.disconnect();
    expect(lobby.status()).toMatchObject({ next: { name: "short", by: "rotation" }, votes: {}, players: 0 });
  });

  it("matches a part of a name, and refuses unknown or ambiguous ones and skill tracks", () => {
    const { server, lobby } = setup(RACE_ROTATION);
    const ann = new Human(server, "Ann", lobby);
    expect(lobby.vote(ann.proxy, "hard")).toBe("Your vote: generated:hard.");
    expect(lobby.vote(ann.proxy, "generated")).toMatch(
      /could be generated:easy or generated:medium or generated:hard/,
    );
    expect(lobby.vote(ann.proxy, "slalom")).toMatch(/^No race track "slalom"/);
    expect(lobby.rotation.voteOf(ann.proxy)).toBe("generated:hard");
    ann.sendToServer(MessageType.CHAT, { from: "", text: "/tracks" });
    expect(ann.lobbyLines().at(-1)).toMatch(
      /^Track: demo\. Next track: generated:hard .*Vote: \/vote <demo \| canyon/,
    );
  });
});

describe("track lobby: bots and the opponent choice", () => {
  it("bots restart on the new track with the chosen model", async () => {
    const { server, lobby } = setup(["demo", "short"]);
    const choice = registerRacingBots(server, { opponent: "train-502-g150", delaySeconds: 0.5 });
    await server.start();
    await flush();
    for (let i = 0; i < 100; i++) server.tick();
    const botName = "Major Tom (train-502-g150)";
    const bot = () => [...server.clients].find((c) => c.playerName === botName);
    expect(bot()).toBeDefined();

    lobby.endRound();
    server.tick();
    expect(lobby.rotation.current).toBe("short");
    for (let i = 0; i < 400; i++) {
      server.tick();
      if (i % 20 === 0) await flush();
    }
    expect(choice.current).toBe("train-502-g150");
    expect(bot()).toBeDefined();
    expect(server.clients.size).toBe(1);
    // The bot found the new portal and races on the new track.
    expect(server.raceController!.isClientInRace(bot()!)).toBe(true);
    server.stop();
  });
});

describe("default game server and TRACK", () => {
  it("TRACK=<name> is a fixed track without a lobby; a rotation has one", () => {
    expect(trackLobby(createDefaultGameServer({ bots: 0, track: "canyon" }))).toBeUndefined();
    const rotating = createDefaultGameServer({ bots: 0, rotation: RACE_ROTATION });
    expect(trackLobby(rotating)?.rotation.current).toBe("demo");
    expect(rotating.raceController!.checkpoints.length).toBe(checkpointsOf("demo"));
    expect(() => createDefaultGameServer({ bots: 0, rotation: ["demo", "moon"] })).toThrow(/unknown track/);
  });

  it("can reach the GameServer internals the switch needs", () => {
    const { server } = setup();
    const { joinRace, directors } = serverInternals(server);
    expect(joinRace.passiveEntities).toEqual([server.raceController!.start]);
    expect(directors).toEqual([]);
  });
});
