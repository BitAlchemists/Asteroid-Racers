part of world;

class PhysicsSimulator {
  List<Movable> _movables = new List<Movable>();
  
  PhysicsSimulator();
  
  addMovable(Movable entity)
  {
    _movables.add(entity);
  }
  
  removeMovable(Movable movable){
    _movables.remove(movable);
  }
  
  void reset(){
    _movables.clear();
  }
  
  void simulateRotation(num dt) {
    
    for(Movable entity in _movables) {  
      if(!entity.canMove){
        continue;
      }
      
      //orientation
      entity.orientation += entity.rotationSpeed * dt;
    }
  }
  
  void simulateTranslation(num dt) {
    
    for(Movable entity in _movables) {  
      //position
      if(!entity.canMove){
        continue;
      }
      
      entity.velocity += entity.acceleration * dt;
      entity.position += entity.velocity * dt;
      
      entity.updateRank += 1;
    }
  }
  
}

