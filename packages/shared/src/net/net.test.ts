import { describe, expect, it, vi } from "vitest";
import { Vector2 } from "../math/vector2";
import { Checkpoint, CheckpointState, Entity, EntityType, Movable, RacePortal } from "../world/index";
import { EntityMarshal } from "./entity-marshal";
import {
  createEnvelope,
  decodeEnvelope,
  encodeEnvelope,
  encodeMessage,
  MessageDispatcher,
  readPayload,
} from "./messages";
import { create, EntitySchema, fromBinary, MessageType, MovementInputSchema, toBinary } from "./proto/index";

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Marshal → bytes → marshal back, i.e. what actually crosses the wire. */
function roundTrip(entity: Entity): Entity {
  const bytes = toBinary(EntitySchema, EntityMarshal.toNet(entity));
  return EntityMarshal.fromNet(fromBinary(EntitySchema, bytes));
}

describe("EntityMarshal", () => {
  it("round-trips a plain entity", () => {
    const e = new Entity({ type: EntityType.ASTEROID, position: new Vector2(1.5, -2), radius: 40 });
    e.id = 12;
    e.orientation = 1.25;
    const back = roundTrip(e);
    expect(back.constructor).toBe(Entity);
    expect(back).toMatchObject({ type: EntityType.ASTEROID, id: 12, radius: 40, orientation: 1.25 });
    expect(back.position).toEqual(new Vector2(1.5, -2));
    expect(back.displayName).toBeUndefined();
  });

  it("round-trips a ship with its movable state", () => {
    const ship = new Movable({ position: new Vector2(10, 20), displayName: "Major Tom" });
    ship.id = 3;
    ship.canMove = true;
    ship.rotationSpeed = -0.5;
    ship.velocity = new Vector2(7, 8);
    ship.acceleration = new Vector2(0, 400);
    const back = roundTrip(ship);
    expect(back).toBeInstanceOf(Movable);
    expect(back).toMatchObject({ displayName: "Major Tom", canMove: true, rotationSpeed: -0.5 });
    expect((back as Movable).velocity).toEqual(new Vector2(7, 8));
    expect((back as Movable).acceleration).toEqual(new Vector2(0, 400));
  });

  it("round-trips a checkpoint state", () => {
    const cp = new Checkpoint();
    cp.state = CheckpointState.CLEARED;
    const back = roundTrip(cp);
    expect(back).toBeInstanceOf(Checkpoint);
    expect((back as Checkpoint).state).toBe(CheckpointState.CLEARED);
  });

  it("round-trips a race portal with nested start slots, without the server-only controller", () => {
    const portal = new RacePortal();
    portal.raceController = { secret: true };
    portal.positions = [
      new Entity({ position: new Vector2(1, 1) }),
      new Entity({ position: new Vector2(2, 2) }),
    ];
    const back = roundTrip(portal) as RacePortal;
    expect(back).toBeInstanceOf(RacePortal);
    expect(back.positions.map((p) => p.position)).toEqual([new Vector2(1, 1), new Vector2(2, 2)]);
    expect(back.raceController).toBeUndefined();
  });

  it("falls back to a plain UNKNOWN entity for an out-of-range type", () => {
    const net = EntityMarshal.toNet(new Entity());
    net.type = 42;
    const back = EntityMarshal.fromNet(net);
    expect(back.type).toBe(EntityType.UNKNOWN);
    expect(back.constructor).toBe(Entity);
  });

  it("tolerates a ship message without a movable sub-message", () => {
    const net = EntityMarshal.toNet(new Entity({ type: EntityType.SHIP }));
    expect(net.movable).toBeUndefined();
    const back = EntityMarshal.fromNet(net) as Movable;
    expect(back).toBeInstanceOf(Movable);
    expect(back.velocity).toEqual(Vector2.zero());
  });

  it("keeps unset movement input fields unset, and drops NaN on encode", () => {
    const net = EntityMarshal.movementInputToNet({ accelerationFactor: 1, newOrientation: Number.NaN });
    const bytes = toBinary(MovementInputSchema, net);
    const back = EntityMarshal.movementInputFromNet(fromBinary(MovementInputSchema, bytes));
    expect(back).toEqual({ accelerationFactor: 1 });
  });

  it("encodes an explicit 0 movement field (presence, not default)", () => {
    const back = EntityMarshal.movementInputFromNet(
      fromBinary(
        MovementInputSchema,
        toBinary(MovementInputSchema, EntityMarshal.movementInputToNet({ rotationSpeed: 0 })),
      ),
    );
    expect(back).toEqual({ rotationSpeed: 0 });
  });
});

describe("messages", () => {
  it("wraps and reads a typed payload", () => {
    const envelope = createEnvelope(MessageType.COLLISION, { integer: 5 });
    const decoded = decodeEnvelope(encodeEnvelope(envelope));
    expect(decoded.messageType).toBe(MessageType.COLLISION);
    expect(readPayload(MessageType.COLLISION, decoded).integer).toBe(5);
  });

  it("accepts an already-built message as payload", () => {
    const ship = new Movable();
    ship.id = 9;
    const envelope = createEnvelope(MessageType.PLAYER, EntityMarshal.toNet(ship));
    const entity = EntityMarshal.fromNet(readPayload(MessageType.PLAYER, envelope));
    expect(entity.id).toBe(9);
  });

  it("encodes payload-less RACE_LEAVE exactly like Dart did (type only, no payload field)", () => {
    expect(hex(encodeMessage(MessageType.RACE_LEAVE))).toBe("080b");
    expect(readPayload(MessageType.RACE_LEAVE, createEnvelope(MessageType.RACE_LEAVE))).toBeUndefined();
  });

  it("encodes a ping envelope with the proto2 wire layout", () => {
    // field 1 varint = 6 (PING_PONG), field 2 bytes = IntMessage{ field 1 varint = 300 }
    expect(hex(encodeMessage(MessageType.PING_PONG, { integer: 300 }))).toBe("0806120308ac02");
  });

  it("chat payload round-trips", () => {
    const envelope = decodeEnvelope(encodeMessage(MessageType.CHAT, { from: "Luke", text: "hi" }));
    expect(readPayload(MessageType.CHAT, envelope)).toMatchObject({ from: "Luke", text: "hi" });
  });

  it("MessageDispatcher routes by type with context and reports unhandled types", () => {
    const onInput = vi.fn();
    const dispatcher = new MessageDispatcher<string>().on(MessageType.INPUT, onInput);

    const input = create(MovementInputSchema, { accelerationFactor: 0.5 });
    const handled = dispatcher.dispatch(createEnvelope(MessageType.INPUT, input), "client-1");
    expect(handled).toBe(true);
    expect(onInput).toHaveBeenCalledOnce();
    expect(onInput.mock.calls[0]?.[0]).toMatchObject({ accelerationFactor: 0.5 });
    expect(onInput.mock.calls[0]?.[1]).toBe("client-1");

    expect(dispatcher.dispatch(createEnvelope(MessageType.CHAT, { text: "x" }), "client-1")).toBe(false);
    dispatcher.off(MessageType.INPUT);
    expect(dispatcher.has(MessageType.INPUT)).toBe(false);
  });
});
