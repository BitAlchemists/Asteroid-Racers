part of ai;

//List minInputNetwork = [double.INFINITY, double.INFINITY, double.INFINITY, double.INFINITY, double.INFINITY];
//List maxInputNetwork = [double.NEGATIVE_INFINITY, double.NEGATIVE_INFINITY, double.NEGATIVE_INFINITY, double.NEGATIVE_INFINITY, double.NEGATIVE_INFINITY];

class TargetVehicleController extends VehicleController {
  Entity target;

  TargetVehicleController();


  step(double dt){
    _calcNextMove();
  }

  _calcNextMove(){

    assert(network != null);

    if(target == null){
      //we don't have a target, we don't need to move
      return;
    }

    //we use this correction factor to supply reasonable input to the neural network
    final double CORR = 1.0 / 1000.0;

    Vector2 myPos = movable.position;
    // my current orientation
    double southAngle = movable.orientation / Math.PI;  //atan2(direction.y, direction.x);


    // my angle to the target
    // atan2 puts out the angle to the target on the x axis;
    double targetToSouthAngle = Math.atan2(target.position.y - myPos.y, target.position.x - myPos.x) / Math.PI;
    //we have to transform this to be oriented along the y axis
    targetToSouthAngle -= 0.5;
    //make sure it fits our boundaries -1..+1
    if(targetToSouthAngle < -1.0){
      targetToSouthAngle += 2.0;
    }
    // Relative angle
    double targetAngle = targetToSouthAngle - southAngle;
    //make sure it fits our boundaries -1..+1
    if(targetAngle > 1.0){
      targetAngle -= 2.0;
    }
    if(targetAngle < -1.0){
      targetAngle += 2.0;
    }


    // the angle to the direction in which we currently move
    double velocityToSouthAngle = Math.atan2(movable.velocity.y, movable.velocity.x) / Math.PI;
    //we have to transform this to be oriented along the y axis
    velocityToSouthAngle -= 0.5;
    //make sure it fits our boundaries -1..+1
    if(velocityToSouthAngle < -1.0){
      velocityToSouthAngle += 2.0;
    }
    // Relative angle
    double velocityAngle = velocityToSouthAngle - southAngle;
    //make sure it fits our boundaries -1..+1
    if(velocityAngle > 1.0){
      velocityAngle -= 2.0;
    }
    if(velocityAngle < -1.0){
      velocityAngle += 2.0;
    }



    //minInputNetwork: [-0.9999911852053975, -1.9972613015197478, 0.00023830192972466562, 0.0, -0.9999992133028137]
    //maxInputNetwork: [0.9999958905801077, 1.9995088206681455, 16.047014841265174, 3.2066125582549314, 0.9999998861877442]

    var distanceToTarget = movable.position.distanceTo(target.position);
    var velocity = movable.velocity.length;

    List input = [
      targetAngle,
      distanceToTarget * CORR,
      velocityAngle,
      velocity * CORR
    ];

    /*
    //check extreme values
    for(int i = 0; i < 5; i++) {
      if(minInputNetwork[i] > inputNetwork[i]){
        minInputNetwork[i] = inputNetwork[i];
      }
      if(maxInputNetwork[i] < inputNetwork[i]){
        maxInputNetwork[i] = inputNetwork[i];
      }
    }
    */

    network.inputNetwork = input;
    network.calculateOutput();
    List<double> output = network.outputNetwork;

    MovementInput mi = new MovementInput();
    mi.accelerationFactor = (output[0] + 1) / 2; // we are working with TanH, so we are normalizing this output to be 0..1
    mi.rotationSpeed = output[1] * 5.0; //5 degrees left or right per second
    mi.newOrientation = double.NAN;

    client.server.movePlayer(mi);

/*

    double sampleLogChance = 0.00001;
    if(random.nextDouble() < sampleLogChance){
      String sampleLog = "";
      sampleLog += "\nmyPos x: ${myPos.x} y: ${myPos.y}";
      sampleLog += "\nvelocity x:${client.movable.velocity.x} y:${client.movable.velocity.y}";
      sampleLog += "\nvelocity: ${client.movable.velocity.length} velocityToSouth:${myVelocityAngle*180}";
      sampleLog += "\ntarget x:${target.position.x} y:${target.position.y}";
      sampleLog += "\nshipToTarget x:${target.position.x-client.movable.position.x} y:${target.position.y-client.movable.position.y}";
      sampleLog += "\ntargetDistance: ${client.movable.position.distanceTo(target.position)}";
      sampleLog += "\nsouthAngle: ${myNormalizedOrientation*180} targetToSouth: ${shipToTargetAngle*180} targetAngle: ${rel_angle*180}";
      sampleLog += "\noutput - acceleration: ${mi.accelerationFactor} rotation: ${mi.rotationSpeed}";
      log.info(sampleLog);
    }

    myPos x: -174.37066650390625 y: -183.36419677734375
velocity x:-243.9571990966797 y:-276.0008850097656
velocity: 368.3634122945313 velocityToSouth:-131.47346776303257
target x:424.2640686035156 y:424.2640686035156
shipToTarget x:598.6347351074219 y:607.6282653808594
targetDistance: 852.9804971928361
southAngle: 139.91699855718628 targetToSouth: -44.57282799870455 targetAngle: -184.4898265558908
output - acceleration: 0.6989224313018303 rotation: -0.20497752915450804
*/

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



            southAngle,
      targetAngle,
      client.movable.position.distanceTo(target.position) * CORR,
      client.movable.velocity.length * CORR,
      velocityToSouthAngle

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