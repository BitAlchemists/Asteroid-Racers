part of ar_shared;

class World
{
  final List<Entity> _entities = new List<Entity>();
  List<Entity> get entities => _entities;
  
  World();
  
  void addEntity(Entity entity)
  {
    _entities.add(entity);
  }
  
  void generateAsteroidBelt(int count, int xDistance, int yDistance) {
    Math.Random random = new Math.Random();

    for (int i = 0; i < count; i++) {
      //rectangle 
      Vector2 point = new Vector2(random.nextDouble() * 2 * xDistance - xDistance, random.nextDouble() * 2 * yDistance - yDistance);
      
      /*
      //circle
      num angle = random.nextDouble() * 2 * Math.PI;
      num radius = random.nextDouble();
      vec3 point = new vec3(radius * xDistance * cos(angle), radius * yDistance * sin(angle), 0);
      */
      
      addEntity(new Entity(EntityType.ASTEROID, point));
    }
  }
}