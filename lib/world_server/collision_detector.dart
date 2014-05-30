part of world_server;

class CollisionDetector {
  
  bool activeEntitiesCanCollide = false;
  List<Entity> passiveEntitities = new List<Entity>();
  List<Entity> activeEntities = new List<Entity>();

  CollisionDetector();
  
  Set<Entity> detectCollisions(){
    
    Set<Entity> collidingEntities = new Set<Entity>();
    
    //detect colissions between activeEntities
    for(int i = 0; i < activeEntities.length; i++){
      Entity a = activeEntities[i];
      for(int j = i+1; j < activeEntities.length; j++)
      {
        Entity b = activeEntities[j];
        if(_collision(a, b))
        {
          print("Collision between ${a.displayName} and ${b.displayName}");
          collidingEntities.add(a);
          collidingEntities.add(b);
        }
      }
    }

    //detect colissions between active and passive entities
    if(activeEntitiesCanCollide)
    {
      for(int i = 0; i < passiveEntitities.length; i++){
        Entity asteroid = passiveEntitities[i];
        for(int j = 0; j < activeEntities.length; j++)
        {
          Entity activeEntity = activeEntities[j];
          if(_collision(asteroid, activeEntity))
          {
            print("${activeEntity.displayName} crashes into an asteroid");
            collidingEntities.add(activeEntity);
          }
        }
      }      
    }
    
    return collidingEntities;
  }
  
  bool _collision(Entity a, Entity b)
  {
    double distance = (a.position - b.position).length;
    double colissionDistance = a.radius + b.radius; 
    return distance <= colissionDistance;
  }
}