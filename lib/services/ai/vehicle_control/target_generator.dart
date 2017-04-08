part of ai;

class TargetGenerator {

  static List<Entity> setupCircleTargets(
      IGameServer server,
      {Vector2 center,
      int numTargets: 20,
      double targetDistance: 800.0,
      double targetDistanceRange: 200.0,
      double radius:30.0}){

    if(center == null){
      center = new Vector2.zero();
    }

    var targets = _createTargets(numTargets, targetDistance, targetDistanceRange, center);
    targets = targets.map((Vector2 position) => _createCheckpoint(position, radius)).toList();
    targets.forEach((Entity entity) => server.spawnEntity(entity));
    return targets;
  }

  static List<Entity> setupFluxCompensatorTargets(
      IGameServer server,
      {Vector2 center}){

    if(center == null){
      center = new Vector2.zero();
    }

    List targets = new List<Vector2>();
    targets.addAll(_createTargets(1, 0.0, 0.0, center));
    targets.addAll(_createTargets(3, 200.0, 0.0, center));
    targets.addAll(_createTargets(3, 400.0, 0.0, center));
    targets.addAll(_createTargets(3, 600.0, 0.0, center));
    targets.addAll(_createTargets(3, 800.0, 0.0, center));
    targets.addAll(_createTargets(3, 1000.0, 0.0, center));

    //int radiusTypeCounter = 0;
    targets = targets.map((Vector2 position){
      double radius = 30.0;
      /*
      switch (radiusTypeCounter){
        case 0:
          radius = 30.0;
          radiusTypeCounter = 1;
          break;
        case 1:
          radius = 50.0;
          radiusTypeCounter = 2;
          break;
        case 2:
          radius = 70.0;
          radiusTypeCounter = 0;
          break;
      }
      */
      return _createCheckpoint(position, radius);
    }).toList();
    targets.forEach((Entity entity) => server.spawnEntity(entity));
    return targets;
  }

  static List<Entity> setupDemoRaceTrackTargets(
      IGameServer server,
      {Vector2 center}){

    if(center == null){
      center = new Vector2.zero();
    }

    List targets = new List<Vector2>();
    targets.addAll(_createTargets(1, 800.0, 0.0, center));

    //int radiusTypeCounter = 0;
    targets = targets.map((Vector2 position){
      double radius = 60.0;
      return _createCheckpoint(position, radius);
    }).toList();
    targets.forEach((Entity entity) => server.spawnEntity(entity));
    return targets;
  }

  static List<Vector2> _createTargets(int numTargets, double targetDistance, double targetDistanceRange, Vector2 center){
    return new List<Vector2>.generate(numTargets,(index){
      num angle = (index.toDouble() / numTargets.toDouble()) * Math.PI * 2;
      double distance = targetDistance + (random.nextDouble()*2-1)*targetDistanceRange;
      Vector2 offset = new Vector2(Math.cos(angle) * distance, Math.sin(angle) * distance);
      return center + offset;
    });
  }

  static void teardownTargets(IGameServer server, List targets){
    for(Checkpoint target in targets){
      server.despawnEntity(target);
    }
    targets.clear();
  }

  static Checkpoint _createCheckpoint(Vector2 position, double radius){
    Checkpoint checkpoint = new Checkpoint();
    checkpoint.position = position;
    checkpoint.radius = radius;
    checkpoint.orientation = random.nextDouble() * Math.PI * 2;
    checkpoint.state = CheckpointState.FUTURE;
    return checkpoint;
  }

}