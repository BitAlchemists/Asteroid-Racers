part of ai;

double betterReward(double reward1, double reward2) => (rewardCompare(reward1, reward2) < 1) ? reward1 : reward2;
int rewardCompare(double reward1, double reward2) => reward1.compareTo(reward2);


class Trainer extends AIDirector {
  Function scriptFactory;
  Function networkMutator;
  String folderName = "luke";

  int SAMPLE_SIZE = 1000;
  int NUM_SIMULTANEOUS_SIMULATIONS = 1000;

  List<MajorTom> networks;
  Map<MajorTom, double> evaluations;
  List<Script> runningScripts;
  int _nextInstanceIndex;

  start(){
    _startTraining();
  }

  _startTraining(){
    _prepareTraining();

    int numSimultaneousSimulations = Math.min(NUM_SIMULTANEOUS_SIMULATIONS, networks.length);
    List<Future> simulations = new List<Future>.generate(numSimultaneousSimulations, (int index){
      return _runNextTrainingInstance();
    });

    Future.wait(simulations).then((_){
      _finishTraining();
      _startTraining();
    });
  }


  _prepareTraining(){
    if(networks == null){
      networks = _prepareNetworks();
    }
    evaluations = new Map<MajorTom, double>.fromIterable(
        networks,
        key:(network) => network,
        value:(_) => 0.0);
    _nextInstanceIndex = 0;
  }

  _prepareNetworks(){
    assert(networkMutator != null);
    List<MajorTom> networks = MajorTomSerializer.readNetworksFromFile(folderName);
    if(networks != null){
      //print("found brains. mutating them");
      List newNetworks = [];
      int nameIndex = 0;
      for(MajorTom brain in networks){
        var jsonBrain = MajorTomSerializer.networkToJson(brain);
        for(int i = 0; i < SAMPLE_SIZE-1; i++)
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
      networks = new List<MajorTom>.generate(SAMPLE_SIZE*10, (int index) => new MajorTom([5,4,2],"Luke #$index"));
    }

    return networks;
  }

  Future _runNextTrainingInstance(){
    assert(scriptFactory != null);
    var client = spawnClient();
    var network = networks[_nextInstanceIndex++];
    Script script = scriptFactory();

    return runScript(script, client, network).then((_){
      despawnClient(client);
      evaluations[script.network] = script.evaluator.finalScore;
    });
  }




  postUpdate(double dt) {
    for(Script script in _scripts){
      script.evaluator.evaluate(script, dt);
    }
    super.postUpdate(dt);
  }


  _finishTraining(){

    List<MajorTom> networksByBestReward = evaluations.keys.toList();
    networksByBestReward.sort((a,b) => evaluations[a].compareTo(evaluations[b]));

    _createReport(networksByBestReward);

    MajorTom bestTrainingSet = networksByBestReward.first;
    bestTrainingSet.name = "Winner from last round";
    List<MajorTom> survivors = [bestTrainingSet];

    MajorTomSerializer.writeNetworksToFile(survivors, folderName);

    networks = null;
    evaluations = null;
  }

  _createReport(List<MajorTom> networksByBestReward){

    String report = "${evaluations.length} done\n";

    report += "Min score: ${evaluations[networksByBestReward.first]} - ${networksByBestReward.first.name}\n";

    double scoreSum = 0.0;
    for(double score in evaluations.values){
      scoreSum += score;
    }
    scoreSum /= evaluations.length;
    report += "Avg score: ${scoreSum}\n";

    report += "Max score: ${evaluations[networksByBestReward.last]}\n";

    print(report);

    //save report to file
    Directory logDirectory = new Directory.fromUri(new Uri.file(Directory.current.path + "/db/$folderName/log"));
    logDirectory.createSync(recursive:true);
    String logFileName = logDirectory.path + "/${new DateTime.now().millisecondsSinceEpoch}.log";
    new File(logFileName).writeAsStringSync(report);

  }

}
