part of ai;

class DemoDirector extends AIDirector {

  DemoDirector();

  start(){
    List<MajorTom> networks = LukeSerializer.readNetworksFromFile();
    if (networks != null && networks.length > 0) {
      var client = spawnClient();
      Future.doWhile((){
        Vector2 center = new Vector2(-2300.0, 1800.0);
        List targets = CircleTargetGenerator.setupTargets(server, center);
        return runScript(new TargetScript(center, targets), client, networks[0]).then((_){
          CircleTargetGenerator.teardownTargets(server, targets);
          return true;
        });
      });
    }
  }
}