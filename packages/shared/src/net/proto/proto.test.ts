import { describe, expect, it } from "vitest";
import {
  create,
  EntitySchema,
  EnvelopeSchema,
  fromBinary,
  MessageType,
  toBinary,
  Vector2Schema,
} from "./index";

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("protobuf codecs", () => {
  it("encodes Vector2 with the proto2 wire format the Dart client used", () => {
    // field 1 (double) = 1.0, field 2 (double) = 2.0
    expect(hex(toBinary(Vector2Schema, create(Vector2Schema, { x: 1, y: 2 })))).toBe(
      "09000000000000f03f110000000000000040",
    );
  });

  it("round-trips an Entity wrapped in an Envelope", () => {
    const entity = create(EntitySchema, {
      type: 3,
      id: 123,
      displayName: "Fritz",
      position: { x: 34.56, y: 345.53 },
      orientation: Math.PI,
      radius: 10,
      movable: { canMove: true, rotationSpeed: 0.5, velocity: { x: 1, y: -1 } },
    });
    const envelope = create(EnvelopeSchema, {
      messageType: MessageType.ENTITY,
      payload: toBinary(EntitySchema, entity),
    });

    const decodedEnvelope = fromBinary(EnvelopeSchema, toBinary(EnvelopeSchema, envelope));
    expect(decodedEnvelope.messageType).toBe(MessageType.ENTITY);

    const decoded = fromBinary(EntitySchema, decodedEnvelope.payload!);
    expect(decoded.displayName).toBe("Fritz");
    expect(decoded.position).toMatchObject({ x: 34.56, y: 345.53 });
    expect(decoded.movable?.velocity).toMatchObject({ x: 1, y: -1 });
  });
});
