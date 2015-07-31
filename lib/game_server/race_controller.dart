part of game_server;

//TODO: can we remove all message code from this class?
class RaceController {
  RacePortal _portal;
  Entity _finish;
  List<Entity> _checkpoints = new List<Entity>();
  final Map<ClientProxy, int> _lastTouchedCheckpointIndex = new Map<ClientProxy, int>(); //player.id, checkpoint index
  Iterable<ClientProxy> get _players => _lastTouchedCheckpointIndex.keys;
  GameServer gameServer;
  
  
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
  
  Entity addCheckpoint(double x, double y, double orientation, [double radius = 100.0]){
    Checkpoint checkpoint = new Checkpoint();
    checkpoint.position = new Vector2(x, y);
    checkpoint.radius = radius;
    checkpoint.orientation = orientation;
    
    if(_checkpoints.length == 0){
      checkpoint.state = CheckpointState.CURRENT;
    }
    else {
      checkpoint.state = CheckpointState.FUTURE;
    }
    
    _checkpoints.add(checkpoint);
    
    return checkpoint;
  }
  
  addFinish(double x, double y, double orientation)
  {
    _finish = new Entity(EntityType.FINISH, position: new Vector2(x, y), radius: 100.0);
    _finish.orientation = orientation;
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
        Envelope envelope = new Envelope();
        envelope.messageType = MessageType.ENTITY;
        envelope.payload = messageEntity;
        client.send(envelope);

        if(nextCheckpoint == _checkpoints.last){
          //completed the race
          finishedPlayers.add(client);
        }
        else {
          nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+2];
          
          messageEntity = new Checkpoint.copy(nextCheckpoint);
          messageEntity.state = CheckpointState.CURRENT;
          Envelope envelope = new Envelope();
          envelope.messageType = MessageType.ENTITY;
          envelope.payload = messageEntity;
          client.send(envelope);
        }      
      }
    });

    for(var player in finishedPlayers){
      this._playerReachedFinish(player);
    }
    
  }
  
  
  addPlayer(ClientProxy client){
    client.race = this;
    _resetCheckpointsForPlayer(client);
    
    Entity spawn = spawnEntityForPlayer(client);
    gameServer.teleportPlayerTo(client, spawn.position, spawn.orientation, true);
  }
  
  _resetCheckpointsForPlayer(ClientProxy client){
    _lastTouchedCheckpointIndex[client] = 0;
    
    Checkpoint messageEntity = new Checkpoint.copy(_checkpoints[0]);
    messageEntity.state = CheckpointState.CLEARED;
    Envelope envelope = new Envelope(MessageType.ENTITY, messageEntity);
    client.send(envelope);
    
    messageEntity = new Checkpoint.copy(_checkpoints[1]);
    messageEntity.state = CheckpointState.CURRENT;
    envelope = new Envelope(MessageType.ENTITY, messageEntity);
    client.send(envelope);
    
    for(int i = 2; i < _checkpoints.length; i++){
      Checkpoint messageEntity = new Checkpoint.copy(_checkpoints[i]);
      messageEntity.state = CheckpointState.FUTURE;
      Envelope envelope = new Envelope(MessageType.ENTITY, messageEntity);
      client.send(envelope);
    }
  }

  removePlayer(ClientProxy client){
    _lastTouchedCheckpointIndex.remove(client);
    client.race = null;
  }
  
  _playerReachedFinish(ClientProxy client){
    this.removePlayer(client);
    this.addPlayer(client);
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