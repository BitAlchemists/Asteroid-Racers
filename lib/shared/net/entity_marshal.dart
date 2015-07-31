part of net;

class EntityMarshal {

  //TODO: add movable, raceportal, checkpoint
  static world.Entity netEntityToWorldEntity(Entity netEntity) {
    world.Entity worldEntity = new world.Entity();

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

    return netEntity;
  }

  static world.Vector2 netVector2ToWorldVector2(Vector2 netVector2) {
    double x = 0.0;
    double y = 0.0;

    if(netVector2.x != null) {
      x = netVector2.x;
    }
    else
    {
      print("netVector2ToWorldVector2: x == 0");
    }

    if(netVector2.y != null) {
      y = netVector2.y;
    }
    else
    {
      print("netVector2ToWorldVector2: y == 0");
    }

    return new world.Vector2(x,y);
  }

  static Vector2 worldVector2ToNetVector2(world.Vector2 worldVector2) {
    double x = 0.0;
    double y = 0.0;

    if(worldVector2.x != null) {
      x = worldVector2.x;
    }
    else
    {
      print("worldVector2ToNetVector2: x == 0");
    }

    if(worldVector2.y != null) {
      y = worldVector2.y;
    }
    else
    {
      print("worldVector2ToNetVector2: y == 0");
    }

    Vector2 netVector2 = new Vector2();
    netVector2.x = x;
    netVector2.y = y;
    return netVector2;
  }
}