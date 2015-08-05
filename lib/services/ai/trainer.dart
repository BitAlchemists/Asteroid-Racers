part of ai;

double betterReward(double reward1, double reward2) => (rewardCompare(reward1, reward2) < 1) ? reward1 : reward2;
int rewardCompare(double reward1, double reward2) => reward1.compareTo(reward2);


class Trainer {
  IGameServer server;


  List<TrainingProgramInstance> _trainingInstances = <TrainingProgramInstance>[];
  List<TrainingProgramInstance> _runningTrainingInstances = <TrainingProgramInstance>[];
  int _nextTrainingInstance;

  int SAMPLE_SIZE = 100;
  int NUM_SIMULTANEOUS_SIMULATIONS = 100;
  double LEARNING_RATE = 0.2;

  start(){
    _startTraining();
  }

  // Training Set
  _prepareTraining(){
    List<MajorTom> networks = _prepareNetworks();



    _nextTrainingInstance = 0;
  }

  _prepareNetworks(){
    List<MajorTom> networks = LukeSerializer.readNetworksFromFile();
    if(networks != null){
      //print("found brains. mutating them");
      List newNetworks = [];
      int nameIndex = 0;
      for(MajorTom brain in networks){
        var jsonBrain = LukeSerializer.networkToJson(brain);
        for(int i = 0; i < SAMPLE_SIZE-1; i++)
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
      //print("did not find existing brains. creating new ones");
      networks = new List<MajorTom>.generate(SAMPLE_SIZE*10, (int index) => new MajorTom([4,3,2],"Luke #$index"));
    }

    return networks;
  }

  _startTraining(){
    _prepareTraining();

    //NUM_SIMULTANEOUS_SIMULATIONS
    List<Future> simulations = new List<Future>.generate(NUM_SIMULTANEOUS_SIMULATIONS, (int index){
      //return _startNextTrainingInstance();
    });

    Future.wait(simulations).then((_){
      _finishTrainingProgram();
      _startTraining();
    });
  }


  // Training Unit



  preUpdate(double dt){
    for(TrainingProgramInstance tpi in _runningTrainingInstances)
    {
      tpi.client.step(dt);
    }
  }

  update(double dt){

  }

  postUpdate(double dt) {
    for(TrainingProgramInstance tpi in _runningTrainingInstances)
    {
      tpi.updateScore(tpi.client.command);
      tpi.currentTrainingUnit.step(tpi,dt);
    }
  }


  _finishTrainingProgram(){

    for(TrainingProgramInstance tpi in _trainingInstances){
      tpi.updateHighscore();

    }

    _createReport();

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

  _createReport(){
    _trainingInstances.sort((TrainingProgramInstance tpi1, TrainingProgramInstance tpi2) => rewardCompare(tpi1.highscore, tpi2.highscore));
    String report = "${_trainingInstances.length} done\n";

    report += "Min score: ${_trainingInstances.first.score}\n";

    double scoreSum = 0.0;
    for(TrainingProgramInstance tpi in _trainingInstances){
      scoreSum += tpi.score;
    }
    scoreSum /= _trainingInstances.length;
    report += "Avg score: ${scoreSum}\n";

    report += "Max score: ${_trainingInstances.last.score}\n";
/*
    for(int i = 0; i < _trainingInstances.length; i++){
      TrainingProgramInstance tpi = _trainingInstances[i];
      report += "${tpi.network.name} | reward: ${tpi.score} | best reward: ${tpi.highscore} | Generation ${tpi.network.generation}\n";

      //Layer outputLayer = tpi.network.layers.last;
      //Neuron xNeuron = outputLayer.neurons[0];
      //Neuron yNeuron = outputLayer.neurons[1];

      //report += "xNeuron: bias ${xNeuron.inputConnections[0].weightValue} | xOwn ${xNeuron.inputConnections[1].weightValue} | yOwn ${xNeuron.inputConnections[2].weightValue} | xTarget ${xNeuron.inputConnections[3].weightValue} | yTarget ${xNeuron.inputConnections[4].weightValue}\n";
      //report += "yNeuron: bias ${yNeuron.inputConnections[0].weightValue} | xOwn ${yNeuron.inputConnections[1].weightValue} | yOwn ${yNeuron.inputConnections[2].weightValue} | xTarget ${yNeuron.inputConnections[3].weightValue} | yTarget ${yNeuron.inputConnections[4].weightValue}\n\n";
    }
*/
    print(report);

    //save report to file
    Directory logDirectory = new Directory.fromUri(new Uri.file(Directory.current.path + "/log"));
    logDirectory.createSync(recursive:true);
    String logFileName = logDirectory.path + "/${new DateTime.now().millisecondsSinceEpoch}.log";
    new File(logFileName).writeAsStringSync(report);

  }

}
