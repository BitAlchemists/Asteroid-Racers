part of ar_shared;

enum EntityType {
  ASTEROID,
  SHIP,
  CHECKPOINT,
  LAUNCH_PLATFORM,
  ARROWS,
  FINISH,
}

class CheckpointState {
  static const int CLEARED = 0;
  static const int CURRENT = 1;
  static const int FUTURE = 2;
}

class Entity
{
  EntityType type;
  int id;
  String displayName;
  Vector2 position;
  double orientation = 0.0;
  double radius;
  
  Entity(this.type, {this.position, this.radius: 1.0});
  
  Map<int, Function> deserializers = 
    {
      EntityType.SHIP.index: (list) => new Movable.fromJson(list),
      EntityType.LAUNCH_PLATFORM.index: (list) => new RacePortal.fromJson(list),
      EntityType.CHECKPOINT.index: (list) => new Checkpoint.fromJson(list),
    };
  
  factory Entity.deserialize(List list){
    Entity entity;
    
    int entityTypeIndex = list[0];
    EntityType entityType = entityTypeIndex == null ? null : EntityType.values[entityTypeIndex];
    
    switch(entityType){
      case EntityType.SHIP:
        entity = new Movable.fromJson(list);
        break;
      case EntityType.LAUNCH_PLATFORM:
        entity = new RacePortal.fromJson(list);
        break;
      case EntityType.CHECKPOINT:
        entity = new Checkpoint.fromJson(list);
        break;
      default:
        entity = new Entity.fromJson(list);
        break;
    }
    
    return entity;
  }
  
  Entity.fromJson(List list){
    assert(list != null);
    
    try{
      int entityTypeIndex = list[0];
      type = entityTypeIndex == null ? null : EntityType.values[entityTypeIndex];
      id = list[1];
      position = new Vector2((list[2] as num).toDouble(), (list[3] as num).toDouble());
      orientation = (list[4] as num).toDouble();
      radius = (list[5] as num).toDouble();
      displayName = list[6];      
    }
    catch(e){
      print("exception while Entity.fromJson() with: $list");
    }
  }
  
  Entity.copy(Entity entity){
    copyFrom(entity);
  }
  
  toJson(){
    try {
      assert(position != null);
      List list = [
                       type != null ? type.index : null, // 0
                       id,                    // 1
                       position.x,            // 2
                       position.y,            // 3
                       orientation,           // 4
                       radius,                // 5
                       displayName            // 6
                  ];
      return list;// JSON.encode(list);
    
    }
    catch(e){
      print("exception in Entity.toJson()");
      print(exceptionDetails(e));
      return null;
    }
  }

  
  void copyFrom(Entity entity) {
    type = entity.type;
    id = entity.id;
    position = entity.position.clone();
    orientation = entity.orientation;
    displayName = entity.displayName;
    radius = entity.radius;
  }
}