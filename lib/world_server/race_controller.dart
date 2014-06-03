part of world_server;


class RaceController {
  LaunchPlatform _start;
  List<Entity> _checkpoints = new List<Entity>();
  CollisionDetector _checkpointCollisionDetector = new CollisionDetector();
  final Map<int, int> _lastTouchedCheckpointIndex = new Map<int, int>(); //player.id, checkpoint index
  final Map<int, ClientProxy> _players = new Map<int, ClientProxy>(); //player.id, clientproxy
  
  List<Entity> get checkpoints => _checkpoints;
  LaunchPlatform get start => _start;
  
  addStart(double x, double y, double orientation){
    double circleRadius = 100.0;
    _start = new LaunchPlatform();
    _start.position = new Vector2.zero();
    _start.radius = 100.0;
    _start.orientation = Math.PI;
    for(int i = 0; i < 4; i++){
      double angle = Math.PI/2 - Math.PI/3*i;
      Vector2 vec = new Vector2(Math.sin(angle), Math.cos(angle));
      vec *= circleRadius * 0.7;
      Entity start = new Entity(null);
      start.position = vec;
      start.radius = 15.0;
      start.orientation = _start.orientation;
      _start.positions.add(start);      
    }
    
//    _checkpoints.add(lp);
//    _checkpointCollisionDetector.passiveEntitities.add(lp);
  }
  
  Entity addCheckpoint(double x, double y, [double radius = 100.0]){
    Checkpoint checkpoint = new Checkpoint();
    checkpoint.position = new Vector2(x, y);
    checkpoint.radius = radius;
    
    if(_checkpoints.length == 0){
      checkpoint.state = CheckpointState.CURRENT;
    }
    else {
      checkpoint.state = CheckpointState.FUTURE;
    }
    
    _checkpoints.add(checkpoint);
    _checkpointCollisionDetector.passiveEntitities.add(checkpoint);
    
    return checkpoint;
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
      
      for(Checkpoint checkpoint in collisions[playerEntity]){
        if(checkpoint == nextCheckpoint){
          _lastTouchedCheckpointIndex[playerEntity.id] = lastTouchedCheckpointIndex + 1;
          
          ClientProxy player = _players[playerEntity.id];
          
          Checkpoint messageEntity = new Checkpoint.copy(nextCheckpoint);
          messageEntity.state = CheckpointState.CLEARED;
          Message message = new Message(MessageType.ENTITY, messageEntity); 
          player.send(message);

          if(nextCheckpoint == _checkpoints.last){
            //completed the race
            _checkpointCollisionDetector.activeEntities.remove(playerEntity);
          }
          else {
            nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+2];
            
            messageEntity = new Checkpoint.copy(nextCheckpoint);
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
    client.race = this;
  }

  removePlayer(ClientProxy client){
    _lastTouchedCheckpointIndex.remove(client);
    _players.remove(client.playerEntity.id);
    _checkpointCollisionDetector.activeEntities.remove(client.playerEntity);
    client.race = null;
  }
  
  Entity spawnEntityForPlayer(ClientProxy client){
    int i = _lastTouchedCheckpointIndex[client.playerEntity.id];
    if(i == null){
      var playerIdList = _players.keys.toList();
      playerIdList.sort();
      int i = playerIdList.indexOf(client.playerEntity.id);
      Entity spawnEntity = new Entity.copy(_start.positions[i]);
      spawnEntity.radius = client.playerEntity.radius;
      return spawnEntity;
    }
    
    
    return _checkpoints[i];
  }

}