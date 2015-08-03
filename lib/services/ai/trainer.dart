part of ai;

class Trainer {
  IGameServer server;


  TrainingProgram _trainingProgram;
  List<TrainingProgramInstance> _trainingInstances;
  List<TrainingProgramInstance> _runningTrainingInstances;
  int _nextTrainingInstance;

  int SAMPLE_SIZE = 100;
  int NUM_SIMULTANEOUS_SIMULATIONS = 1;

  start(){
    TrainingProgram program = new FlyTowardsTargetsTrainingProgram();

    _startTraining();
  }

  // Training Set
  _prepareTraining(){
    List<MajorTom> networks = _prepareNetworks();

    _trainingInstances = new List<TrainingProgramInstance>.generate(networks.length, (int tsIndex){
      return new TrainingProgramInstance(_trainingProgram, networks[tsIndex]);
    });

    _nextTrainingInstance = 0;
  }

  _prepareNetworks(){
    List<MajorTom> networks = LukeSerializer.readFromFile();
    if(networks != null){
      print("found brains. mutating them");
      List newNetworks = [];
      int nameIndex = 0;
      for(MajorTom brain in networks){
        var jsonBrain = LukeSerializer.networkToJson(brain);
        for(int i = 0; i < SAMPLE_SIZE~/networks.length; i++)
        {
          MajorTom network = LukeSerializer.jsonToNetwork(jsonBrain);
          network.name = "Major Tom #$nameIndex"; nameIndex++;
          network.generation++;
          //brain.best_reward = double.MAX_FINITE;
          network.mutate(0.1);
          newNetworks.add(network);
        }
      }
      networks.addAll(newNetworks);
    }
    else{
      print("did not find existing brains. creating new ones");
      networks = new List<MajorTom>.generate(SAMPLE_SIZE, (int index) => new MajorTom(4,2,"Luke #$index"));
    }

    return networks;
  }

  _startTraining(){
    _prepareTraining();

    //NUM_SIMULTANEOUS_SIMULATIONS
    List<Future> simulations = new List<Future>.generate(NUM_SIMULTANEOUS_SIMULATIONS, (int index){
      return _startNextTrainingInstance();
    });

    Future.wait(simulations).then((_){
      _finishTrainingProgram();
      _startTraining();
    });
  }


  // Training Unit

  Future _startNextTrainingInstance() {

    // fetch the next luke and launch him
    TrainingProgramInstance trainingInstance = _trainingInstances[_nextTrainingInstance++];
    _runningTrainingInstances.add(trainingInstance);

    AIClientProxy client = new AIClientProxy();
    trainingInstance.client = client;

    client.server = this.server;
    server.connectClient(client);
    client.playerName = trainingInstance.network.name;
    server.registerPlayer(client, client.playerName);

    return _trainingProgram.run(trainingInstance).then(_endTrainingInstance);
  }


  preUpdate(double dt){
    for(Command unit in _runningTrainingInstances)
    {
      unit.update();
    }
  }


  postUpdate(double dt) {
    for(Command unit in _runningTrainingInstances)
    {
      unit.updateReward();
    }
  }

  _endTrainingInstance(Command unit){
    unit.end();
    _currentTrainingUnits.remove(unit);

    if(_nextTrainingInstance < _trainingPlan.length) {
      return _startNextTrainingInstance();
    }

  }

  _finishTrainingProgram(){

    for(TrainingProgram ts in _trainingProgram){
      assert(ts.score != 0.0);
      assert(ts.best_reward != 0.0);
      ts.best_reward = betterReward(ts.score, ts.best_reward);
    }

    _trainingProgram.sort((TrainingProgram ts1, TrainingProgram ts2) => rewardCompare(ts1.best_reward, ts2.best_reward));
    String report = "${_trainingProgram.length} done\n";


    for(int i = 0; i < _trainingProgram.length; i++){
      TrainingProgram ts = _trainingProgram[i];
      report += "${ts.network.name} | reward: ${ts.score} | best reward: ${ts.best_reward} | Generation ${ts.network.generation}\n";

      Layer outputLayer = ts.network.layers.last;
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

    _trainingPlan.sort((Command a, Command b) => rewardCompare(a.reward, b.reward));
    MajorTom bestTrainingUnit = _trainingPlan.first.network;
    bestTrainingUnit.name = "Best Training Unit";

    _trainingProgram.sort((TrainingProgram a, TrainingProgram b) => rewardCompare(a.score, b.score));
    MajorTom bestTrainingSet = _trainingProgram.first.network;
    bestTrainingSet.name = "Best Training Set";

    _trainingProgram.sort((TrainingProgram a, TrainingProgram b) => rewardCompare(a.best_reward, b.best_reward));
    MajorTom bestOverall = _trainingProgram.first.network;
    bestOverall.name = "Best Overall";

    List<MajorTom> survivingBrains = <Network>[];
    survivingBrains.add(bestOverall);
    survivingBrains.add(bestTrainingSet);
    survivingBrains.add(bestTrainingUnit);
    LukeSerializer.writeToFile(survivingBrains);
  }


  double betterReward(double reward1, double reward2) => (rewardCompare(reward1, reward2) < 1) ? reward1 : reward2;
  int rewardCompare(double reward1, double reward2) => reward1.compareTo(reward2);

}

/*
          _startNextTrainingUnit();
 */
