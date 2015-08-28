part of ai;

class TargetVehicleController extends VehicleController {
  Entity target;
  Function didReachTargetCallback;

  TargetVehicleController(this.target);

  start(){
    state = CommandState.RUNNING;
  }

  step(double dt){
    if(state == CommandState.ENDED) return;

    if(client.movable.position.distanceTo(target.position) < target.radius && didReachTargetCallback != null)
    {
      bool continueCommandExecution = didReachTargetCallback(this);
      if(!continueCommandExecution) return;
    }

    _calcNextMove();
  }

  _calcNextMove(){
    //we use this correction factor to supply reasonable input to the neural network
    final double CORR = 1.0 / 1000.0;

    Vector2 myPos = client.movable.position;

    // my angle to the target
    double a1 = Math.atan2(target.position.y - myPos.y, target.position.x - myPos.x) / Math.PI;
    // the angle to the direction in which we currently move
    double myVelocityAngle = Math.atan2(client.movable.velocity.y, client.movable.velocity.x) / Math.PI;
    // my current orientation
    double myNormalizedOrientation = client.movable.orientation / Math.PI - 1;  //atan2(direction.y, direction.x);
    // Relative angle
    double rel_angle = a1 - myNormalizedOrientation;

    List inputNetwork = [
      myNormalizedOrientation,
      rel_angle,
      client.movable.position.distanceTo(target.position) * CORR,
      client.movable.velocity.length * CORR,
      myVelocityAngle
    ];
    network.inputNetwork = inputNetwork;
    network.calculateOutput();
    List<double> output = network.outputNetwork;

    MovementInput mi = new MovementInput();
    mi.accelerationFactor = (output[0] + 1) / 2;
    mi.rotationSpeed = output[1] * 5.0;
    client.server.computePlayerInput(client, mi);

  }

  end(){
    if(state == CommandState.ENDED) return;
    state = CommandState.ENDED;
  }
}

/*
//old code that just used acceleration

input

/*      CORR * instance.client.movable.position.x,
      CORR * instance.client.movable.position.y,
      CORR * instance.client.movable.velocity.x,
      CORR * instance.client.movable.velocity.y,
      CORR * target.x,
      CORR * target.y,
      */


output

/*
    Vector2 acceleration = new Vector2(output[0], output[1]);
    double length = acceleration.length;
    acceleration.scale(2.0).sub(new Vector2(1.0,1.0)).normalize();
    if(length < 1.0){
      acceleration.scale(length);
    }
    acceleration.scale(200.0);
    instance.client.movable.acceleration = acceleration;*/
*/