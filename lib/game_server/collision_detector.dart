part of game_server;

typedef void CollisionHandler(Entity collidingEntity, Entity otherEntity);

class CollisionDetector {
  
  bool activeEntitiesCanCollide = false;
  List<Entity> passiveEntities = new List<Entity>();
  List<Entity> activeEntities = new List<Entity>();

  CollisionDetector();
  
  void detectCollisions(CollisionHandler collisionHandler){
    
    var collisions = [];
    
    //detect colissions between activeEntities
    if(activeEntitiesCanCollide)
    {
      for(int i = 0; i < activeEntities.length; i++){
        Entity a = activeEntities[i];
        for(int j = i+1; j < activeEntities.length; j++)
        {
          Entity b = activeEntities[j];
          if(doEntitiesCollide(a, b))
          {
            collisions.add([a,b]);
            collisions.add([b,a]);
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
        if(doEntitiesCollide(passive, active))
        {
          collisions.add([active, passive]);
        }
      }
    }
    
    for(var tuple in collisions){
      collisionHandler(tuple[0], tuple[1]);
    }
  }

  /// me optimize by not comparing actual length (which requires a Math.sqrt operation),
  /// but rater comparing squared lengths
  static bool doEntitiesCollide(Entity a, Entity b)
  {
    double distance2 = (a.position - b.position).length2;
    double collisionDistance = a.radius + b.radius;
    return distance2 <= (collisionDistance * collisionDistance);
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