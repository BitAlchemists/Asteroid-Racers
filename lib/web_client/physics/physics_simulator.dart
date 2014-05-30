part of web_client;

class PhysicsSimulator {
  List<Entity> _entities = new List<Entity>();
  
  PhysicsSimulator();
  
  addEntity(Entity entity)
  {
    _entities.add(entity);
  }
  
  void reset(){
    _entities.clear();
  }
  
  void simulate(num dt) {
    
    for(Entity entity in _entities) {  
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

