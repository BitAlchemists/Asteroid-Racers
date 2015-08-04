part of ai;


enum CommandInstanceState
{
  READY,
  RUNNING,
  ENDED
}

class CommandInstance {

  CommandInstanceState state = CommandInstanceState.READY;
  MajorTom network;
  AIClientProxy client;
  Command command;

  double score;

}

abstract class Command {

  start(CommandInstance instance);
  step(CommandInstance instance, double dt);
  end(CommandInstance instance);

  void updateReward(CommandInstance instance);
}

class FlyTowardsTargetCommand implements Command {


  Vector2 target;

  FlyTowardsTargetCommand(this.target);


  start(CommandInstance instance){
    instance.state = CommandInstanceState.RUNNING;
    instance.score = _distanceToTarget(instance);
  }

  step(CommandInstance instance, double dt){
    if(instance.state == CommandInstanceState.ENDED) return;

    final double CORR = 1.0 / 1000.0;

    instance.network.inputNetwork =
    [
      CORR * instance.client.movable.position.x,
      CORR * instance.client.movable.position.y,
      CORR * target.x,
      CORR * target.y];
    instance.network.calculateOutput();
    List<double> output = instance.network.outputNetwork;/*
    Vector2 acceleration = new Vector2(output[0], output[1]);
    double length = acceleration.length;
    acceleration.scale(2.0).sub(new Vector2(1.0,1.0)).normalize();
    if(length < 1.0){
      acceleration.scale(length);
    }
    acceleration.scale(200.0);
    instance.client.movable.acceleration = acceleration;*/

    MovementInput mi = new MovementInput();
    mi.accelerationFactor = output[0];
    mi.newOrientation = output[1] * 2 * Math.PI * 2;
    instance.client.server.computePlayerInput(instance.client, mi);
  }

  end(CommandInstance instance){
    if(instance.state == CommandInstanceState.ENDED) return;
    instance.state = CommandInstanceState.ENDED;
  }

  void updateReward(CommandInstance instance){
    double distance = _distanceToTarget(instance);
    if(distance < instance.score) {
      instance.score = distance;
    }
  }

  double _distanceToTarget(CommandInstance instance){
    return instance.client.movable.position.distanceTo(this.target);
  }
}