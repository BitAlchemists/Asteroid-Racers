import { ConnectionEvents, decodeEnvelope, encodeEnvelope, getLogger } from "@ar/shared";
import type { Connection, Envelope, Unsubscribe } from "@ar/shared";
import { WebSocket, type RawData } from "ws";

const log = getLogger("TCPServer.WebSocketClientConnection");

/** A client that can't keep up (this much unsent data queued) gets disconnected. */
export const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

/** Server side of one multiplayer client: binary protobuf envelopes over a `ws` socket. */
export class WebSocketClientConnection implements Connection {
  private readonly events = new ConnectionEvents();
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    readonly remoteAddress = "unknown",
  ) {
    socket.on("message", (data, isBinary) => this.receive(data, isBinary));
    socket.on("close", () => this.onClose());
    socket.on("error", (error) => {
      log.warning(`socket error from ${this.remoteAddress}`, error);
      socket.terminate();
    });
  }

  get connected(): boolean {
    return !this.closed && this.socket.readyState === WebSocket.OPEN;
  }

  send(envelope: Envelope): void {
    if (!this.connected) return;
    if (this.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      log.warning(
        `${this.remoteAddress} is too slow (${this.socket.bufferedAmount} bytes queued), disconnecting`,
      );
      this.socket.terminate();
      return;
    }
    this.socket.send(encodeEnvelope(envelope), { binary: true });
  }

  onMessage(listener: (envelope: Envelope) => void): Unsubscribe {
    return this.events.onMessage(listener);
  }

  onDisconnect(listener: () => void): Unsubscribe {
    return this.events.onDisconnect(listener);
  }

  disconnect(): void {
    this.socket.close();
  }

  private receive(data: RawData, isBinary: boolean): void {
    if (!isBinary) {
      log.warning(`ignoring text frame from ${this.remoteAddress}`);
      return;
    }
    let envelope: Envelope;
    try {
      envelope = decodeEnvelope(rawToBytes(data));
    } catch (error) {
      log.warning(`dropping undecodable message from ${this.remoteAddress}`, error);
      return;
    }
    this.events.emitMessage(envelope);
  }

  private onClose(): void {
    if (this.closed) return;
    this.closed = true;
    this.events.emitDisconnect();
    this.events.clear();
  }
}

function rawToBytes(data: RawData): Uint8Array {
  if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
