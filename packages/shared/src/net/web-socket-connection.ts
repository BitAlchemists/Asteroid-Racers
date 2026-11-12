import { getLogger } from "../logging";
import { ConnectionEvents, type ServerConnection, type Unsubscribe } from "./connection";
import { decodeEnvelope, encodeEnvelope } from "./messages";
import type { Envelope } from "./proto/index";

const log = getLogger("GameClient.Net.WebSocketServerConnection");

/** The subset of the WHATWG WebSocket API we use (browsers, and Node ≥ 22 as a global). */
export interface WebSocketLike {
  binaryType: string;
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  send(data: Uint8Array): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

const OPEN = 1;

function defaultFactory(url: string): WebSocketLike {
  const ctor = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
  if (!ctor) throw new Error("No global WebSocket available (needs a browser or Node ≥ 22)");
  return new ctor(url);
}

/** Client side of a multiplayer connection: binary protobuf envelopes over a WebSocket. */
export class WebSocketServerConnection implements ServerConnection {
  private socket: WebSocketLike | undefined;
  private readonly events = new ConnectionEvents();
  private opened = false;

  constructor(
    readonly url: string,
    private readonly createSocket: WebSocketFactory = defaultFactory,
  ) {}

  get connected(): boolean {
    return this.socket?.readyState === OPEN;
  }

  connect(): Promise<void> {
    if (this.socket) return Promise.reject(new Error("already connecting or connected"));

    return new Promise<void>((resolve, reject) => {
      const socket = this.createSocket(this.url);
      socket.binaryType = "arraybuffer";
      this.socket = socket;
      this.opened = false;

      socket.onopen = () => {
        this.opened = true;
        resolve();
      };
      socket.onmessage = (event) => this.receive(event.data);
      // Browsers fire error then close; Node's built-in WebSocket fires only `error` when the
      // handshake is refused. Treat whichever comes first as the end of this socket.
      const end = () => {
        if (this.socket !== socket) return; // already handled
        const wasOpen = this.opened;
        this.detach();
        if (wasOpen) this.events.emitDisconnect();
        else reject(new Error(`could not connect to ${this.url}`));
        if (socket.readyState < 2) socket.close(); // make sure the socket is torn down
      };
      socket.onerror = end;
      socket.onclose = end;
    });
  }

  send(envelope: Envelope): void {
    if (this.socket?.readyState === OPEN) {
      this.socket.send(encodeEnvelope(envelope));
    } else {
      log.warning(`WebSocket not connected, message type ${envelope.messageType} not sent`);
    }
  }

  onMessage(listener: (envelope: Envelope) => void): Unsubscribe {
    return this.events.onMessage(listener);
  }

  onDisconnect(listener: () => void): Unsubscribe {
    return this.events.onDisconnect(listener);
  }

  /** Closes the socket; disconnect listeners fire once the close completes. */
  disconnect(): void {
    this.socket?.close();
  }

  private receive(data: unknown): void {
    let envelope: Envelope;
    try {
      envelope = decodeEnvelope(toBytes(data));
    } catch (error) {
      log.warning("dropping undecodable message", error);
      return;
    }
    this.events.emitMessage(envelope);
  }

  private detach(): void {
    if (!this.socket) return;
    this.socket.onopen = this.socket.onclose = this.socket.onerror = this.socket.onmessage = null;
    this.socket = undefined;
    this.opened = false;
  }
}

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  throw new TypeError("expected a binary WebSocket message");
}
