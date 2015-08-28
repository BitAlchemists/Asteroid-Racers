part of world;

class World
{
  final Map<int, Entity> _entities = new Map<int, Entity>();
  Map<int, Entity> get entities => _entities;
  int _nextEntityId = 0;

  List<Entity> passiveCollissionEntities;
  
  World();
  
  void addEntity(Entity entity)
  {
    entity.id = _nextEntityId++;
    _entities[entity.id] = entity;

  }
  
  void addEntities(Iterable<Entity> entities){
    for(Entity entity in entities)
    {
      addEntity(entity);
    }
  }
  
  void removeEntity(Entity entity){
    _entities.remove(entity.id);
  }

}