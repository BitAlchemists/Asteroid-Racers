import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { getLogger } from "@ar/shared";
import {
  bundledModels,
  ChatServer,
  ClientProxy,
  DEFAULT_MODEL_NAME,
  GameServer,
  RealtimeGameLoop,
  opponentChoice,
  registerRacingBots,
  trackByName,
  type GameLoop,
} from "@ar/server";
import { WebSocketServer } from "ws";
import { FileModelStore } from "./file-model-store";
import { createStaticHandler } from "./static-files";
import { trackBlurb, type LobbyStatus } from "./track-categories";
import { DEFAULT_ROUND_SECONDS, registerTrackLobby, trackLobby } from "./track-lobby";
import { WebSocketClientConnection } from "./web-socket-client-connection";

const log = getLogger("TCPServer");

export const DEFAULT_PORT = 1337;
export const WEB_SOCKET_PATH = "/ws";
/** Liveness/readiness probe for the container platform. */
export const HEALTH_PATH = "/health";
/** The track rotation's state for the multiplayer page (see track-lobby.ts). */
export const LOBBY_PATH = "/lobby";
/** Largest client message we accept. Inputs and chat are tiny. */
export const MAX_MESSAGE_BYTES = 64 * 1024;

export interface HostOptions {
  /** 0 picks a free port. */
  port?: number;
  host?: string;
  /** Directories with the built web client (first match wins). Omit to serve no files. */
  staticRoots?: string[];
  /** Bring your own server (tests); defaults to the demo world with chat. */
  gameServer?: GameServer;
  /** Defaults to real time. */
  loop?: GameLoop;
}

export interface RunningHost {
  readonly gameServer: GameServer;
  readonly http: Server;
  readonly port: number;
  readonly url: string;
  readonly webSocketUrl: string;
  close(): Promise<void>;
}

/**
 * Multiplayer host (replaces the Dart tcp_server): HTTP for the web client, WebSocket at /ws for
 * game traffic, and the game server ticking in real time.
 */
export async function startHost({
  port = DEFAULT_PORT,
  host = "0.0.0.0",
  staticRoots = [],
  gameServer,
  loop = new RealtimeGameLoop(),
}: HostOptions = {}): Promise<RunningHost> {
  const game = gameServer ?? createDefaultGameServer();
  const serveStatic = createStaticHandler(staticRoots);
  const startedAt = Date.now();

  const http = createServer((request, response) => {
    // Plain string match: `new URL` can throw on odd request targets, and this runs every probe.
    if (request.url?.split("?", 1)[0] === HEALTH_PATH) {
      serveHealth(request, response, game, startedAt);
      return;
    }
    if (request.url?.split("?", 1)[0] === LOBBY_PATH) {
      serveLobby(request, response, game);
      return;
    }
    serveStatic(request, response).catch((error: unknown) => {
      log.warning(`error serving ${request.url}`, error);
      if (!response.headersSent) response.writeHead(500).end("500 - Internal Server Error");
      else response.destroy();
    });
  });

  // noServer + our own upgrade handler: `ws` with a `path` filter leaves upgrades on other paths
  // hanging forever, so we answer those with 404 ourselves.
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  http.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== WEB_SOCKET_PATH) {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  });
  wss.on("connection", (socket, request) => {
    const remote = `${request.socket.remoteAddress ?? "?"}:${request.socket.remotePort ?? "?"}`;
    log.info(`client connected from ${remote}`);
    const connection = new WebSocketClientConnection(socket, remote);
    // `/ws?opponent=<showcase model id>`: the racing bots fly that model (see registerRacingBots).
    const opponent = new URL(request.url ?? "/", "http://localhost").searchParams.get("opponent");
    const leave = opponentChoice(game)?.join(opponent);
    const proxy = new ClientProxy(connection, game);
    game.connectClient(proxy);
    // The track rotation greets the player and counts their vote until they leave.
    const leaveLobby = trackLobby(game)?.join(proxy);
    connection.onDisconnect(() => {
      log.info(`client ${remote} disconnected`);
      leave?.();
      leaveLobby?.();
    });
  });

  await game.start(loop);

  await new Promise<void>((resolveListen, rejectListen) => {
    http.once("error", rejectListen);
    http.listen(port, host, () => {
      http.off("error", rejectListen);
      resolveListen();
    });
  });

  const actualPort = (http.address() as AddressInfo).port;
  const url = `http://localhost:${actualPort}`;
  log.info(`listening for connections on ${url}`);

  return {
    gameServer: game,
    http,
    port: actualPort,
    url,
    webSocketUrl: `ws://localhost:${actualPort}${WEB_SOCKET_PATH}`,
    async close() {
      game.stop();
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((done) => wss.close(() => done()));
      await new Promise<void>((done, fail) => http.close((error) => (error ? fail(error) : done())));
    },
  };
}

/**
 * GET /health: always 200 while the process serves HTTP, with a small JSON body describing the
 * state. Cheap by design (a few counters, no simulation work): it is probed every 30 s. A degraded
 * state is reported in the body, never as a 5xx.
 */
function serveHealth(
  request: IncomingMessage,
  response: ServerResponse,
  game: GameServer,
  startedAt: number,
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const body = JSON.stringify({
    status: "ok",
    clients: game.clients.size,
    frame: game.frameCount,
    uptimeS: Math.floor((Date.now() - startedAt) / 1000),
  });
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

/**
 * GET /lobby: the track rotation (current and next track, votes) or the fixed track, as JSON. Cheap
 * like /health: it reads the lobby's counters, no simulation work.
 */
function serveLobby(request: IncomingMessage, response: ServerResponse, game: GameServer) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const lobby = trackLobby(game);
  const fixed = fixedTracks.get(game);
  const status: LobbyStatus = lobby
    ? lobby.status()
    : { fixed: true, current: { name: fixed ?? "", blurb: fixed ? trackBlurb(fixed) : "" } };
  const body = JSON.stringify(status);
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

/** The fixed track of servers made by {@link createDefaultGameServer} without a rotation. */
const fixedTracks = new WeakMap<GameServer, string>();

export interface DefaultGameServerOptions {
  /** Racing bots to add (default 1, like the Dart server). */
  bots?: number;
  /** Model directory; a model trained there wins over the bundled one. */
  modelDir?: string;
  /** Track name from the registry (default `demo`); with `rotation`, the first track to race. */
  track?: string;
  /** Rotate through these tracks with votes (see track-lobby.ts); absent = `track` stays fixed. */
  rotation?: readonly string[];
  /** Longest round on one track in seconds of game time (rotation only). */
  roundSeconds?: number;
}

/** A track's world (the demo by default) with chat and racing bots. */
export function createDefaultGameServer({
  bots = 1,
  modelDir = "db",
  track,
  rotation,
  roundSeconds = DEFAULT_ROUND_SECONDS,
}: DefaultGameServerOptions = {}): GameServer {
  const first = track ?? rotation?.[0] ?? "demo";
  const server = new GameServer().loadTrack(trackByName(first));
  server.registerService(new ChatServer());
  if (rotation) {
    registerTrackLobby(server, { tracks: rotation, start: first, roundSeconds });
    log.info(`track rotation: ${rotation.join(", ")}; starting with ${first}`);
  } else {
    fixedTracks.set(server, first);
    log.info(`track: ${first}`);
  }
  if (bots > 0) {
    const trained = new FileModelStore(modelDir);
    const store = trained.load(DEFAULT_MODEL_NAME) ? trained : bundledModels();
    log.info(`racing bots use ${store === trained ? trained.path(DEFAULT_MODEL_NAME) : "the bundled model"}`);
    registerRacingBots(server, { bots, defaultStore: store, defaultName: DEFAULT_MODEL_NAME });
  }
  return server;
}
