import { create, isFieldSet } from "@bufbuild/protobuf";
import { Vector2 } from "../math/vector2";
import { CheckpointState, Entity, EntityType, isCheckpointState, isEntityType } from "../world/entity";
import { Checkpoint } from "../world/checkpoint";
import { Movable, type MovementInput } from "../world/movable";
import { RacePortal } from "../world/race-portal";
import { attachedValue, createEnvelope, createLazyEnvelope } from "./messages";
import * as pb from "./proto/index";

/** Converts between world objects and their protobuf transfer objects. */
export const EntityMarshal = {
  toNet(entity: Entity): pb.Entity {
    const net = create(pb.EntitySchema, {
      type: entity.type,
      id: entity.id,
      position: vector2ToNet(entity.position),
      orientation: entity.orientation,
      radius: entity.radius,
    });
    if (entity.displayName !== undefined) net.displayName = entity.displayName;

    if (entity instanceof Movable) {
      net.movable = create(pb.Entity_MovableSchema, {
        canMove: entity.canMove,
        rotationSpeed: entity.rotationSpeed,
        acceleration: vector2ToNet(entity.acceleration),
        velocity: vector2ToNet(entity.velocity),
      });
    } else if (entity instanceof RacePortal) {
      net.racePortal = create(pb.Entity_RacePortalSchema, {
        positions: entity.positions.map((slot) => EntityMarshal.toNet(slot)),
      });
    } else if (entity instanceof Checkpoint) {
      net.checkpoint = create(pb.Entity_CheckpointSchema, { state: entity.state });
    }
    return net;
  },

  fromNet(net: pb.Entity): Entity {
    const type = isEntityType(net.type) ? net.type : EntityType.UNKNOWN;
    let entity: Entity;

    switch (type) {
      case EntityType.SHIP: {
        const movable = new Movable();
        if (net.movable) {
          movable.canMove = net.movable.canMove;
          movable.rotationSpeed = net.movable.rotationSpeed;
          if (net.movable.acceleration) movable.acceleration = vector2FromNet(net.movable.acceleration);
          if (net.movable.velocity) movable.velocity = vector2FromNet(net.movable.velocity);
        }
        entity = movable;
        break;
      }
      case EntityType.LAUNCH_PLATFORM: {
        const portal = new RacePortal();
        portal.positions = net.racePortal?.positions.map((slot) => EntityMarshal.fromNet(slot)) ?? [];
        entity = portal;
        break;
      }
      case EntityType.CHECKPOINT: {
        const checkpoint = new Checkpoint();
        const state = net.checkpoint?.state;
        checkpoint.state = state !== undefined && isCheckpointState(state) ? state : CheckpointState.FUTURE;
        entity = checkpoint;
        break;
      }
      default:
        entity = new Entity();
    }

    entity.type = type;
    entity.id = net.id;
    if (isFieldSet(net, pb.EntitySchema.field.displayName)) entity.displayName = net.displayName;
    if (net.position) entity.position = vector2FromNet(net.position);
    entity.orientation = net.orientation;
    entity.radius = net.radius;
    return entity;
  },

  movementInputToNet(input: MovementInput): pb.MovementInput {
    const net = create(pb.MovementInputSchema);
    if (isPresent(input.accelerationFactor)) net.accelerationFactor = input.accelerationFactor;
    if (isPresent(input.newOrientation)) net.newOrientation = input.newOrientation;
    if (isPresent(input.rotationSpeed)) net.rotationSpeed = input.rotationSpeed;
    return net;
  },

  /** Unset optional fields stay `undefined` (Dart silently turned them into 0.0). */
  movementInputFromNet(net: pb.MovementInput): MovementInput {
    const fields = pb.MovementInputSchema.field;
    const input: MovementInput = {};
    if (isFieldSet(net, fields.accelerationFactor)) input.accelerationFactor = net.accelerationFactor;
    if (isFieldSet(net, fields.newOrientation)) input.newOrientation = net.newOrientation;
    if (isFieldSet(net, fields.rotationSpeed)) input.rotationSpeed = net.rotationSpeed;
    return input;
  },
};

/**
 * An ENTITY message for `entity`. For a ship, in-process receivers get a snapshot taken now instead
 * of decoding `toNet` (the protobuf payload is built only if needed): `fromNet(toNet(ship))` is a
 * Movable with exactly the snapshot's fields, since every field travels as a double, int, bool or
 * string.
 */
export function createEntityEnvelope(entity: Entity): pb.Envelope {
  if (!(entity instanceof Movable) || entity.type !== EntityType.SHIP)
    return createEnvelope(pb.MessageType.ENTITY, EntityMarshal.toNet(entity));
  const snapshot = entity.clone();
  return createLazyEnvelope(pb.MessageType.ENTITY, () => EntityMarshal.toNet(snapshot), snapshot);
}

/** The ship snapshot of an envelope made by {@link createEntityEnvelope} (receivers copy it). */
export function attachedShip(envelope: pb.Envelope): Movable | undefined {
  const value = attachedValue(envelope);
  return value instanceof Movable ? value : undefined;
}

export function vector2ToNet(v: Vector2): pb.Vector2 {
  return create(pb.Vector2Schema, { x: v.x, y: v.y });
}

export function vector2FromNet(v: pb.Vector2): Vector2 {
  return new Vector2(v.x, v.y);
}

function isPresent(value: number | undefined): value is number {
  return value !== undefined && !Number.isNaN(value);
}
