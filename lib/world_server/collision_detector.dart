part of world_server;

class CollisionDetector {
  
  bool activeEntitiesCanCollide = false;
  List<Entity> passiveEntitities = new List<Entity>();
  List<Entity> activeEntities = new List<Entity>();

  CollisionDetector();
  
  Map<Entity, List<Entity>> detectCollisions(){
    
    Map<Entity, List<Entity>> collisions = new Map<Entity, List<Entity>>();
    
    //detect colissions between activeEntities
    if(activeEntitiesCanCollide)
    {
      for(int i = 0; i < activeEntities.length; i++){
        Entity a = activeEntities[i];
        for(int j = i+1; j < activeEntities.length; j++)
        {
          Entity b = activeEntities[j];
          if(_collision(a, b))
          {
            _addCollision(collisions, a, b);
            _addCollision(collisions, b, a);
          }
        }
      }
    }

    //detect colissions between active and passive entities
    for(int i = 0; i < passiveEntitities.length; i++){
      Entity passive = passiveEntitities[i];
      for(int j = 0; j < activeEntities.length; j++)
      {
        Entity active = activeEntities[j];
        if(_collision(passive, active))
        {
          _addCollision(collisions, active, passive);
        }
      }
    }      
    
    return collisions;
  }
  
  bool _collision(Entity a, Entity b)
  {
    double distance = (a.position - b.position).length;
    double colissionDistance = a.radius + b.radius; 
    return distance <= colissionDistance;
  }
  
  void _addCollision(Map<Entity, List<Entity>> collisions, Entity active, Entity passive){
    List<Entity> passives = collisions[active];
    if(passives == null){
      passives = new List<Entity>();
      collisions[active] = passives;
    }
    
    passives.add(passive);
  }  
}