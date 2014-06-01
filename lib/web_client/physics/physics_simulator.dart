part of web_client;

class PhysicsSimulator {
  List<Movable> _movables = new List<Movable>();
  
  PhysicsSimulator();
  
  addMovable(Movable entity)
  {
    _movables.add(entity);
  }
  
  void reset(){
    _movables.clear();
  }
  
  void simulate(num dt) {
    
    for(Movable entity in _movables) {  
      //position
      if(!entity.canMove){
        continue;
      }
      
      entity.velocity += entity.acceleration * dt;
      entity.position += entity.velocity * dt;
      
      //orientation
      entity.orientation += entity.rotationSpeed * dt;
    }
  }
  
}

