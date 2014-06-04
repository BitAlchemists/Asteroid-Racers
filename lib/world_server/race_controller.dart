part of world_server;


class RaceController {
  RacePortal _portal;
  Entity _finish;
  List<Entity> _checkpoints = new List<Entity>();
  CollisionDetector _checkpointCollisionDetector = new CollisionDetector();
  final Map<int, int> _lastTouchedCheckpointIndex = new Map<int, int>(); //player.id, checkpoint index
  final Map<int, ClientProxy> _players = new Map<int, ClientProxy>(); //player.id, clientproxy
  
  List<Entity> get checkpoints => _checkpoints;
  RacePortal get start => _portal;
  Entity get finish => _finish;
  
  addStart(double x, double y, double orientation){
    double circleRadius = 100.0;
    _portal = new RacePortal();
    _portal.position = new Vector2(x, y);
    _portal.radius = 100.0;
    _portal.orientation = Math.PI;
    for(int i = 0; i < 4; i++){
      double angle = Math.PI/2 - Math.PI/3*i;
      Vector2 vec = new Vector2(Math.sin(angle), Math.cos(angle));
      vec *= circleRadius * 0.7;
      Entity start = new Entity(null);
      start.position = vec;
      start.radius = 15.0;
      start.orientation = _portal.orientation;
      _portal.positions.add(start);      
    }
    
    _portal.raceController = this;
    
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
    _checkpointCollisionDetector.passiveEntities.add(checkpoint);
    
    return checkpoint;
  }
  
  addFinish(double x, double y)
  {
    _finish = new Entity(EntityType.FINISH, position: new Vector2(x, y), radius: 100.0);
    addCheckpoint(x, y, 100.0);
  }
  
  /*
  Entity addRandomCheckpoint(double distanceToPrevious, double radius){
    double t = random.nextDouble() * Math.PI * 2;
    Vector2 direction = new Vector2(Math.sin(t), Math.cos(t));
    Vector2 newPosition = _checkpoints.last.position + direction * distanceToPrevious;
    
    return addCheckpoint(newPosition.x, newPosition.y, radius);
  }
*/
  
  update(){
    _checkpointCollisionDetector.detectCollisions(_onPlayerHitsCheckpoint);
    
  }
  
  _onPlayerHitsCheckpoint(Movable playerEntity, Checkpoint checkpoint){
    int lastTouchedCheckpointIndex = _lastTouchedCheckpointIndex[playerEntity.id];
    if(lastTouchedCheckpointIndex == null){
      lastTouchedCheckpointIndex = -1;
    }
    
    Entity nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+1];
    
    if(checkpoint == nextCheckpoint){
      _lastTouchedCheckpointIndex[playerEntity.id] = lastTouchedCheckpointIndex + 1;
      
      ClientProxy player = _players[playerEntity.id];
      
      Checkpoint messageEntity = new Checkpoint.copy(nextCheckpoint);
      messageEntity.state = CheckpointState.CLEARED;
      Message message = new Message(MessageType.ENTITY, messageEntity); 
      player.send(message);

      if(nextCheckpoint == _checkpoints.last){
        //completed the race
        this._playerReachedFinish(player);
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
  
  _playerReachedFinish(ClientProxy client){
    this.removePlayer(client);
  }
  
  Entity spawnEntityForPlayer(ClientProxy client){
    int i = _lastTouchedCheckpointIndex[client.playerEntity.id];
    if(i == null){
      var playerIdList = _players.keys.toList();
      playerIdList.sort();
      int i = playerIdList.indexOf(client.playerEntity.id);
      Entity spawnEntity = new Entity.copy(_portal.positions[i]);
      spawnEntity.radius = client.playerEntity.radius;
      return spawnEntity;
    }
    
    
    return _checkpoints[i];
  }

}