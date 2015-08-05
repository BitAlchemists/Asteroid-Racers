part of ai;

class DemoDirector extends AIDirector {

  DemoDirector();

  start(){
    List<MajorTom> networks = LukeSerializer.readNetworksFromFile();
    if (networks != null && networks.length > 0) {
      var client = spawnClient();
      Future.doWhile((){
        return runScript(new CircleTargetScript(), client, networks[0]).then((_)=>true);
      });
    }
  }
}