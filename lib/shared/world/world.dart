part of ar_shared;

class World
{
  final Map<int, Entity> _entities = new Map<int, Entity>();
  Map<int, Entity> get entities => _entities;
  int _nextEntityId = 0;
  
  /*
  List<Entity> _asteroids = new List<Entity>();
  List<Entity> _players = new List<Entity>();
  
  List<Entity> get asteroids => _asteroids;
  List<Entity> get players => _players;
  */
  
  World();
  
  void addEntity(Entity entity)
  {
    entity.id = _nextEntityId++;
    _entities[entity.id] = entity;
  /*  
    switch(entity.type)
    {
      case EntityType.ASTEROID:
        _asteroids.add(entity);
        break;
      case EntityType.SHIP:
        _players.add(entity);
        break;
    }
    */
  }
  
  void addEntities(Iterable<Entity> entities){
    for(Entity entity in entities)
    {
      addEntity(entity);
    }
  }
  
  void removeEntity(Entity entity){
    _entities.remove(entity.id);
    /*
    switch(entity.type)
    {
      case EntityType.ASTEROID:
        _asteroids.remove(entity);
        break;
      case EntityType.SHIP:
        _players.remove(entity);
        break;
    }
    */
  }
  
  List<Entity> generateAsteroidBelt(int count, num x, num y, num width, num height) {
    
    List<Entity> asteroids = new List<Entity>();
    
    Math.Random random = new Math.Random();

    for (int i = 0; i < count; i++) {
      //rectangle 
      Vector2 point = new Vector2(
          x + random.nextDouble() * width,
          y + random.nextDouble() * height);
      
      /*
      //circle
      num angle = random.nextDouble() * 2 * Math.PI;
      num radius = random.nextDouble();
      vec3 point = new vec3(radius * xDistance * cos(angle), radius * yDistance * sin(angle), 0);
      */
      
      num minRadius = 3;
      num maxRadius = 30;
      num radius = random.nextDouble() * (maxRadius - minRadius) + minRadius;
      
      Entity entity = new Entity(EntityType.ASTEROID, point, radius);
      asteroids.add(entity);
    }
    
    return asteroids;
  }
  
}