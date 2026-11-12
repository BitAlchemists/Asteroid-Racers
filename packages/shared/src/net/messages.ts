import {
  create,
  fromBinary,
  toBinary,
  type DescMessage,
  type MessageInitShape,
  type MessageShape,
} from "@bufbuild/protobuf";
import {
  ChatMessageSchema,
  EntitySchema,
  EnvelopeSchema,
  HandshakeSchema,
  IntMessageSchema,
  MessageType,
  MovementInputSchema,
  type Envelope,
} from "./proto/index";

/**
 * Which protobuf message travels in `Envelope.payload` for each {@link MessageType}.
 * Mirrors what the Dart code actually sent: the RaceJoin/RaceEvent/RaceLeave messages in race.proto
 * were never used; the race messages carry an IntMessage with an entity id, or nothing.
 */
export const payloadSchemas = {
  [MessageType.CHAT]: ChatMessageSchema,
  [MessageType.ENTITY]: EntitySchema,
  [MessageType.ENTITY_REMOVE]: IntMessageSchema, // entity id
  [MessageType.HANDSHAKE]: HandshakeSchema,
  [MessageType.PLAYER]: EntitySchema, // the receiving client's own ship
  [MessageType.PING_PONG]: IntMessageSchema, // ms since sender start
  [MessageType.COLLISION]: IntMessageSchema, // id of the ship that crashed
  [MessageType.INPUT]: MovementInputSchema,
  [MessageType.RACE_JOIN]: IntMessageSchema, // race portal entity id
  [MessageType.RACE_EVENT]: IntMessageSchema, // next active checkpoint entity id
  [MessageType.RACE_LEAVE]: null, // no payload
} as const satisfies Record<MessageType, DescMessage | null>;

type PayloadSchemas = typeof payloadSchemas;

/** Decoded payload type for a message type (`undefined` for payload-less messages). */
export type Payload<T extends MessageType> = PayloadSchemas[T] extends DescMessage
  ? MessageShape<PayloadSchemas[T]>
  : undefined;

/** Accepted payload input when building a message (plain object or message). */
export type PayloadInit<T extends MessageType> = PayloadSchemas[T] extends DescMessage
  ? MessageInitShape<PayloadSchemas[T]>
  : undefined;

/** Rest-args helper so payload-less messages take no payload argument. */
export type PayloadArgs<T extends MessageType> = PayloadSchemas[T] extends DescMessage
  ? [PayloadInit<T>]
  : [];

/** Wraps a payload in an envelope. */
export function createEnvelope<T extends MessageType>(type: T, ...args: PayloadArgs<T>): Envelope {
  const schema: DescMessage | null = payloadSchemas[type];
  const envelope = create(EnvelopeSchema, { messageType: type });
  if (schema) {
    // The schema map guarantees args[0] matches `schema`; TS can't follow that through the generic.
    const init = args[0] as MessageInitShape<DescMessage>;
    envelope.payload = toBinary(schema, create(schema, init));
  }
  return envelope;
}

/** Decodes the payload of an envelope whose type is already known. */
export function readPayload<T extends MessageType>(type: T, envelope: Envelope): Payload<T> {
  const schema: DescMessage | null = payloadSchemas[type];
  return (schema ? fromBinary(schema, envelope.payload) : undefined) as Payload<T>;
}

export function encodeEnvelope(envelope: Envelope): Uint8Array {
  return toBinary(EnvelopeSchema, envelope);
}

export function decodeEnvelope(bytes: Uint8Array): Envelope {
  return fromBinary(EnvelopeSchema, bytes);
}

/** Convenience: build and serialize in one step. */
export function encodeMessage<T extends MessageType>(type: T, ...args: PayloadArgs<T>): Uint8Array {
  return encodeEnvelope(createEnvelope(type, ...args));
}

export type MessageHandler<T extends MessageType, Ctx> = (
  payload: Payload<T>,
  context: Ctx,
  envelope: Envelope,
) => void;

/**
 * Typed replacement for the Dart `Map<String, MessageHandler>` tables in ClientProxy / ServerProxy.
 * `Ctx` is whatever the handler needs (e.g. the client proxy that received the message).
 */
export class MessageDispatcher<Ctx = void> {
  private readonly handlers = new Map<MessageType, MessageHandler<MessageType, Ctx>>();

  on<T extends MessageType>(type: T, handler: MessageHandler<T, Ctx>): this {
    this.handlers.set(type, handler as MessageHandler<MessageType, Ctx>);
    return this;
  }

  off(type: MessageType): this {
    this.handlers.delete(type);
    return this;
  }

  has(type: MessageType): boolean {
    return this.handlers.has(type);
  }

  /** Returns false when no handler is registered for the envelope's type. Decode errors propagate. */
  dispatch(envelope: Envelope, context: Ctx): boolean {
    const handler = this.handlers.get(envelope.messageType);
    if (!handler) return false;
    handler(readPayload(envelope.messageType, envelope), context, envelope);
    return true;
  }
}
