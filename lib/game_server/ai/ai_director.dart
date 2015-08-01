part of ai;

class AIDirector {
  IGameServer _server;
  Entity target;

  AIDirector(this._server);

  AIController _currentLuke;

  start(){
    launchNewLuke();
  }

  launchNewLuke() {

    /*
        if(_currentLuke != null){
      AIController luke = _currentLuke;
      new Future.delayed(Duration.ZERO,(){
        _server.disconnectClient(luke);
      });
      _currentLuke = null;
    }
     */

    if(_currentLuke != null){
      _server.disconnectClient(_currentLuke);
      _currentLuke = null;
    }

    AIController luke = new AIController(this);
    _server.connectClient(luke);
    _server.registerPlayer(luke, "Luke Lametta");
    luke.reward = distanceToTarget(luke);

    _currentLuke = luke;

    new Future.delayed(new Duration(seconds:5), (){
      if(_currentLuke == luke){
        launchNewLuke();
      }
    });
  }

  step(double dt){
    _currentLuke.makeYourMove(target);
  }

  reapRewards() {
    double distance = distanceToTarget(_currentLuke);
    if(distance < _currentLuke.reward) {
      _currentLuke.reward = distance;
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

