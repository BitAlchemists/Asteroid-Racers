part of world;

enum EntityType {
  UNKNOWN,
  ASTEROID,
  SHIP,
  CHECKPOINT,
  LAUNCH_PLATFORM,
  ARROWS,
  FINISH,
}

enum CheckpointState {
  CLEARED,
  CURRENT,
  FUTURE
}

class Entity
{
  EntityType type;
  int id;
  String displayName;
  Vector2 position;
  double _orientation = 0.0;
  set orientation(double value){
    if(value == null){
      _orientation = null;
      return;
    }

    if(value > Math.PI){
      value -= 2*Math.PI;
    }
    if(value < -Math.PI){
      value += 2*Math.PI;
    }
    _orientation = value;
  }
  double get orientation => _orientation;
  double radius;

  //static const double ENTITY_UPDATE_PRIORITY_NO_UPDATE = 0.0;
  //static const double ENTITY_UPDATE_PRIORITY_LOW = 1.0;
  //double updatePriority = ENTITY_UPDATE_PRIORITY_LOW;
  
  num updateRank = 0.0;
  
  Entity({this.type, this.position, this.radius:1.0});
  
  Entity.copy(Entity entity){
    copyFrom(entity);
  }

  
  void copyFrom(Entity entity) {
    
    if(entity.type != null) {
      type = entity.type; 
    }
    
    if(entity.id != null) {
      id = entity.id;      
    }

    if(entity.position != null){
      position = entity.position.clone();  
    }
    
    if(entity.orientation != null){
      orientation = entity.orientation;  
    }
    
    if(entity.displayName != null){
      displayName = entity.displayName;
    }
    
    if(entity.radius != null){
      radius = entity.radius; 
    }
  }


}