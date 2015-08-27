part of ai;


enum CommandState
{
  READY,
  RUNNING,
  ENDED
}


abstract class VehicleController {

  CommandState state = CommandState.READY;
  Network network;
  AIClientProxy client;

  start();
  step(double dt);
  end();
}

