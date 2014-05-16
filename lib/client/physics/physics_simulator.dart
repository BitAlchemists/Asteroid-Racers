part of ar_client;

class PhysicsSimulator {
  List<Entity> _entities = new List<Entity>();
  
  PhysicsSimulator();
  
  addEntity(Entity entity)
  {
    _entities.add(entity);
  }
  
  
  void simulate(num dt) {
    
    for(Entity entity in _entities) {      
      entity.velocity += entity.acceleration * dt;
      entity.position += entity.velocity * dt;
      entity.acceleration = new Vector2.zero();
    }
  }
  
}

