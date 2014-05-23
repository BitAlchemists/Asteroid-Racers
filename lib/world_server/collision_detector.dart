part of world_server;

class CollisionDetector {
  
  List<Entity> asteroids = new List<Entity>();
  List<Entity> players = new List<Entity>();

  CollisionDetector();
  
  Set<Entity> detectCollisions(){
    
    Set<Entity> collidingEntities = new Set<Entity>();
    
    //detect colissions between ships
    for(int i = 0; i < players.length; i++){
      Entity a = players[i];
      for(int j = i+1; j < players.length; j++)
      {
        Entity b = players[j];
        if(_collision(a, b))
        {
          print("Collision between ${a.displayName} and ${b.displayName}");
          collidingEntities.add(a);
          collidingEntities.add(b);
        }
      }
    }

    //detect colissions between ships and asteroids
    for(int i = 0; i < asteroids.length; i++){
      Entity asteroid = asteroids[i];
      for(int j = 0; j < players.length; j++)
      {
        Entity player = players[j];
        if(_collision(asteroid, player))
        {
          print("${player.displayName} crashes into an asteroid");
          collidingEntities.add(player);
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