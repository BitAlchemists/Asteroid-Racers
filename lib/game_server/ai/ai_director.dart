part of ai;

class AIDirector {
  IGameServer _server;
  Entity target;

  int LIFETIME_SECONDS = 1;
  int SAMPLE_SIZE = 5;

  AIDirector(this._server);

  List<AIController> _lukes = <AIController>[];
  AIController _currentLuke;

  start(){
    launchNewLuke();
  }

  launchNewLuke() {
    if(_currentLuke != null){
      print("Luke died. Reward: ${_currentLuke.reward}");
      _server.disconnectClient(_currentLuke);
      _currentLuke = null;

      if(_lukes.length >= SAMPLE_SIZE) {
        _lukes.sort((AIController luke, AIController lametta) => luke.reward.compareTo(lametta.reward));
        print("$SAMPLE_SIZE done");
        for(AIController luke in _lukes){
          print("${luke.playerName}: ${luke.reward}");
        }


        return;
      }
    }

    AIController luke = new AIController(this);
    _server.connectClient(luke);
    luke.playerName = "Luke Lametta #${_lukes.length}";
    _server.registerPlayer(luke, luke.playerName);
    _server.teleportPlayerTo(luke,new Vector2.zero(),0.0,false);
    luke.reward = distanceToTarget(luke);

    _lukes.add(luke);
    _currentLuke = luke;


    new Future.delayed(new Duration(seconds:LIFETIME_SECONDS), (){
      if(_currentLuke == luke){
        launchNewLuke();
      }
    });
  }

  step(double dt){
    if(_currentLuke != null) {
      _currentLuke.makeYourMove(target);
    }
  }

  reapRewards() {
    if(_currentLuke != null){
      double distance = distanceToTarget(_currentLuke);
      if(distance < _currentLuke.reward) {
        _currentLuke.reward = distance;
      }
    }
  }

  double distanceToTarget(AIController ai){
    return ai.movable.position.distanceTo(target.position);
  }

  void send(IClientProxy ai, net.Envelope envelope) {
    if(envelope.messageType == net.MessageType.COLLISION){
      net.IntMessage message = new net.IntMessage.fromBuffer(envelope.payload);
      if(message.integer == ai.movable.id){
        launchNewLuke();
      }
    }
  }
}

