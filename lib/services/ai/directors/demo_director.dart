part of ai;

class DemoDirector extends AIDirector {
  String folderName = "luke";
  Vector2 center = new Vector2.zero();

  DemoDirector([this.folderName, this.center]);

  start(){
    List<MajorTom> networks = MajorTomSerializer.readNetworksFromFile(folderName);
    if (networks != null && networks.length > 0) {
      var client = spawnClient();
      Future.doWhile((){
        List targets = CircleTargetGenerator.setupTargets(server, center:center);
        return runScript(new TargetScript(targets, center), client, networks[0]).then((_){
          CircleTargetGenerator.teardownTargets(server, targets);
          return true;
        });
      });
    }
  }
}