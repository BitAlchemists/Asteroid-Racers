import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { getLogger } from "@ar/shared";
import { ChatServer, ClientProxy, GameServer, RealtimeGameLoop, type GameLoop } from "@ar/server";
import { WebSocketServer } from "ws";
import { createStaticHandler } from "./static-files";
import { WebSocketClientConnection } from "./web-socket-client-connection";

const log = getLogger("TCPServer");

export const DEFAULT_PORT = 1337;
export const WEB_SOCKET_PATH = "/ws";
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

  const http = createServer((request, response) => {
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
    connection.onDisconnect(() => log.info(`client ${remote} disconnected`));
    game.connectClient(new ClientProxy(connection, game));
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

export function createDefaultGameServer(): GameServer {
  const server = new GameServer().prepareDemoConfiguration();
  server.registerService(new ChatServer());
  // The AI racing service is registered here once it is ported (phase 5).
  return server;
}
