part of world_server;


class RaceController {
  RacePortal _portal;
  Entity _finish;
  List<Entity> _checkpoints = new List<Entity>();
  final Map<ClientProxy, int> _lastTouchedCheckpointIndex = new Map<ClientProxy, int>(); //player.id, checkpoint index
  Iterable<ClientProxy> get _players => _lastTouchedCheckpointIndex.keys;
  WorldServer worldServer;
  
  
  List<Entity> get checkpoints => _checkpoints;
  RacePortal get start => _portal;
  Entity get finish => _finish;
  
  addStart(double x, double y, double orientation){
    double circleRadius = 100.0;
    _portal = new RacePortal();
    _portal.position = new Vector2(x, y);
    _portal.radius = circleRadius;
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
    
    addCheckpoint(x, y, circleRadius);    
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
    List<ClientProxy> finishedPlayers = new List<ClientProxy>();
    
    _lastTouchedCheckpointIndex.forEach((ClientProxy client, int lastTouchedCheckpointIndex){
      Entity nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+1];
      if(CollisionDetector.doEntitiesCollide(client.movable, nextCheckpoint))
      {
        _lastTouchedCheckpointIndex[client] = lastTouchedCheckpointIndex + 1;              
        
        Checkpoint messageEntity = new Checkpoint.copy(nextCheckpoint);
        messageEntity.state = CheckpointState.CLEARED;
        Message message = new Message(MessageType.ENTITY, messageEntity); 
        client.send(message);

        if(nextCheckpoint == _checkpoints.last){
          //completed the race
          finishedPlayers.add(client);
        }
        else {
          nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+2];
          
          messageEntity = new Checkpoint.copy(nextCheckpoint);
          messageEntity.state = CheckpointState.CURRENT;
          Message message = new Message(MessageType.ENTITY, messageEntity);   
          client.send(message);
        }      
      }
    });

    for(var player in finishedPlayers){
      this._playerReachedFinish(player);
    }
    
  }
  
  
  addPlayer(ClientProxy client){
    //_players[client.playerEntity.id] = client;
    client.race = this;
    resetCheckpointsForPlayer(client);
  }
  
  resetCheckpointsForPlayer(ClientProxy client){
    _lastTouchedCheckpointIndex[client] = 0;
    
    Checkpoint messageEntity = new Checkpoint.copy(_checkpoints[0]);
    messageEntity.state = CheckpointState.CLEARED;
    Message message = new Message(MessageType.ENTITY, messageEntity); 
    client.send(message);
    
    messageEntity = new Checkpoint.copy(_checkpoints[1]);
    messageEntity.state = CheckpointState.CURRENT;
    message = new Message(MessageType.ENTITY, messageEntity); 
    client.send(message);
    
    for(int i = 2; i < _checkpoints.length; i++){
      Checkpoint messageEntity = new Checkpoint.copy(_checkpoints[i]);
      messageEntity.state = CheckpointState.FUTURE;
      Message message = new Message(MessageType.ENTITY, messageEntity); 
      client.send(message);
    }
  }

  removePlayer(ClientProxy client){
    _lastTouchedCheckpointIndex.remove(client);
    //_players.remove(client.playerEntity.id);
    client.race = null;
  }
  
  _playerReachedFinish(ClientProxy client){
    //this.removePlayer(client);
    
    resetCheckpointsForPlayer(client);
    Entity spawn = spawnEntityForPlayer(client);
    client.teleportTo(spawn.position, spawn.orientation);
    worldServer.updatePlayerEntity(client, true);
  }
  
  Entity spawnEntityForPlayer(ClientProxy client){
    int i = _lastTouchedCheckpointIndex[client];
    
    if(i == 0){
      //players get assigned starting positions according to their entity id
      var playerIdList = _players.toList();
      playerIdList.sort((ClientProxy a, ClientProxy b) => a.movable.id.compareTo(b.movable.id));
      
      int i = playerIdList.indexOf(client);
      Entity spawnEntity = new Entity.copy(_portal.positions[i]);
      spawnEntity.radius = client.movable.radius;
      spawnEntity.position += _portal.position;
      return spawnEntity;
    }
    
    
    return _checkpoints[i];
  }

}