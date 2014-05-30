part of world_server;

class RaceController {
  List<Entity> _checkpoints = new List<Entity>();
  CollisionDetector _checkpointCollisionDetector = new CollisionDetector();
  final Map<int, Entity> _playerCheckpoints = new Map<int, Entity>();
  
  List<Entity> get checkpoints => _checkpoints;
  
  Entity addCheckpoint(double x, double y){
    Entity entity = new Entity(EntityType.CHECKPOINT);
    entity.position = new Vector2(x, y);
    entity.radius = 100.0;
    
    _checkpoints.add(entity);
    _checkpointCollisionDetector.passiveEntitities.add(entity);
    
    return entity;
  }
  
  update(){
    Set<Entity> collisions = _checkpointCollisionDetector.detectCollisions();
  }
  
  addPlayer(Entity player){
    _playerCheckpoints[player.id] = _checkpoints.first;
    _checkpointCollisionDetector.activeEntities.add(player);
  }

  removePlayer(Entity player){
    _playerCheckpoints.remove(player.id);
    _checkpointCollisionDetector.activeEntities.remove(player);
  }
  
  Entity lastCheckpointForPlayer(Entity player){
    return _playerCheckpoints[player.id];
  }

}