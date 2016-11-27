part of ai;

/*
 DemoDirector runs demos for a list of scripts. It is designed to demo
  the capabilities of the latest network. This means, that it can be used
  while training new iterations of the network.

  The latest version of the network is loaded and ran against the script.
  When the script is finished cycle begins again.
  */

class DemoDirector extends AIDirector {
  String networkName;
  List<Function> scriptFactories = <Function>[];

  DemoDirector(this.networkName);

  start(){
    for(Function scriptFactory in this.scriptFactories){
      AIGameClient client = spawnClient();
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