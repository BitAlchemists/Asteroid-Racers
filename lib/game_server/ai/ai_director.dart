part of ai;

class AIDirector {
  IGameServer _server;

  int LIFETIME_MILLISECONDS = 300;
  int SAMPLE_SIZE = 10;
  int NUM_TARGETS = 3;
  double TARGET_DISTANCE = 100.0;

  AIDirector(this._server);

  List<TrainingSet> _trainingSets;
  List<TrainingUnit> _trainingPlan;
  List<Checkpoint> _targets = <Checkpoint>[];
  List<TrainingUnit> _currentTrainingUnits;
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

    _currentTrainingUnits = <TrainingUnit>[];

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

    // fetch the next luke and launch him
    TrainingUnit trainingUnit = _trainingPlan[_nextTrainingUnit++];
    _currentTrainingUnits.add(trainingUnit);
    AIClientProxy client = new AIClientProxy(this, trainingUnit);
    trainingUnit.client = client;

    _server.connectClient(client);
    client.playerName = trainingUnit.brain.name;
    _server.registerPlayer(client, client.playerName);
    _server.teleportPlayerTo(client,new Vector2.zero(),0.0,false);
    trainingUnit.reward = distanceToTarget(trainingUnit);


    trainingUnit.target.state = CheckpointState.CURRENT;
    trainingUnit.target.updateRank += 1;
    trainingUnit.state = TrainingUnitState.RUNNING;

    new Future.delayed(new Duration(milliseconds: LIFETIME_MILLISECONDS), (){
      if(trainingUnit.state != TrainingUnitState.ENDED){
        _endTrainingUnit(trainingUnit);
        _launchNextTrainingUnit();
      }
    });
  }

  _endTrainingUnit(TrainingUnit unit){
    print("${unit.brain.name} died. Reward: ${unit.reward}");

    unit.state = TrainingUnitState.ENDED;

    unit.target.state = CheckpointState.CLEARED;
    unit.target.updateRank += 1;

    _server.disconnectClient(unit.client);
    unit.client.trainingUnit = null;
    unit.client = null;
    _currentTrainingUnits.remove(unit);

    if(_nextTrainingUnit >= _trainingPlan.length) {
      _printResults();
      return;
    }
  }

  step(double dt){
    for(TrainingUnit unit in _currentTrainingUnits)
    {
      unit.client.makeYourMove();
    }
  }

  reapRewards() {
    for(TrainingUnit unit in _currentTrainingUnits)
    {
      double distance = distanceToTarget(unit);
      if(distance < unit.reward) {
        unit.reward = distance;
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

  double distanceToTarget(TrainingUnit unit){
    return unit.client.movable.position.distanceTo(unit.target.position);
  }

  void send(AIClientProxy client, net.Envelope envelope) {
    if(envelope.messageType == net.MessageType.COLLISION){
      net.IntMessage message = new net.IntMessage.fromBuffer(envelope.payload);
      if(message.integer == client.movable.id){

        if(client.trainingUnit.state != TrainingUnitState.ENDED){
          _endTrainingUnit(client.trainingUnit);
          _launchNextTrainingUnit();
        }
      }
    }
  }
}
