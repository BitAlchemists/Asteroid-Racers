part of ai;

class DemoDirector extends AIDirector {
  String networkName;
  List<Function> scriptFactories = <Function>[];

  DemoDirector(this.networkName);

  start(){
    for(Function scriptFactory in this.scriptFactories){
      var client = spawnClient();
      runDemoLoopWithLatestNetwork((network){
        Script script = scriptFactory();
        return runScript(script, client, network).then((_){
          return true;
        });
      });
    }
  }

  runDemoLoopWithLatestNetwork (runFunction){
    Future.doWhile((){
      List<MajorTom> networks = MajorTomSerializer.readNetworksFromFile(networkName);

      if (networks != null && networks.length > 0) {
        return runFunction(networks[0]);
      }
      else{
        log.info("No AI networks found in folder name $networkName. Not going to show demo.");
        return false;
      }
    });
  }
}