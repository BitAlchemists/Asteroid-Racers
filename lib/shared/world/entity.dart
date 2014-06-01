part of ar_shared;

class EntityType {
  static const String ASTEROID = "ASTEROID";
  static const String SHIP = "SHIP";
  static const String CHECKPOINT = "CHECKPOINT";
  static const String RACE_STARTING_POINT = "RACE_STARTING_POINT";
}

class CheckpointState {
  static const int CLEARED = 0;
  static const int CURRENT = 1;
  static const int FUTURE = 2;
}

class Entity
{
  String type;
  int id;
  String displayName;
  Vector2 position;
  double orientation = 0.0;
  double radius = 1.0;
  
  Entity(this.type, {this.position, this.radius});
  
  factory Entity.deserialize(List list){
    Entity entity;
    
    switch(list[0]){
      case EntityType.ASTEROID:
        entity = new Entity.fromJson(list);
        break;
      case EntityType.SHIP:
        entity = new Movable.fromJson(list);
        break;
      case EntityType.RACE_STARTING_POINT:
        
        break;
        
      case EntityType.CHECKPOINT:
        entity = new Checkpoint.fromJson(list);
        break;
    }
    
    return entity;
  }
  
  Entity.fromJson(List list){
    assert(list != null);
    
    type = list[0];
    id = list[1];
    position = new Vector2((list[2] as num).toDouble(), (list[3] as num).toDouble());
    orientation = (list[4] as num).toDouble();
    radius = (list[5] as num).toDouble();
    displayName = list[6];
  }
  
  Entity.copy(Entity entity){
    copyFrom(entity);
  }
  
  toJson(){
    List list = [
                     type,                  // 0
                     id,                    // 1
                     position.x,            // 2
                     position.y,            // 3
                     orientation,           // 4
                     radius,                 // 5
                     displayName           // 6
                ];
    return list;// JSON.encode(list);
  }

  
  void copyFrom(Entity entity) {
    type = entity.type;
    id = entity.id;
    position = entity.position;
    orientation = entity.orientation;
    displayName = entity.displayName;
    radius = entity.radius;
  }
}