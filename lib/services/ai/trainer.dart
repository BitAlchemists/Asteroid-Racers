part of ai;

double betterReward(double reward1, double reward2) => (rewardCompare(reward1, reward2) < 1) ? reward1 : reward2;
int rewardCompare(double reward1, double reward2) => reward1.compareTo(reward2);


class Trainer {
  IGameServer server;


  TrainingProgram _trainingProgram;
  List<TrainingProgramInstance> _trainingInstances = <TrainingProgramInstance>[];
  List<TrainingProgramInstance> _runningTrainingInstances = <TrainingProgramInstance>[];
  int _nextTrainingInstance;

  int SAMPLE_SIZE = 1000;
  int NUM_SIMULTANEOUS_SIMULATIONS = 100;
  double LEARNING_RATE = 0.3;

  start(){
    _trainingProgram = new FlyTowardsTargetsTrainingProgram();
    _trainingProgram.server = server;
    _trainingProgram.setUp();

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
    List<MajorTom> networks = LukeSerializer.readNetworksFromFile();
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
          network.mutate(LEARNING_RATE);
          newNetworks.add(network);
        }
      }
      networks.addAll(newNetworks);
    }
    else{
      print("did not find existing brains. creating new ones");
      networks = new List<MajorTom>.generate(SAMPLE_SIZE*10, (int index) => new MajorTom([4,4,4,2],"Luke #$index"));
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
    for(TrainingProgramInstance tpi in _runningTrainingInstances)
    {
      tpi.client.step(dt);
    }
  }

  postUpdate(double dt) {
    for(TrainingProgramInstance tpi in _runningTrainingInstances)
    {
      tpi.client.currentCommandInstance.command.updateReward(tpi.client.currentCommandInstance);
    }
  }

  _endTrainingInstance(TrainingProgramInstance trainingInstance){

    _runningTrainingInstances.remove(trainingInstance);
    server.disconnectClient(trainingInstance.client);
    trainingInstance.client.server = null;
    trainingInstance.client = null;

    trainingInstance.client = null;
    print("${trainingInstance.network.name} finished training. score: ${trainingInstance.score}");

    if(_nextTrainingInstance < _trainingInstances.length) {
      return _startNextTrainingInstance();
    }
  }

  _finishTrainingProgram(){

    for(TrainingProgramInstance tpi in _trainingInstances){
      tpi.updateHighscore();

    }

    _trainingInstances.sort((TrainingProgramInstance tpi1, TrainingProgramInstance tpi2) => rewardCompare(tpi1.highscore, tpi2.highscore));
    String report = "${_trainingInstances.length} done\n";


    for(int i = 0; i < _trainingInstances.length; i++){
      TrainingProgramInstance tpi = _trainingInstances[i];
      report += "${tpi.network.name} | reward: ${tpi.score} | best reward: ${tpi.highscore} | Generation ${tpi.network.generation}\n";

      //Layer outputLayer = tpi.network.layers.last;
      //Neuron xNeuron = outputLayer.neurons[0];
      //Neuron yNeuron = outputLayer.neurons[1];

      //report += "xNeuron: bias ${xNeuron.inputConnections[0].weightValue} | xOwn ${xNeuron.inputConnections[1].weightValue} | yOwn ${xNeuron.inputConnections[2].weightValue} | xTarget ${xNeuron.inputConnections[3].weightValue} | yTarget ${xNeuron.inputConnections[4].weightValue}\n";
      //report += "yNeuron: bias ${yNeuron.inputConnections[0].weightValue} | xOwn ${yNeuron.inputConnections[1].weightValue} | yOwn ${yNeuron.inputConnections[2].weightValue} | xTarget ${yNeuron.inputConnections[3].weightValue} | yTarget ${yNeuron.inputConnections[4].weightValue}\n\n";
    }

    print(report);

    //save report to file
    Directory logDirectory = new Directory.fromUri(new Uri.file(Directory.current.path + "/log"));
    logDirectory.createSync(recursive:true);
    String logFileName = logDirectory.path + "/${new DateTime.now().millisecondsSinceEpoch}.log";
    new File(logFileName).writeAsStringSync(report);


    List<MajorTom> survivingBrains = <MajorTom>[];

    _trainingInstances.sort((TrainingProgramInstance a, TrainingProgramInstance b) => rewardCompare(a.score, b.score));
    MajorTom bestTrainingSet = _trainingInstances.first.network;
    bestTrainingSet.name = "Best Training Set";
    survivingBrains.add(bestTrainingSet);
    /*
    _trainingInstances.sort((TrainingProgramInstance a, TrainingProgramInstance b) => rewardCompare(a.highscore, b.highscore));
    MajorTom bestOverall = _trainingInstances.first.network;
    bestOverall.name = "Best Overall";
    survivingBrains.add(bestOverall);
    */
    LukeSerializer.writeNetworksToFile(survivingBrains);

    _trainingInstances.clear();
  }

}
