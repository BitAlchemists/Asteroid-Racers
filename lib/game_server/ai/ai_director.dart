part of ai;

class AIDirector {
  IGameServer _server;

  int LIFETIME_MILLISECONDS = 300;
  int SAMPLE_SIZE = 3;
  int NUM_TARGETS = 3;
  double TARGET_DISTANCE = 200.0;

  AIDirector(this._server);

  List<TrainingSet> _trainingSets;
  List<TrainingUnit> _trainingPlan;
  List<Checkpoint> _targets = <Checkpoint>[];
  TrainingUnit _currentTrainingUnit;
  int _nextTrainingUnit = 0;

  start(){
    //populate world
    for(int i = 0; i < NUM_TARGETS; i++) {
      num angle = (i.toDouble() / NUM_TARGETS.toDouble());
      Vector2 position = new Vector2(Math.cos(angle * Math.PI * 2) * TARGET_DISTANCE, Math.sin(angle * Math.PI * 2) * TARGET_DISTANCE);

      Checkpoint checkpoint = new Checkpoint();
      checkpoint.position = position;
      checkpoint.radius = 30.0;
      checkpoint.orientation = 0.0;
      checkpoint.state = CheckpointState.CLEARED;

      _server.world.addEntity(checkpoint);
      _targets.add(checkpoint);
    }

    // Generate list of lukes
    _generateTrainingSets();

    // launch first luke
    _launchNextTrainingUnit();
  }

  _generateTrainingSets(){
    var brains = new List<Luke>.generate(SAMPLE_SIZE, (int index) => new Luke(4,2,"Luke #$index"));
    _trainingSets = new List<TrainingSet>.generate(brains.length, (int tsIndex){

      List<TrainingUnit> units = new List<TrainingUnit>.generate(_targets.length, (int tuIndex) => new TrainingUnit(_targets[tuIndex], brains[tsIndex]));

      return new TrainingSet(units, brains[tsIndex]);
    });

    _trainingPlan = <TrainingUnit>[];
    for(var set in _trainingSets){
      _trainingPlan.addAll(set.units);
    }
  }

  _launchNextTrainingUnit() {
    // if there is still another luke around, kill him first
    if(_currentTrainingUnit != null){

      print("Luke died. Reward: ${_currentTrainingUnit.reward}");

      _currentTrainingUnit.target.state = CheckpointState.CLEARED;
      _currentTrainingUnit.target.updateRank += 1;

      _server.disconnectClient(_currentTrainingUnit.client);
      _currentTrainingUnit.client = null;
      _currentTrainingUnit = null;



      if(_nextTrainingUnit >= _trainingPlan.length) {
        _printResults();
        return;
      }
    }

    // fetch the next luke and launch him

    TrainingUnit nextUnit = _trainingPlan[_nextTrainingUnit++];
    AIClientProxy client = new AIClientProxy(this, nextUnit);
    nextUnit.client = client;

    _server.connectClient(client);
    client.playerName = nextUnit.brain.name;
    _server.registerPlayer(client, client.playerName);
    _server.teleportPlayerTo(client,new Vector2.zero(),0.0,false);
    nextUnit.reward = distanceToTarget(nextUnit);

    _currentTrainingUnit = nextUnit;

    _currentTrainingUnit.target.state = CheckpointState.CURRENT;
    _currentTrainingUnit.target.updateRank += 1;

    new Future.delayed(new Duration(milliseconds: LIFETIME_MILLISECONDS), (){
      if(_currentTrainingUnit == nextUnit){
        _launchNextTrainingUnit();
      }
    });
  }

  step(double dt){
    if(_currentTrainingUnit != null) {
      _currentTrainingUnit.client.makeYourMove();
    }
  }

  reapRewards() {
    if(_currentTrainingUnit != null){
      double distance = distanceToTarget(_currentTrainingUnit);
      if(distance < _currentTrainingUnit.reward) {
        _currentTrainingUnit.reward = distance;
      }
    }
  }

  _printResults(){
    _trainingSets.sort((TrainingSet ts1, TrainingSet ts2) => ts1.totalReward.compareTo(ts2.totalReward));
    print("$SAMPLE_SIZE done");
    for(int i = 0; i < _trainingSets.length; i++){
      TrainingSet ts = _trainingSets[i];
      print("${i+1}: ${ts.totalReward}");

      Layer outputLayer = ts.brain.layers.last;
      Neuron xNeuron = outputLayer.neurons[0];
      Neuron yNeuron = outputLayer.neurons[1];

      print("xNeuron: bias ${xNeuron.inputConnections[0].weightValue} | xOwn ${xNeuron.inputConnections[1].weightValue} | yOwn ${xNeuron.inputConnections[2].weightValue} | xTarget ${xNeuron.inputConnections[3].weightValue} | yTarget ${xNeuron.inputConnections[4].weightValue}");
      print("yNeuron: bias ${yNeuron.inputConnections[0].weightValue} | xOwn ${yNeuron.inputConnections[1].weightValue} | yOwn ${yNeuron.inputConnections[2].weightValue} | xTarget ${yNeuron.inputConnections[3].weightValue} | yTarget ${yNeuron.inputConnections[4].weightValue}");
    }

    Iterable<Luke> brains = _trainingSets.map((var ts)=>ts.brain);
    LukeSerializer.writeToFile(brains);
    brains = LukeSerializer.readFromFile();

    print(brains);
  }

  double distanceToTarget(TrainingUnit tu){
    return tu.client.movable.position.distanceTo(tu.target.position);
  }

  void send(IClientProxy ai, net.Envelope envelope) {
    if(envelope.messageType == net.MessageType.COLLISION){
      net.IntMessage message = new net.IntMessage.fromBuffer(envelope.payload);
      if(message.integer == ai.movable.id){
        _launchNextTrainingUnit();
      }
    }
  }
}
