part of world_server;

class RaceController {
  List<Entity> _checkpoints = new List<Entity>();
  CollisionDetector _checkpointCollisionDetector = new CollisionDetector();
  final Map<int, int> _lastTouchedCheckpointIndex = new Map<int, int>(); //player.id, checkpoint index
  final Map<int, ClientProxy> _players = new Map<int, ClientProxy>();
  
  List<Entity> get checkpoints => _checkpoints;
  
  Entity addCheckpoint(double x, double y, [double radius = 100.0]){
    Entity entity = new Entity(EntityType.CHECKPOINT);
    entity.position = new Vector2(x, y);
    entity.radius = radius;
    
    if(_checkpoints.length == 0){
      entity.state = CheckpointState.CURRENT;
    }
    else {
      entity.state = CheckpointState.FUTURE;
    }
    
    _checkpoints.add(entity);
    _checkpointCollisionDetector.passiveEntitities.add(entity);
    
    return entity;
  }
  
  Entity addRandomCheckpoint(double distanceToPrevious, double radius){
    double t = random.nextDouble() * Math.PI * 2;
    Vector2 direction = new Vector2(Math.sin(t), Math.cos(t));
    Vector2 newPosition = _checkpoints.last.position + direction * distanceToPrevious;
    
    return addCheckpoint(newPosition.x, newPosition.y, radius);
  }
  
  update(){
    Map<Entity, List<Entity>> collisions = _checkpointCollisionDetector.detectCollisions();
    
    for(Entity playerEntity in collisions.keys){
      int lastTouchedCheckpointIndex = _lastTouchedCheckpointIndex[playerEntity.id];
      if(lastTouchedCheckpointIndex == null){
        lastTouchedCheckpointIndex = -1;
      }
      
      Entity nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+1];
      
      for(Entity checkpoint in collisions[playerEntity]){
        if(checkpoint == nextCheckpoint){
          _lastTouchedCheckpointIndex[playerEntity.id] = lastTouchedCheckpointIndex + 1;
          
          ClientProxy player = _players[playerEntity.id];
          
          Entity messageEntity = new Entity.copy(nextCheckpoint);
          messageEntity.state = CheckpointState.CLEARED;
          Message message = new Message(MessageType.ENTITY, messageEntity); 
          player.send(message);

          if(nextCheckpoint == _checkpoints.last){
            //completed the race
            _checkpointCollisionDetector.activeEntities.remove(playerEntity);
          }
          else {
            nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+2];
            
            messageEntity = new Entity.copy(nextCheckpoint);
            messageEntity.state = CheckpointState.CURRENT;
            Message message = new Message(MessageType.ENTITY, messageEntity);   
            player.send(message);
          }
        }
      }
    }
  }
  
  addPlayer(ClientProxy client){
    _players[client.playerEntity.id] = client;
    _checkpointCollisionDetector.activeEntities.add(client.playerEntity);
  }

  removePlayer(ClientProxy client){
    _lastTouchedCheckpointIndex.remove(client);
    _players.remove(client.playerEntity.id);
    _checkpointCollisionDetector.activeEntities.remove(client.playerEntity);
  }
  
  Entity lastCheckpointForPlayerEntity(Entity player){
    int i = _lastTouchedCheckpointIndex[player.id];
    if(i == null){
      return null;
    }
    
    return _checkpoints[i];
  }

}