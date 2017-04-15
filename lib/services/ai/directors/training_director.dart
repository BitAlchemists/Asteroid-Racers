part of ai;

double betterReward(double reward1, double reward2) => (rewardCompare(reward1, reward2) < 1) ? reward1 : reward2;
int rewardCompare(double reward1, double reward2) => reward1.compareTo(reward2);


class AITrainingDirector extends AIDirector {
  logging.Logger _log = new logging.Logger("ai.AITrainingDirector");
  Function scriptFactory;
  Function networkMutator;
  String networkName = "luke";
  List networkConfiguration;

  int sampleSize; //1000
  double survivalRate; // 0.2
  // WARNING: There seems to be code missing that generates new clients when the old ones are done. So the next variable
  // has to have the same value the SAMPLE_SIZE has; for now.
  int get simultaneousSimulations => sampleSize;

  List<MajorTom> networks;
  Map<MajorTom, QuadraticSumOfDistanceToTargetsEvaluator> evaluations;
  List<Script> runningScripts;
  int _nextInstanceIndex;

  start(){
    _startTraining();
  }

  _startTraining(){
    _log.finer("_startTraining()");
    _prepareTraining();

    _log.info("Starting training with ${networks.length} instances");

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
    _log.fine("_prepareTraining()");
    networks = _prepareNetworks();
    evaluations = new Map<MajorTom, QuadraticSumOfDistanceToTargetsEvaluator>();
    _nextInstanceIndex = 0;
  }

  _prepareNetworks(){
    _log.fine("_prepareNetworks()");
    assert(networkMutator != null);
    List<MajorTom> networks = MajorTomSerializer.readNetworksFromFile(networkName);
    if(networks != null){
      //print("found brains. mutating them");
      List newNetworks = [];
      int nameIndex = 0;
      for(MajorTom brain in networks){
        var jsonBrain = MajorTomSerializer.networkToJson(brain);
        int numOfChildren = Math.max(1,(sampleSize/networks.length-1).toInt());
        for(int i = 0; i < numOfChildren; i++)
        {
          MajorTom network = MajorTomSerializer.jsonToNetwork(jsonBrain);
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
      //print("did not find existing brains. creating new ones");
      networks = new List<MajorTom>.generate(sampleSize, (int index) => new MajorTom(networkConfiguration,"Luke #$index"));
    }

    return networks;
  }

  Future _runNextTrainingInstance(){
    _log.finest("_runNextTrainingInstance()");
    assert(scriptFactory != null);
    var network = networks[_nextInstanceIndex++];
    var client = spawnClient(network.name);
    Script script = scriptFactory();

    return runScript(script, client, network).then((_){
      despawnClient(client);
      evaluations[script.network] = script.evaluator;
    });
  }




  postUpdate(double dt) {
    _log.finest("postUpdate()");
    for(Script script in _runningScripts){
      if(script.state == ScriptState.RUNNING){
        script.evaluator.evaluate(script, dt);
      }
    }
    super.postUpdate(dt);
  }


  _finishTraining(){
    _log.finer("_finishTraining()");

    List<MajorTom> networksByBestReward = evaluations.keys.toList();
    networksByBestReward.sort((a,b) => evaluations[a].finalScore.compareTo(evaluations[b].finalScore));


    _log.info("Network with best reward: ${evaluations[networksByBestReward.first].finalScore} - worst reward: ${evaluations[networksByBestReward.last].finalScore}");
    _createReport(networksByBestReward);

    int survivingNetworks = Math.max((networksByBestReward.length*survivalRate).toInt(), 1);;
    List<MajorTom> survivors = networksByBestReward.sublist(0,survivingNetworks);

    MajorTomSerializer.writeNetworksToFile(survivors, networkName);

    networks = null;
    evaluations = null;
  }

  File file;

  _createReport(List<MajorTom> networksByBestReward){
    _log.finest("_createReport()");

    List<MajorTom> networksBySmallestDistance = evaluations.keys.toList();
    networksBySmallestDistance.sort((a,b) => evaluations[a].smallestDistance.compareTo(evaluations[b].smallestDistance));

    DateTime now = new DateTime.now();

    String report = "${now.toString()} ${evaluations.length} done.\n";

    report += "Min score: ${evaluations[networksByBestReward.first].finalScore.toStringAsFixed(0)} - ${networksByBestReward.first.name}\n";
    report += "Min dist:  ${evaluations[networksBySmallestDistance.first].smallestDistance.toStringAsFixed(0)} - ${networksBySmallestDistance.first.name}\n";

    double scoreSum = 0.0;
    double distanceSum = 0.0;
    for(QuadraticSumOfDistanceToTargetsEvaluator evaluator in evaluations.values){
      scoreSum += evaluator.finalScore;
      distanceSum += evaluator.smallestDistance;
    }
    scoreSum /= evaluations.length;
    distanceSum /= evaluations.length;
    report += "Avg score: ${scoreSum}\n";
    report += "Avg dist:  ${distanceSum}\n";

    report += "Max score: ${evaluations[networksByBestReward.last].finalScore}\n";
    report += "Max distance: ${evaluations[networksBySmallestDistance.last].smallestDistance}\n";

    //_log.info(report);

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
