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
      entity.velocity += entity.acceleration * dt;
      entity.position += entity.velocity * dt;
      entity.acceleration = new Vector2.zero();
      
      //orientation
      entity.orientation += entity.rotationSpeed * dt;
      entity.rotationSpeed = 0.0;
    }
  }
  
}

