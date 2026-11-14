import {
  createEnvelope,
  EntityMarshal,
  getLogger,
  MessageType,
  Vector2,
  type Entity,
  type MessageHandler,
} from "@ar/shared";
import {
  AIDirector,
  CollisionDetector,
  trackByName,
  type GameServer,
  type IClientProxy,
  type IServerService,
  type Track,
} from "@ar/server";
import { trackBlurb, type LobbyStatus, type TrackInfo } from "./track-categories";
import { TrackRotation } from "./track-rotation";

const log = getLogger("TrackLobby");

/** Who lobby messages come from in the chat. */
export const LOBBY_SENDER = "Lobby";
/**
 * A track's round ends at the first finish on it (by anyone, bots included), or after this many
 * seconds of game time if nobody finishes. The switch then waits until no human is racing.
 */
export const DEFAULT_ROUND_SECONDS = 240;
/**
 * A racer who hasn't cleared a checkpoint yet and is within this distance of their start slot is
 * on the start grid, not racing: a switch may carry them to the new track's grid. (Every file track
 * starts at the world spawn, so a player who connects or respawns there lands on the grid.)
 */
export const START_GRID_RADIUS = 200;

export interface TrackLobby {
  readonly rotation: TrackRotation<IClientProxy>;
  /** True once the round on the current track is over (the switch may still wait for racers). */
  readonly roundOver: boolean;
  status(): LobbyStatus;
  /** A human player joined (through the host); the returned function marks them gone. */
  join(client: IClientProxy): () => void;
  /** Votes for `query` (a track name or an unambiguous part of one); returns the reply. */
  vote(client: IClientProxy, query: string): string;
  /** Ends the round now (as a finish would); the switch still waits for racing humans. */
  endRound(): void;
}

export interface TrackLobbyOptions {
  /** The rotation, in order. */
  tracks: readonly string[];
  /** The first track (default: the first of `tracks`); must already be loaded into the server. */
  start?: string;
  roundSeconds?: number;
  /** Builds a track by name (default: the registry). */
  resolve?: (name: string) => Track;
}

const lobbies = new WeakMap<GameServer, TrackLobby>();

/** The track lobby of a server set up with {@link registerTrackLobby}, if any. */
export function trackLobby(server: GameServer): TrackLobby | undefined {
  return lobbies.get(server);
}

/** Runs `check` every frame after the race update (a server service). */
class LobbyService implements IServerService {
  constructor(readonly postUpdate: () => void) {}
}

/**
 * Multiplayer rotation over `tracks` with votes. The server must already have the start track
 * loaded, and the chat (ChatServer) registered before this, so `/vote` can be taken out of it.
 *
 * - The round on a track ends at the first finish (anyone's) or after `roundSeconds`.
 * - The track then switches as soon as no human is racing. A human in the race who is still on the
 *   start grid (no checkpoint cleared since joining or finishing, and near their start slot) is
 *   not racing: they are carried to the new track's grid. Humans outside the race are put next to
 *   the new start. Bots restart on the new track with the model they flew (the opponent choice is
 *   unaffected).
 * - Players vote with `/vote <track>` in the chat (the multiplayer page has buttons for it); one
 *   vote per player, gone when they leave; most votes wins, ties go to rotation order.
 */
export function registerTrackLobby(
  server: GameServer,
  { tracks, start, roundSeconds = DEFAULT_ROUND_SECONDS, resolve = trackByName }: TrackLobbyOptions,
): TrackLobby {
  for (const name of tracks) resolve(name); // unknown names fail now, not at the first switch
  const rotation = new TrackRotation<IClientProxy>(tracks, start);
  const humans = new Set<IClientProxy>();
  let roundStart = server.gameTime;
  let finishedOnTrack = false;
  let announcedWait = false;

  const say = (text: string) =>
    server.broadcastMessage(createEnvelope(MessageType.CHAT, { from: LOBBY_SENDER, text }));
  const tell = (client: IClientProxy, text: string) =>
    client.send(createEnvelope(MessageType.CHAT, { from: LOBBY_SENDER, text }));
  const info = (name: string): TrackInfo => ({ name, blurb: trackBlurb(name) });
  const nextLine = () => {
    const tally = rotation.tally();
    const votes = tally.length ? ` (votes: ${tally.map((t) => `${t.track} ${t.votes}`).join(", ")})` : "";
    return `Next track: ${rotation.next}${rotation.nextBy === "rotation" ? " (rotation)" : votes}.`;
  };

  const hookRace = () => {
    const race = server.raceController;
    if (!race) return;
    race.onFinish = () => {
      finishedOnTrack = true;
    };
  };
  hookRace();

  const roundOver = () => finishedOnTrack || server.gameTime - roundStart >= roundSeconds;
  const onGrid = (client: IClientProxy): boolean => {
    const race = server.raceController;
    const ship = client.movable;
    if (!race || !ship || race.progressOf(client) !== 0) return false;
    return ship.position.distanceTo(race.spawnEntityForPlayer(client).position) <= START_GRID_RADIUS;
  };
  const humanRacing = (): boolean => {
    const race = server.raceController;
    if (!race) return false;
    for (const client of humans) if (race.isClientInRace(client) && !onGrid(client)) return true;
    return false;
  };

  const switchTrack = () => {
    const carry = [...humans].filter((c) => server.raceController?.isClientInRace(c));
    const name = rotation.advance();
    log.info(`switching to track ${name}`);
    replaceTrack(server, resolve(name), { humans, carry });
    hookRace();
    roundStart = server.gameTime;
    finishedOnTrack = false;
    announcedWait = false;
    say(`Track: ${name}. ${trackBlurb(name)} ${nextLine()}`);
  };

  server.registerService(
    new LobbyService(() => {
      if (!roundOver()) return;
      if (!humanRacing()) switchTrack();
      else if (!announcedWait) {
        announcedWait = true;
        say(`${nextLine()} It starts when the current race is over.`);
      }
    }),
  );

  // `/vote`, `/tracks` and `/next` are lobby commands, not chat lines.
  const chat = server.dispatcher.handler(MessageType.CHAT) as
    MessageHandler<MessageType.CHAT, IClientProxy> | undefined;
  server.dispatcher.on(MessageType.CHAT, (message, client, envelope) => {
    const [command, ...rest] = message.text.trim().split(/\s+/);
    const lower = command?.toLowerCase();
    if (lower === "/vote" && rest.length > 0) tell(client, lobby.vote(client, rest.join(" ")));
    else if (lower === "/vote" || lower === "/tracks" || lower === "/next" || lower === "/track")
      tell(client, `Track: ${rotation.current}. ${nextLine()} Vote: /vote <${rotation.tracks.join(" | ")}>`);
    else chat?.(message, client, envelope);
  });

  const lobby: TrackLobby = {
    rotation,
    get roundOver() {
      return roundOver();
    },
    status() {
      const votes: Record<string, number> = {};
      for (const { track, votes: n } of rotation.tally()) votes[track] = n;
      return {
        fixed: false,
        current: info(rotation.current),
        next: { ...info(rotation.next), by: rotation.nextBy },
        votes,
        waiting: roundOver(),
        roundLeftS: Math.max(0, Math.ceil(roundSeconds - (server.gameTime - roundStart))),
        tracks: rotation.tracks.map(info),
        players: humans.size,
      };
    },
    join(client) {
      humans.add(client);
      tell(
        client,
        `Track: ${rotation.current}. ${nextLine()} Vote for the next race track with the Tracks button or /vote <track>.`,
      );
      let gone = false;
      return () => {
        if (gone) return;
        gone = true;
        humans.delete(client);
        if (rotation.withdraw(client)) say(nextLine());
      };
    },
    vote(client, query) {
      const q = query.trim().toLowerCase();
      const exact = rotation.tracks.find((t) => t === q);
      const matches = exact ? [exact] : rotation.tracks.filter((t) => t.includes(q));
      if (matches.length !== 1)
        return matches.length === 0
          ? `No race track "${query}". Race tracks: ${rotation.tracks.join(", ")}.`
          : `"${query}" could be ${matches.join(" or ")}.`;
      const track = matches[0]!;
      rotation.vote(client, track);
      say(`${client.playerName ?? "A player"} votes for ${track}. ${nextLine()}`);
      return `Your vote: ${track}.`;
    },
    endRound() {
      finishedOnTrack = true;
    },
  };
  lobbies.set(server, lobby);
  return lobby;
}

// --- switching the track of a running server -----------------------------------------------------

/**
 * GameServer has no "replace the track" yet, and `packages/server/src` is in the training binding,
 * so the switch is done from here. It needs two private parts of the server: the portal detector
 * (to drop the old portal and give players their ticket back) and the service list (to restart the
 * bots). A test pins both; if GameServer changes, that test fails rather than the live game.
 */
interface GameServerInternals {
  joinRaceDetector: unknown;
  services: unknown;
}

export function serverInternals(server: GameServer): {
  joinRace: CollisionDetector;
  directors: AIDirector[];
} {
  const internals = server as unknown as GameServerInternals;
  const joinRace = internals.joinRaceDetector;
  const services = internals.services;
  if (!(joinRace instanceof CollisionDetector) || !Array.isArray(services))
    throw new Error("GameServer internals changed: no joinRaceDetector or services");
  return { joinRace, directors: services.filter((s): s is AIDirector => s instanceof AIDirector) };
}

export interface ReplaceTrackOptions {
  /** Human players (they get their portal ticket back and a safe place next to the new start). */
  humans?: ReadonlySet<IClientProxy>;
  /** Humans to put straight onto the new race's start grid (they were on the old one's). */
  carry?: readonly IClientProxy[];
}

/**
 * Swaps the running server's track for `track`: racers leave the old race, the old track's
 * entities are removed (clients get ENTITY_REMOVE), the new one is built and sent to everyone, bots
 * restart on it. Call it only when no human is in the middle of a race.
 */
export function replaceTrack(
  server: GameServer,
  track: Track,
  { humans = new Set(), carry = [] }: ReplaceTrackOptions = {},
): void {
  const { joinRace, directors } = serverInternals(server);
  // Bots reconnect into the new world with the model they flew (their loops restart them).
  for (const director of directors) director.stopAll();

  const oldRace = server.raceController;
  for (const client of oldRace?.players ?? []) server.clientLeavesRace(client);

  const ships = new Set<Entity>();
  for (const client of server.clients) if (client.movable) ships.add(client.movable);
  for (const entity of [...server.world.entities.values()])
    if (!ships.has(entity)) server.removeObstacle(entity); // also plain despawns for non-obstacles
  server.world.passiveCollisionEntities.length = 0;
  const portal = oldRace?.start;
  if (portal) {
    const index = joinRace.passiveEntities.indexOf(portal);
    if (index !== -1) joinRace.passiveEntities.splice(index, 1);
    joinRace.invalidate();
  }

  const before = new Set(server.world.entities.keys());
  server.loadTrack(track);
  for (const entity of server.world.entities.values())
    if (!before.has(entity.id))
      server.broadcastMessage(createEnvelope(MessageType.ENTITY, EntityMarshal.toNet(entity)));

  const race = server.raceController!;
  const carried = new Set(carry);
  for (const client of humans) {
    const ship = client.movable;
    if (!ship || !server.clients.has(client)) continue;
    if (carried.has(client) && race.addPlayer(client)) continue; // their ticket stays used
    if ((client.collisions ?? "all") === "all") joinRace.activate(ship);
    const place = placeNearStart(server);
    if (place) server.teleportPlayerTo(client, place.position, place.orientation);
    else server.spawnPlayer(client);
  }
}

/** Ship radius plus a margin, for the free-space check. */
const SHIP_ROOM = 20 + 40;

/**
 * A free spot behind (then beside) the new start portal, facing it, so a player can fly in when
 * they like. Undefined if every candidate is blocked by a rock.
 */
function placeNearStart(server: GameServer): { position: Vector2; orientation: number } | undefined {
  const portal = server.raceController?.start;
  if (!portal) return undefined;
  const o = portal.orientation;
  const ahead = new Vector2(-Math.sin(o), Math.cos(o)); // the travel direction (see crossesGate)
  const side = new Vector2(-ahead.y, ahead.x);
  const rocks = server.world.passiveCollisionEntities;
  for (const distance of [portal.radius + 160, portal.radius + 320, portal.radius + 520]) {
    for (const [back, across] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [0.7, -0.7],
    ] as const) {
      const position = portal.position
        .plus(ahead.scaled(-back * distance))
        .plus(side.scaled(across * distance));
      if (rocks.every((r) => r.position.distanceTo(position) > r.radius + SHIP_ROOM)) {
        // Face the portal.
        const to = portal.position.minus(position);
        return { position, orientation: Math.atan2(-to.x, to.y) };
      }
    }
  }
  return undefined;
}
