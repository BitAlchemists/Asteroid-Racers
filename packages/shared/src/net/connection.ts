import type { Envelope } from "./proto/index";

/** Unsubscribes a listener. */
export type Unsubscribe = () => void;

/**
 * A bidirectional message pipe between one client and the server. Implemented in-process
 * (singleplayer, AI bots) and over WebSocket (multiplayer) in phase 3.
 */
export interface Connection {
  send(envelope: Envelope): void;
  onMessage(listener: (envelope: Envelope) => void): Unsubscribe;
  onDisconnect(listener: () => void): Unsubscribe;
  disconnect(): void;
  readonly connected: boolean;
}
