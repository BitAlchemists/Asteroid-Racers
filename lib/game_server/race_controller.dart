part of game_server;

//TODO: can we remove all message code from this class?
class RaceController {
  RacePortal _portal;
  Entity _finish;
  List<Entity> _checkpoints = new List<Entity>();
  final Map<IClientProxy, int> _lastTouchedCheckpointIndex = new Map<IClientProxy, int>(); //player.id, checkpoint index
  Iterable<IClientProxy> get _players => _lastTouchedCheckpointIndex.keys;
  GameServer gameServer;
  
  
  List<Entity> get checkpoints => _checkpoints;
  RacePortal get start => _portal;
  Entity get finish => _finish;
  
  RacePortal addStart(double x, double y, double orientation){
    double circleRadius = 100.0;
    _portal = new RacePortal();
    _portal.position = new Vector2(x, y);
    _portal.radius = circleRadius;
    _portal.orientation = Math.PI;
    for(int i = 0; i < 4; i++){
      double angle = Math.PI/2 - Math.PI/3*i;
      Vector2 vec = new Vector2(Math.sin(angle), Math.cos(angle));
      vec *= circleRadius * 0.7;
      Entity start = new Entity(type:EntityType.UNKNOWN);
      start.position = vec;
      start.radius = 15.0;
      start.orientation = _portal.orientation;
      _portal.positions.add(start);      
    }
    
    _portal.raceController = this;
    
    addCheckpoint(x, y, circleRadius);

    return _portal;
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
    _finish = new Entity(type: EntityType.FINISH, position: new Vector2(x, y), radius: 100.0);
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
    List<IClientProxy> finishedPlayers = new List<IClientProxy>();
    
    _lastTouchedCheckpointIndex.forEach((IClientProxy client, int lastTouchedCheckpointIndex){
      Entity nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+1];
      if(CollisionDetector.doEntitiesCollide(client.movable, nextCheckpoint))
      {
        _lastTouchedCheckpointIndex[client] = lastTouchedCheckpointIndex + 1;              
        
        Checkpoint messageEntity = new Checkpoint.copy(nextCheckpoint);
        messageEntity.state = CheckpointState.CLEARED;
        net.Envelope envelope = new net.Envelope();
        envelope.messageType = net.MessageType.ENTITY;
        envelope.payload = net.EntityMarshal.worldEntityToNetEntity(messageEntity).writeToBuffer();
        client.send(envelope);

        if(nextCheckpoint == _checkpoints.last){
          //completed the race
          finishedPlayers.add(client);
        }
        else {
          nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+2];
          
          messageEntity = new Checkpoint.copy(nextCheckpoint);
          messageEntity.state = CheckpointState.CURRENT;
          net.Envelope envelope = new net.Envelope();
          envelope.messageType = net.MessageType.ENTITY;
          envelope.payload = net.EntityMarshal.worldEntityToNetEntity(messageEntity).writeToBuffer();
          client.send(envelope);
        }      
      }
    });

    for(var player in finishedPlayers){
      this._playerReachedFinish(player);
    }
    
  }

  //player management

  bool isClientInRace(IClientProxy client){
    return _lastTouchedCheckpointIndex.containsKey(client);
  }
  
  addPlayer(IClientProxy client){
    _resetCheckpointsForPlayer(client);
    
    Entity spawn = spawnEntityForPlayer(client);
    gameServer.teleportPlayerTo(client, spawn.position, spawn.orientation, true);
  }
  
  _resetCheckpointsForPlayer(IClientProxy client){
    _lastTouchedCheckpointIndex[client] = 0;
    
    Checkpoint messageEntity = new Checkpoint.copy(_checkpoints[0]);
    messageEntity.state = CheckpointState.CLEARED;
    net.Envelope envelope = new net.Envelope();
    envelope.messageType = net.MessageType.ENTITY;
    envelope.payload = net.EntityMarshal.worldEntityToNetEntity(messageEntity).writeToBuffer();
    client.send(envelope);
    
    messageEntity = new Checkpoint.copy(_checkpoints[1]);
    messageEntity.state = CheckpointState.CURRENT;
    envelope = new net.Envelope();
    envelope.messageType = net.MessageType.ENTITY;
    envelope.payload = net.EntityMarshal.worldEntityToNetEntity(messageEntity).writeToBuffer();
    client.send(envelope);
    
    for(int i = 2; i < _checkpoints.length; i++){
      Checkpoint messageEntity = new Checkpoint.copy(_checkpoints[i]);
      messageEntity.state = CheckpointState.FUTURE;
      net.Envelope envelope = new net.Envelope();
      envelope.messageType = net.MessageType.ENTITY;
      envelope.payload = net.EntityMarshal.worldEntityToNetEntity(messageEntity).writeToBuffer();
      client.send(envelope);
    }
  }

  removePlayer(IClientProxy client){
    _lastTouchedCheckpointIndex.remove(client);
  }
  
  _playerReachedFinish(IClientProxy client){
    this.removePlayer(client);
    this.addPlayer(client);
  }
  
  Entity spawnEntityForPlayer(IClientProxy client){
    int i = _lastTouchedCheckpointIndex[client];
    
    if(i == 0){
      //players get assigned starting positions according to their entity id
      var playerIdList = _players.toList();
      playerIdList.sort((IClientProxy a, IClientProxy b) => a.movable.id.compareTo(b.movable.id));
      
      int i = playerIdList.indexOf(client);
      Entity spawnEntity = new Entity.copy(_portal.positions[i]);
      spawnEntity.radius = client.movable.radius;
      spawnEntity.position += _portal.position;
      return spawnEntity;
    }
    
    
    return _checkpoints[i];
  }

}