part of ai;



abstract class VehicleController {
  NeuralNetwork network;
  AIGameClient client;
  Movable movable;

  step(double dt);
}

