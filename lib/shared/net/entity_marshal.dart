part of net;

class EntityMarshal {

  static world.Entity netEntityToWorldEntity(Entity netEntity) {

    world.EntityType entityType = world.EntityType.values[netEntity.type];

    world.Entity worldEntity;

    switch(entityType){
      case world.EntityType.SHIP:
        world.Movable movable = new world.Movable();

        Entity_Movable netMovable = netEntity.movable;

        movable.canMove = netMovable.canMove;
        movable.acceleration = EntityMarshal.netVector2ToWorldVector2(netMovable.acceleration);
        movable.velocity = EntityMarshal.netVector2ToWorldVector2(netMovable.velocity);
        movable.rotationSpeed = netMovable.rotationSpeed;

        worldEntity = movable;

        break;
      case world.EntityType.LAUNCH_PLATFORM:
        world.RacePortal racePortal = new world.RacePortal();

        Entity_RacePortal netRacePortal = netEntity.racePortal;

        racePortal.positions = netRacePortal.positions.map((Entity netEntity) => EntityMarshal.netEntityToWorldEntity(netEntity)).toList();

        worldEntity = racePortal;
        break;
      case world.EntityType.CHECKPOINT:
        world.Checkpoint checkpoint = new world.Checkpoint();

        Entity_Checkpoint netCheckpoint = netEntity.checkpoint;

        checkpoint.state = world.CheckpointState.values[netCheckpoint.state];

        worldEntity = checkpoint;

        break;
      default:
        worldEntity = new world.Entity();
        break;
    }

    if(netEntity.type != null) {
      worldEntity.type = world.EntityType.values[netEntity.type];
    }

    if(netEntity.id != null){
      worldEntity.id = netEntity.id;
    }

    if(netEntity.displayName != null){
      worldEntity.displayName = netEntity.displayName;
    }

    if(netEntity.position != null){
      worldEntity.position = EntityMarshal.netVector2ToWorldVector2(netEntity.position);
    }

    if(netEntity.orientation != null){
      worldEntity.orientation = netEntity.orientation;
    }

    if(netEntity.radius != null){
      worldEntity.radius = netEntity.radius;
    }

    return worldEntity;
  }

  static Entity worldEntityToNetEntity(world.Entity worldEntity) {
    Entity netEntity = new Entity();

    if(worldEntity.type != null) {
      netEntity.type = worldEntity.type.index;
    }

    if(worldEntity.id != null){
      netEntity.id = worldEntity.id;
    }

    if(worldEntity.displayName != null){
      netEntity.displayName = worldEntity.displayName;
    }

    if(worldEntity.position != null){
      netEntity.position = EntityMarshal.worldVector2ToNetVector2(worldEntity.position);
    }

    if(worldEntity.orientation != null){
      netEntity.orientation = worldEntity.orientation;
    }

    if(worldEntity.radius != null){
      netEntity.radius = worldEntity.radius;
    }

    switch(worldEntity.type) {
      case world.EntityType.SHIP:
        world.Movable movable = worldEntity as world.Movable;

        Entity_Movable netMovable = new Entity_Movable();
        netMovable.canMove = movable.canMove;
        netMovable.acceleration = EntityMarshal.worldVector2ToNetVector2(movable.acceleration);
        netMovable.velocity = EntityMarshal.worldVector2ToNetVector2(movable.velocity);
        netMovable.rotationSpeed = movable.rotationSpeed;

        netEntity.movable = netMovable;
        break;
      case world.EntityType.LAUNCH_PLATFORM:
        world.RacePortal racePortal = worldEntity as world.RacePortal;

        Entity_RacePortal netRacePortal = new Entity_RacePortal();
        netRacePortal.positions.addAll(racePortal.positions.map((world.Entity entity) => EntityMarshal.worldEntityToNetEntity(entity)));

        netEntity.racePortal = netRacePortal;
        break;
      case world.EntityType.CHECKPOINT:
        world.Checkpoint checkpoint = worldEntity as world.Checkpoint;

        Entity_Checkpoint netCheckpoint = new Entity_Checkpoint();
        netCheckpoint.state = checkpoint.state.index;

        netEntity.checkpoint = netCheckpoint;
        break;
      default:
        break;
    }

    return netEntity;
  }

  static world.Vector2 netVector2ToWorldVector2(Vector2 netVector2) {
    assert(netVector2.x != null);
    assert(netVector2.y != null);

    return new world.Vector2(netVector2.x,netVector2.y);
  }

  static Vector2 worldVector2ToNetVector2(world.Vector2 worldVector2) {
    assert(worldVector2.x != null);
    assert(worldVector2.y != null);

    Vector2 netVector2 = new Vector2();
    netVector2.x = worldVector2.x;
    netVector2.y = worldVector2.y;
    return netVector2;
  }

  static MovementInput worldMovementInputToNetMovementInput(world.MovementInput worldMovementInput){
    MovementInput netMovementInput = new MovementInput();
    netMovementInput.newOrientation = worldMovementInput.newOrientation;
    netMovementInput.accelerationFactor = worldMovementInput.accelerationFactor;
    netMovementInput.rotationSpeed = worldMovementInput.rotationSpeed;
    return netMovementInput;
  }

  static world.MovementInput netMovementInputToWorldMovementInput(MovementInput netMovementInput){
    world.MovementInput worldMovementInput = new world.MovementInput();
    worldMovementInput.newOrientation = netMovementInput.newOrientation;
    worldMovementInput.accelerationFactor = netMovementInput.accelerationFactor;
    worldMovementInput.rotationSpeed = netMovementInput.rotationSpeed;
    return worldMovementInput;
  }
}