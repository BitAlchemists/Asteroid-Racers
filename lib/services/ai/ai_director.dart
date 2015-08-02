part of ai;

class AIDirector implements IServerService {
  IGameServer server;
  void update(double dt){}

  int LIFETIME_MILLISECONDS = 1000;
  int SAMPLE_SIZE = 100;
  int NUM_TARGETS = 6;
  double TARGET_DISTANCE = 200.0;
  int NUM_SIMULTANEOUS_SIMULATIONS = 20;

  AIDirector();

  List<TrainingSet> _trainingSets;
  List<TrainingUnit> _trainingPlan;
  List<Checkpoint> _targets = <Checkpoint>[];
  List<TrainingUnit> _currentTrainingUnits;
  int _nextTrainingUnit;

  start(){
    //populate world
    print("starting ai director");
    for(int i = 0; i < NUM_TARGETS; i++) {
      num angle = (i.toDouble() / NUM_TARGETS.toDouble());
      Vector2 position = new Vector2(Math.cos(angle * Math.PI * 2) * TARGET_DISTANCE, Math.sin(angle * Math.PI * 2) * TARGET_DISTANCE);

      Checkpoint checkpoint = new Checkpoint();
      checkpoint.position = position;
      checkpoint.radius = 30.0;
      checkpoint.orientation = 0.0;
      checkpoint.state = CheckpointState.CLEARED;

      server.world.addEntity(checkpoint);
      _targets.add(checkpoint);
    }

    _currentTrainingUnits = <TrainingUnit>[];

    // launch first luke
    _startTrainingProgram();
  }

  // Training Set

  _prepareTrainingProgram(){
    List<Luke> brains = LukeSerializer.readFromFile();
    if(brains != null){
      print("found brains. mutating them");
      List newBrains = [];
      int nameIndex = 0;
      for(Luke brain in brains){
        var jsonBrain = LukeSerializer.networkToJson(brain);
        for(int i = 0; i < SAMPLE_SIZE~/brains.length; i++)
        {
          Luke brain = LukeSerializer.jsonToNetwork(jsonBrain);
          brain.name = "Luke #$nameIndex"; nameIndex++;
          brain.generation++;
          brain.best_reward = double.MAX_FINITE;
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

  _startTrainingProgram(){
    _prepareTrainingProgram();

    //NUM_SIMULTANEOUS_SIMULATIONS
    List<Future> simulations = new List<Future>.generate(NUM_SIMULTANEOUS_SIMULATIONS, (int index){
      return _startNextTrainingUnit();
    });

    Future.wait(simulations).then((_){
      _finishTrainingProgram();
      _startTrainingProgram();
    });
  }

  _finishTrainingProgram(){

    for(TrainingSet ts in _trainingSets){
      if(ts.totalReward == 0.0){
        int pi = 3;
      }
      assert(ts.totalReward != 0.0);
      assert(ts.brain.best_reward != 0.0);
      ts.brain.best_reward = betterReward(ts.totalReward, ts.brain.best_reward);
    }

    _trainingSets.sort((TrainingSet ts1, TrainingSet ts2) => rewardCompare(ts1.brain.best_reward, ts2.brain.best_reward));
    String report = "${_trainingSets.length} done\n";


    for(int i = 0; i < _trainingSets.length; i++){
      TrainingSet ts = _trainingSets[i];
      report += "${ts.brain.name} | reward: ${ts.totalReward} | best reward: ${ts.brain.best_reward} | Generation ${ts.brain.generation}\n";

      Layer outputLayer = ts.brain.layers.last;
      Neuron xNeuron = outputLayer.neurons[0];
      Neuron yNeuron = outputLayer.neurons[1];

      report += "xNeuron: bias ${xNeuron.inputConnections[0].weightValue} | xOwn ${xNeuron.inputConnections[1].weightValue} | yOwn ${xNeuron.inputConnections[2].weightValue} | xTarget ${xNeuron.inputConnections[3].weightValue} | yTarget ${xNeuron.inputConnections[4].weightValue}\n";
      report += "yNeuron: bias ${yNeuron.inputConnections[0].weightValue} | xOwn ${yNeuron.inputConnections[1].weightValue} | yOwn ${yNeuron.inputConnections[2].weightValue} | xTarget ${yNeuron.inputConnections[3].weightValue} | yTarget ${yNeuron.inputConnections[4].weightValue}\n\n";
    }

    print(report);

    //save report to file
    Directory logDirectory = new Directory.fromUri(new Uri.file(Directory.current.path + "/log"));
    logDirectory.createSync(recursive:true);
    String logFileName = logDirectory.path + "/${new DateTime.now().millisecondsSinceEpoch}.log";
    new File(logFileName).writeAsStringSync(report);

    _trainingSets.sort((TrainingSet a, TrainingSet b) => rewardCompare(a.brain.best_reward, b.brain.best_reward));
    Luke bestOverall = _trainingSets.first.brain;
    bestOverall.name = "Best Overall";

    _trainingSets.sort((TrainingSet a, TrainingSet b) => rewardCompare(a.totalReward, b.totalReward));
    Luke bestTrainingSet = _trainingSets.first.brain;
    bestTrainingSet.name = "Best Training Set";

    _trainingPlan.sort((TrainingUnit a, TrainingUnit b) => rewardCompare(a.reward, b.reward));
    Luke bestTrainingUnit = _trainingPlan.first.brain;
    bestTrainingUnit.name = "Best Training Unit";

    List<Luke> survivingBrains = <Luke>[];
    survivingBrains.add(bestOverall);
    survivingBrains.add(bestTrainingSet);
    survivingBrains.add(bestTrainingUnit);
    LukeSerializer.writeToFile(survivingBrains);
  }

  // Training Unit

  Future _startNextTrainingUnit() {

    // fetch the next luke and launch him
    TrainingUnit trainingUnit = _trainingPlan[_nextTrainingUnit++];
    _currentTrainingUnits.add(trainingUnit);
    AIClientProxy client = new AIClientProxy(this, trainingUnit);
    trainingUnit.client = client;

    server.connectClient(client);
    client.playerName = trainingUnit.brain.name;
    server.registerPlayer(client, client.playerName);
    server.teleportPlayerTo(client,new Vector2.zero(),0.0,false);
    trainingUnit.reward = distanceToTarget(trainingUnit);


    trainingUnit.target.state = CheckpointState.CURRENT;
    trainingUnit.target.updateRank += 1;
    trainingUnit.state = TrainingUnitState.RUNNING;
    trainingUnit.completer = new Completer();

    new Future.delayed(new Duration(milliseconds: LIFETIME_MILLISECONDS), (){
      _endTrainingUnit(trainingUnit);
    });

    return trainingUnit.completer.future.then((_){
      if(_nextTrainingUnit < _trainingPlan.length) {
        return _startNextTrainingUnit();
      }
    });
  }


  preUpdate(double dt){
    for(TrainingUnit unit in _currentTrainingUnits)
    {
      unit.client.makeYourMove();
    }
  }


  postUpdate(double dt) {
    for(TrainingUnit unit in _currentTrainingUnits)
    {
      double distance = distanceToTarget(unit);
      if(distance < unit.reward) {
        unit.reward = distance;
      }

    }
  }

  _endTrainingUnit(TrainingUnit unit){
    if(unit.state == TrainingUnitState.ENDED) return;

    print("${unit.brain.name} died. Reward: ${unit.reward}");

    unit.state = TrainingUnitState.ENDED;

    unit.target.state = CheckpointState.CLEARED;
    unit.target.updateRank += 1;

    server.disconnectClient(unit.client);
    unit.client.trainingUnit = null;
    unit.client = null;
    _currentTrainingUnits.remove(unit);

    unit.completer.complete();
  }


  double betterReward(double reward1, double reward2) => (rewardCompare(reward1, reward2) < 1) ? reward1 : reward2;
  int rewardCompare(double reward1, double reward2) => reward1.compareTo(reward2);

  double distanceToTarget(TrainingUnit unit){
    return unit.client.movable.position.distanceTo(unit.target.position);
  }

  void send(AIClientProxy client, net.Envelope envelope) {
    if(envelope.messageType == net.MessageType.COLLISION){
      net.IntMessage message = new net.IntMessage.fromBuffer(envelope.payload);
      if(message.integer == client.movable.id){

        if(client.trainingUnit.state != TrainingUnitState.ENDED){
          _endTrainingUnit(client.trainingUnit);
          _startNextTrainingUnit();
        }
      }
    }
  }
}
