part of ai;

enum ScriptState {
  READY,
  RUNNING,
  ENDED
}

abstract class Script {
  ScriptState state = ScriptState.READY;
  AIDirector director;
  AIGameClient client;
  Network network;
  Evaluator evaluator;

  Script();

  Future run();
  void step(double dt);
}

