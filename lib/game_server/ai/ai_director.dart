part of ai;

class AIDirector {
  IGameServer _server;

  int LIFETIME_MILLISECONDS = 250;
  int SAMPLE_SIZE = 100;
  int NUM_TARGETS = 24;
  double TARGET_DISTANCE = 100.0;

  AIDirector(this._server);

  List<TrainingSet> _trainingSets;
  List<TrainingUnit> _trainingPlan;
  List<Checkpoint> _targets = <Checkpoint>[];
  TrainingUnit _currentTrainingUnit;
  int _nextTrainingUnit;

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
    List<Luke> brains = LukeSerializer.readFromFile();
    if(brains != null){
      print("found brains. mutating them");
      List newBrains = [];
      int nameIndex = 0;
      for(Luke brain in brains){
        brain.name = "Luke #$nameIndex"; nameIndex++;
        var jsonBrain = LukeSerializer.networkToJson(brain);
        for(int i = 0; i < 9; i++)
        {
          Luke brain = LukeSerializer.jsonToNetwork(jsonBrain);
          brain.name = "Luke #$nameIndex"; nameIndex++;
          brain.generation++;
          brain.mutate(0.01);
          newBrains.add(brain);
        }
      }
      brains.addAll(newBrains);
    }
    else{
      print("did not find existing brains. creating new ones");
      brains = new List<Luke>.generate(SAMPLE_SIZE, (int index) => new Luke(4,2,"Luke #$index"));
    }

    _trainingSets = new List<TrainingSet>.generate(brains.length, (int tsIndex){

      List<TrainingUnit> units = new List<TrainingUnit>.generate(_targets.length, (int tuIndex) => new TrainingUnit(_targets[tuIndex], brains[tsIndex]));

      return new TrainingSet(units, brains[tsIndex]);
    });

    _trainingPlan = <TrainingUnit>[];
    for(var set in _trainingSets){
      _trainingPlan.addAll(set.units);
    }

    _nextTrainingUnit = 0;
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
    String report = "${_trainingSets.length} done\n";


    for(int i = 0; i < _trainingSets.length; i++){
      TrainingSet ts = _trainingSets[i];
      report += "${i+1}: ${ts.totalReward} | Generation ${ts.brain.generation}\n";

      Layer outputLayer = ts.brain.layers.last;
      Neuron xNeuron = outputLayer.neurons[0];
      Neuron yNeuron = outputLayer.neurons[1];

      report += "xNeuron: bias ${xNeuron.inputConnections[0].weightValue} | xOwn ${xNeuron.inputConnections[1].weightValue} | yOwn ${xNeuron.inputConnections[2].weightValue} | xTarget ${xNeuron.inputConnections[3].weightValue} | yTarget ${xNeuron.inputConnections[4].weightValue}\n";
      report += "yNeuron: bias ${yNeuron.inputConnections[0].weightValue} | xOwn ${yNeuron.inputConnections[1].weightValue} | yOwn ${yNeuron.inputConnections[2].weightValue} | xTarget ${yNeuron.inputConnections[3].weightValue} | yTarget ${yNeuron.inputConnections[4].weightValue}\n";
    }

    print(report);

    //save report to file
    Directory logDirectory = new Directory.fromUri(new Uri.file(Directory.current.path + "/log"));
    logDirectory.createSync(recursive:true);
    String logFileName = logDirectory.path + "/${new DateTime.now().millisecondsSinceEpoch}.log";
    new File(logFileName).writeAsStringSync(report);

    List<Luke> brains = _trainingSets.take((SAMPLE_SIZE/10).toInt()).map((var ts)=>ts.brain).toList();
    LukeSerializer.writeToFile(brains);

    // Generate list of lukes
    _generateTrainingSets();

    // launch first luke
    _launchNextTrainingUnit();
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
