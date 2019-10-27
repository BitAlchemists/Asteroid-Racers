part of ai;

enum ScriptState {
  READY,
  RUNNING,
  ENDED
}

abstract class Script {
  ScriptState state = ScriptState.READY;
  AIDirector director;

  Script();

  Future run();
  void step(double dt);
}

abstract class NetworkTrainingScript extends Script {
  NeuralNetwork network;
  Evaluator evaluator;
  AIGameClient client;
}