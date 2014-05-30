part of world_server;

class CheckpointController {
  List<Entity> _checkpoints = new List<Entity>();
  CollisionDetector _checkpointCollisionDetector = new CollisionDetector();
  final Map<int, Entity> _playerCheckpoints = new Map<int, Entity>();
  
  List<Entity> get checkpoints => _checkpoints;
  
  Entity addCheckpoint(double x, double y){
    Entity entity = new Entity(EntityType.CHECKPOINT, position: new Vector2(50.0, 50.0), radius: 10.0);
    entity.radius = 100.0;
    
    _checkpoints.add(entity);
    
    return entity;
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