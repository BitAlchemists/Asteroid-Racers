part of world_server;

typedef void CollisionHandler(Entity collidingEntity, Entity otherEntity);

class CollisionDetector {
  
  bool activeEntitiesCanCollide = false;
  List<Entity> passiveEntities = new List<Entity>();
  List<Entity> activeEntities = new List<Entity>();

  CollisionDetector();
  
  void detectCollisions(CollisionHandler collisionHandler){
        
    //detect colissions between activeEntities
    if(activeEntitiesCanCollide)
    {
      for(int i = 0; i < activeEntities.length; i++){
        Entity a = activeEntities[i];
        for(int j = i+1; j < activeEntities.length; j++)
        {
          Entity b = activeEntities[j];
          if(_entitiesCollide(a, b))
          {
            collisionHandler(a, b);
            collisionHandler(b, a);
          }
        }
      }
    }

    //detect colissions between active and passive entities
    for(int i = 0; i < passiveEntities.length; i++){
      Entity passive = passiveEntities[i];
      for(int j = 0; j < activeEntities.length; j++)
      {
        Entity active = activeEntities[j];
        if(_entitiesCollide(passive, active))
        {
          collisionHandler(active, passive);
        }
      }
    }          
  }
  
  bool _entitiesCollide(Entity a, Entity b)
  {
    double distance = (a.position - b.position).length;
    double colissionDistance = a.radius + b.radius; 
    return distance <= colissionDistance;
  }
  
  /*
  void _addCollision(Map<Entity, List<Entity>> collisions, Entity active, Entity passive){
    List<Entity> passives = collisions[active];
    if(passives == null){
      passives = new List<Entity>();
      collisions[active] = passives;
    }
    
    passives.add(passive);
  } 
  * */
}