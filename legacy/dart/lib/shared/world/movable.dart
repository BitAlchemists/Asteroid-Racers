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