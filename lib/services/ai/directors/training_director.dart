part of ai;

double betterReward(double reward1, double reward2) => (rewardCompare(reward1, reward2) < 1) ? reward1 : reward2;
int rewardCompare(double reward1, double reward2) => reward1.compareTo(reward2);


class AITrainingDirector extends AIDirector {
  Function scriptFactory;
  Function networkMutator;
  Function networkFactory;
  String networkName = "luke";
  NetworkSerializer networkSerializer;
  logging.Logger log = new logging.Logger("services.ai.TrainingDirector");

  int sampleSize = 1;
  // WARNING: There seems to be code missing that generates new clients when the old ones are done. So the next variable
  // has to have the same value the SAMPLE_SIZE has; for now.
  int get simultaneousSimulations => sampleSize;

  List<NeuralNetwork> networks;
  Map<NeuralNetwork, double> evaluations;
  List<Script> runningScripts;
  int _nextInstanceIndex;

  start(){
    _startTraining();
  }

  int _iterations = 0;

  _startTraining(){
    log.finer("_startTraining()");
    _prepareTraining();

    int numSimultaneousSimulations = Math.min(simultaneousSimulations, networks.length);
    List<Future> simulations = new List<Future>.generate(numSimultaneousSimulations, (int index){
      return _runNextTrainingInstance();
    });

    Future.wait(simulations).then((_){
      _finishTraining();
      _startTraining();
    });
  }


  _prepareTraining(){
    log.finest("_prepareTraining()");
    if(networks == null){
      networks = _prepareNetworks();
    }
    evaluations = new Map<NeuralNetwork, double>.fromIterable(
        networks,
        key:(network) => network,
        value:(_) => 0.0);
    _nextInstanceIndex = 0;
  }

  _prepareNetworks(){
    log.finest("_prepareNetworks()");
    assert(networkMutator != null);
    List<NeuralNetwork> networks = networkSerializer.readNetworksFromFile(networkName);
    if(networks != null){
      log.info("found networks of name $networkName. mutating them");
      List newNetworks = [];
      int nameIndex = 0;
      for(NeuralNetwork brain in networks){
        var jsonBrain = networkSerializer.networkToJson(brain);
        for(int i = 0; i < sampleSize-1; i++)
        {
          NeuralNetwork network = networkSerializer.jsonToNetwork(jsonBrain);
          network.name = "Major Tom #$nameIndex"; nameIndex++;
          network.generation++;
          //brain.best_reward = double.MAX_FINITE;
          networkMutator(network);
          newNetworks.add(network);
        }
      }
      networks.addAll(newNetworks);
    }
    else{
      log.info("did not find existing networks of name $networkName. creating new ones");
      networks = new List<NeuralNetwork>.generate(sampleSize, (int index) => networkFactory("Luke #$index"));
    }

    return networks;
  }

  Future _runNextTrainingInstance() async{
    log.finest("_runNextTrainingInstance()");
    assert(scriptFactory != null);
    var network = networks[_nextInstanceIndex++];
    NetworkTrainingScript script = scriptFactory(network);

    return runScript(script).then((_){
      evaluations[script.network] = script.evaluator.finalScore;
    });
  }




  postUpdate(double dt) {
    log.finest("postUpdate()");
    for(NetworkTrainingScript script in _runningScripts){
      if(script.state == ScriptState.RUNNING){
        script.evaluator.evaluate(script, dt);
      }
    }
    super.postUpdate(dt);
  }


  _finishTraining(){
    log.finer("_finishTraining()");

    List<NeuralNetwork> networksByBestReward = evaluations.keys.toList();
    networksByBestReward.sort((a,b) => evaluations[a].compareTo(evaluations[b]));

    _createReport(networksByBestReward);

    NeuralNetwork bestTrainingSet = networksByBestReward.first;
    bestTrainingSet.name = "Winner from last round";
    List<NeuralNetwork> survivors = [bestTrainingSet];

    networkSerializer.writeNetworksToFile(survivors, networkName);

    networks = null;
    evaluations = null;
  }

  File file;

  _createReport(List<NeuralNetwork> networksByBestReward){
    log.finest("_createReport()");

    DateTime now = new DateTime.now();

    String report = "${now.toString()} ${evaluations.length} done. ";

    report += "Min score: ${evaluations[networksByBestReward.first].toStringAsFixed(0)} - ${networksByBestReward.first.name}";
/*
    double scoreSum = 0.0;
    for(double score in evaluations.values){
      scoreSum += score;
    }
    scoreSum /= evaluations.length;
    report += "Avg score: ${scoreSum}\n";

    report += "Max score: ${evaluations[networksByBestReward.last]}\n";
*/
    log.info(report);

    //print("minInputNetwork: $minInputNetwork");
    //print("maxInputNetwork: $maxInputNetwork");

    //save report to file
    if(file == null){
      Directory logDirectory = new Directory.fromUri(new Uri.file(Directory.current.path + "/db/$networkName/log"));
      logDirectory.createSync(recursive:true);
      String logFileName = logDirectory.path + "/${new DateTime.now().millisecondsSinceEpoch}.log";
      file = new File(logFileName);
    }
    report += "\n";
    file.writeAsStringSync(report, mode:FileMode.APPEND);

  }

}
