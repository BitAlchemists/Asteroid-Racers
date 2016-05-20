part of ai;

class DemoDirector extends AIDirector {
  String folderName = "luke";
  Vector2 center = new Vector2.zero();
  Function createTargetsFunction;

  DemoDirector([this.folderName, this.center, this.createTargetsFunction]);

  start(){
    var client = spawnClient();
    Future.doWhile((){
      List<MajorTom> networks = MajorTomSerializer.readNetworksFromFile(folderName);
      if (networks != null && networks.length > 0) {
        List targets = createTargetsFunction(server);
        return runScript(new RespawnTargetScript(targets, center, 9000~/15), client, networks[0]).then((_){
          CircleTargetGenerator.teardownTargets(server, targets);
          return true;
        });
      }
      else{
        log.info("No AI networks found in folder name $folderName. Not going to show demo.");
        return false;
      }
    });
  }
}