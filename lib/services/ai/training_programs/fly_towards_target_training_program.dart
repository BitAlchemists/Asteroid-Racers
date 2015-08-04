part of ai;

class FlyTowardsTargetsTrainingProgram extends TrainingProgram {
  int numTargets = 6;
  double targetDistance = 275.0;
  double targetDistanceRange = 25.0;
  Vector2 trainingCenter = new Vector2(-2700.0,1800.0);
  int lifetimeMilliseconds = 3000; //should be multiples of 15 (milliseconds per frame



  FlyTowardsTargetsTrainingProgram();

  setUp(){
    for(int i = 0; i < numTargets; i++){
      num angle = (i.toDouble() / numTargets.toDouble());
      double distance = targetDistance + (random.nextDouble()*2-1)*targetDistanceRange;
      Vector2 position = new Vector2(Math.cos(angle * Math.PI * 2) * distance, Math.sin(angle * Math.PI * 2) * distance);
      createTrainingUnit(position + trainingCenter);
    }
  }

  FlyTowardsTargetTrainingUnit createTrainingUnit(Vector2 position){
    Checkpoint checkpoint = new Checkpoint();
    checkpoint.position = position;
    checkpoint.radius = 30.0;
    checkpoint.orientation = random.nextDouble() * Math.PI * 2;
    checkpoint.state = CheckpointState.CLEARED;

    server.world.addEntity(checkpoint);

    var tpi = new FlyTowardsTargetTrainingUnit(trainingCenter,checkpoint, lifetimeMilliseconds);
    trainingUnits.add(tpi);
  }

  tearDown(){
    for(FlyTowardsTargetTrainingUnit tu in trainingUnits){
      server.world.removeEntity(tu.target);
    }

    trainingUnits.clear();
  }
}

class FlyTowardsTargetTrainingUnit extends TrainingUnit {
  Vector2 spawn;
  Checkpoint target;
  int lifetimeMilliseconds;
  Command _command;

  FlyTowardsTargetTrainingUnit(this.spawn, this.target, this.lifetimeMilliseconds) {
    _command = new FlyTowardsTargetCommand(target.position);
  }

  Future<double> run(TrainingProgramInstance tpi){

    tpi.client.server.teleportPlayerTo(tpi.client,spawn,target.orientation,false);

    CommandInstance ci = new CommandInstance();
    ci.client = tpi.client;
    ci.network = tpi.network;
    ci.command = _command;
    tpi.client.currentCommandInstance = ci;
    tpi.client.currentCommandInstance.command.start(tpi.client.currentCommandInstance);
    target.state = CheckpointState.CURRENT;
    target.updateRank += 1;

    return new Future.delayed(new Duration(milliseconds: lifetimeMilliseconds)).then((_){

      ci.command.end(ci);
      target.state = CheckpointState.CLEARED;
      target.updateRank += 1;

      tpi.client.currentCommandInstance = null;

      return ci.score;
    });
  }

}