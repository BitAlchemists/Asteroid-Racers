part of game_server;

typedef void CollisionHandler(Entity collidingEntity, Entity otherEntity, double penetration);

class CollisionDetector {
  
  bool activeEntitiesCanCollide = false;
  final List<Entity> passiveEntities = new List<Entity>();
  final List<Entity> activeEntities = new List<Entity>();

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
          double penetration = checkColission(a, b);
          if(penetration > 0)
          {
            collisions.add([a,b, penetration]);
            collisions.add([b,a, penetration]);
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
        double penetration = checkColission(passive, active);
        if(penetration > 0)
        {
          collisions.add([active, passive, penetration]);
        }
      }
    }
    
    for(var tuple in collisions){
      collisionHandler(tuple[0], tuple[1], tuple[2]);
    }
  }

  /// if return value is greater than zero, a colission happens
  static double checkColission(Entity a, Entity b)
  {
    double distance = (a.position - b.position).length;
    double collisionDistance = a.radius + b.radius;
    return collisionDistance - distance;
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