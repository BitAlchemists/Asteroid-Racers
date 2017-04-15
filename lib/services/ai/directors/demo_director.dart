part of ai;

/*
 DemoDirector runs demos for a list of scripts. It is designed to demo
  the capabilities of the latest network. This means, that it can be used
  while training new iterations of the network.

  The latest version of the network is loaded and ran against the script.
  When the script is finished cycle begins again.
  */

class AIDemoDirector extends AIDirector {
  logging.Logger _log = new logging.Logger("ai.AIDemoDirector");
  String networkName;
  List<Function> scriptFactories = <Function>[];
  String playername;

  AIDemoDirector(this.networkName, this.playername);

  start(){
    _log.fine("start()");
    int playerCount = 0;

    for(Function scriptFactory in this.scriptFactories){
      runDemoLoopWithLatestNetwork((network){
        _log.fine("start() runFunction()");

        String clientName;
        if(this.playername != null){
          clientName = "$playername${playerCount++}";
        }

        AIGameClient client = _runClientInIsolate(clientName);
        Script script = scriptFactory();
        return runScript(script, client, network).then((_){
          despawnClient(client);
          return true;
        });
      });
    }
  }

  runDemoLoopWithLatestNetwork (runFunction){
    _log.fine("runDemoLoopWithLatestNetwork()");
    Future.doWhile((){
      _log.fine("runDemoLoopWithLatestNetwork() doWhile()");
      List<MajorTom> networks = MajorTomSerializer.readNetworksFromFile(networkName);

      if (networks != null && networks.length > 0) {
        return runFunction(networks[0]);
      }
      else{
        _log.info("No AI networks found in folder name $networkName. Not going to show demo.");
        return false;
      }
    });
  }
}