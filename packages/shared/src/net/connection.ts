import type { Envelope } from "./proto/index";

/** Unsubscribes a listener. */
export type Unsubscribe = () => void;

/**
 * A bidirectional message pipe between one client and the server. Implemented in-process
 * (singleplayer, AI bots) and over WebSocket (multiplayer).
 */
export interface Connection {
  send(envelope: Envelope): void;
  onMessage(listener: (envelope: Envelope) => void): Unsubscribe;
  onDisconnect(listener: () => void): Unsubscribe;
  disconnect(): void;
  readonly connected: boolean;
}

/** The client's end of a connection: it has to be opened first. */
export interface ServerConnection extends Connection {
  /** Resolves once messages can flow; rejects if the connection can't be established. */
  connect(): Promise<void>;
}

/**
 * Listener bookkeeping shared by the Connection implementations. Listener lists are copied before
 * notifying, so listeners may unsubscribe while being called.
 */
export class ConnectionEvents {
  private messageListeners: ((envelope: Envelope) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];

  onMessage(listener: (envelope: Envelope) => void): Unsubscribe {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    };
  }

  onDisconnect(listener: () => void): Unsubscribe {
    this.disconnectListeners.push(listener);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((l) => l !== listener);
    };
  }

  emitMessage(envelope: Envelope): void {
    for (const listener of [...this.messageListeners]) listener(envelope);
  }

  emitDisconnect(): void {
    for (const listener of [...this.disconnectListeners]) listener();
  }

  clear(): void {
    this.messageListeners = [];
    this.disconnectListeners = [];
  }
}
