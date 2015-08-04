part of world;

class MovementInput {
  MovementInput();

  double accelerationFactor;
  double newOrientation;
  double rotationSpeed;
}

class Movable extends Entity {
  bool canMove = false;
  double rotationSpeed = 0.0;
  Vector2 acceleration = new Vector2.zero();
  Vector2 velocity = new Vector2.zero();

  Movable() : super(type: EntityType.SHIP);
  
  Movable.fromJson(List list) : super.fromJson(list){
    canMove = list[7];
    velocity = new Vector2((list[8] as num).toDouble(), (list[9] as num).toDouble());
    acceleration = new Vector2((list[10] as num).toDouble(), (list[11] as num).toDouble());
    rotationSpeed = (list[12] as num).toDouble();
  }
  
  toJson(){
    List list = super.toJson();
    list.addAll([
                 canMove,               // 7
                 velocity.x,            // 8
                 velocity.y,            // 9
                 acceleration.x,        //10
                 acceleration.y,        //11
                 rotationSpeed,         //12
    ]);
    
    return list;
  }
  
  copyFrom(Movable entity){
    super.copyFrom(entity);
    
    if(entity.rotationSpeed != null){
      rotationSpeed = entity.rotationSpeed;  
    }
    
    if(entity.acceleration != null){
      acceleration = entity.acceleration.clone();  
    }
    
    if(entity.velocity != null){
      velocity = entity.velocity.clone();  
    }
    
    if(entity.canMove != null){
      canMove = entity.canMove;  
    }
  }
}