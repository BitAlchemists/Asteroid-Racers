part of game_server;

//TODO: can we remove all message code from this class?
class RaceController {
  RacePortal _portal;
  Entity _finish;
  List<Entity> _checkpoints = new List<Entity>();
  final Map<IClientProxy, int> _lastTouchedCheckpointIndex = new Map<IClientProxy, int>(); //player.id, checkpoint index
  Iterable<IClientProxy> get _players => _lastTouchedCheckpointIndex.keys;
  GameServer gameServer;
  int maxPlayers = 4;


  List<Entity> get checkpoints => _checkpoints;
  RacePortal get start => _portal;
  Entity get finish => _finish;
  
  RacePortal addStart(double x, double y, double orientation){
    double circleRadius = 100.0;
    _portal = new RacePortal();
    _portal.position = new Vector2(x, y);
    _portal.radius = circleRadius;
    _portal.orientation = orientation;

    for(int i = 0; i < maxPlayers; i++){
      double angle = Math.PI/2 - Math.PI/(maxPlayers-1)*i;
      Vector2 vec = new Vector2(Math.sin(angle), Math.cos(angle));
      vec *= circleRadius * 0.7;
      Entity start = new Entity(type:EntityType.UNKNOWN);
      // this is the relativ position within the RacePortal, not accounting for orientation
      // actual spawn position is determined in spawnEntityForPlayer later
      // we dont already calculate the actual position to make it easier for the client to position
      // the rendered spawn points realative to its orientation
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
      if(CollisionDetector.checkColission(client.movable, nextCheckpoint) > 0)
      {
        _lastTouchedCheckpointIndex[client] = lastTouchedCheckpointIndex + 1;              

        sendCheckpointUpdate(client, nextCheckpoint, CheckpointState.CLEARED);

        if(nextCheckpoint == _checkpoints.last){
          //completed the race
          finishedPlayers.add(client);
        }
        else {
          nextCheckpoint = _checkpoints[lastTouchedCheckpointIndex+2];
          sendCheckpointUpdate(client, nextCheckpoint, CheckpointState.CURRENT);
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
  
  bool addPlayer(IClientProxy client){
    if(_players.length >= maxPlayers){
      return false;
    }

    net.IntMessage message = new net.IntMessage();
    message.integer = start.id;

    net.Envelope envelope = new net.Envelope();
    envelope.messageType = net.MessageType.RACE_JOIN;
    envelope.payload = message.writeToBuffer();
    client.send(envelope);

    _resetCheckpointsForPlayer(client);
    
    Entity spawn = spawnEntityForPlayer(client);
    gameServer.teleportPlayerTo(client, spawn.position, spawn.orientation, true);

    return true;
  }
  
  _resetCheckpointsForPlayer(IClientProxy client){
    _lastTouchedCheckpointIndex[client] = 0;

    sendCheckpointUpdate(client,_checkpoints[0], CheckpointState.CLEARED);
    sendCheckpointUpdate(client,_checkpoints[1], CheckpointState.CURRENT);

    for(int i = 2; i < _checkpoints.length; i++){
      sendCheckpointUpdate(client, _checkpoints[i], CheckpointState.FUTURE);
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

      //calculate the actual position with respect to the orientation of the portal
      double sin = Math.sin(_portal.orientation);
      double cos = Math.cos(_portal.orientation);

      double x = spawnEntity.position.x * cos - spawnEntity.position.y * sin;
      double y = spawnEntity.position.x * sin + spawnEntity.position.y * cos;
      spawnEntity.position = new Vector2(x,y);

      spawnEntity.position += _portal.position;

      return spawnEntity;
    }
    
    
    return _checkpoints[i];
  }

  static void sendCheckpointUpdate(IClientProxy client, Checkpoint checkpoint, CheckpointState state){

    if(state == CheckpointState.CURRENT){
      net.IntMessage message = new net.IntMessage();
      message.integer = checkpoint.id;

      net.Envelope envelope = new net.Envelope();
      envelope.messageType = net.MessageType.RACE_EVENT;
      envelope.payload = message.writeToBuffer();
      client.send(envelope);
    }

    Checkpoint messageEntity = new Checkpoint.copy(checkpoint);
    messageEntity.state = state;
    net.Envelope envelope = new net.Envelope();
    envelope.messageType = net.MessageType.ENTITY;
    envelope.payload = net.EntityMarshal.worldEntityToNetEntity(messageEntity).writeToBuffer();
    client.send(envelope);
  }

}