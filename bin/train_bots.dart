import "dart:async";
import "package:logging/logging.dart" as logging;
import "package:asteroidracers/shared/logging.dart";
import "package:asteroidracers/game_server/game_server.dart";
import "package:asteroidracers/game_server/client_proxy.dart";
import "package:asteroidracers/services/ai/ai.dart" as ai;
import 'package:game_loop/game_loop_common.dart';

main() async {
  logging.Logger log = new logging.Logger("");
  log.level = logging.Level.INFO;
  logging.hierarchicalLoggingEnabled = true;
  registerLogging(log);

  logging.Logger tmp;
  tmp = new logging.Logger("BaseClient.Net.ServerProxy");
  tmp.level = logging.Level.INFO;
  tmp = new logging.Logger("ai.RaceTargetTrainingScript");
  tmp.level = logging.Level.INFO;

  log.info("Hi :) Starting at ${new DateTime.now()}");

  GameServer gameServer = new GameServer();
  ClientProxy.gameServer = gameServer;
  ai.registerAITrainingService(gameServer);

  var loop = new NoGameLoop();
  //loop.updateTimeStep = 0.0001;
  //loop.fakeTimeStep = 0.015;

  gameServer.start(loop);

  double counter = 0.0;
  int frameCounter = 0;
  double secondsPassed = 0.0;
  const double SECONDS_PER_UPDATE = 60.0;

  const int FRAMES_PER_CYCLE = 100;

  Future.doWhile((){
    //for(int i = 0; i < FRAMES_PER_CYCLE; i++){
      loop.onUpdate(loop);
      frameCounter += 1;
    //}
    //frameCounter += FRAMES_PER_CYCLE;

    counter += loop.dt;

    if(counter >= SECONDS_PER_UPDATE){
      secondsPassed += SECONDS_PER_UPDATE;
      counter -= SECONDS_PER_UPDATE;
      log.info("$secondsPassed simulated seconds. $frameCounter frames.");
    }

    return true;
  });

}

class NoGameLoop extends GameLoop {
  double _frameTime = 0.0;
  double get frameTime => _frameTime;
  double _accumulatedTime = 0.0;
  double get accumulatedTime => _accumulatedTime;
  int _frameCounter = 0;
  int get frame => _frameCounter;
  double _gameTime = 0.0;
  double get gameTime => _gameTime;

  double get dt => 0.015;

  void start(){}
  void stop(){}
}

class AIGameLoop extends GameLoop {
  double fakeTimeStep;
  double get dt => fakeTimeStep;

  int _frameCounter = 0;
  double _previousFrameTime;
  double _frameTime = 0.0;
  double get frameTime => _frameTime;
  double _nextResize = 0.0;

  double _accumulatedTime = 0.0;
  /** Seconds of accumulated time. */
  double get accumulatedTime => _accumulatedTime;

  /** Frame counter value. Incremented once per frame. */
  int get frame => _frameCounter;

  double _gameTime = 0.0;
  double get gameTime => _gameTime;

  /** Current time. */
  double get time => GameLoop.timeStampToSeconds(_watch.elapsedMicroseconds / 1000.0);
  Stopwatch _watch;
  Duration _duration;

  /** Construct a new game loop */
  AIGameLoop() : super() {
    _watch = new Stopwatch();
    _duration = new Duration(milliseconds: (updateTimeStep*1000.0).toInt());
  }

  void _processInputEvents() {
  }

  double _timeLost = 0.0;
  void _update() {
    if (_previousFrameTime == null) {
      _frameTime = time;
      _previousFrameTime = _frameTime;
      _processInputEvents();
      new Timer(_duration, _update);
      return;
    }

    _frameCounter++;
    _previousFrameTime = _frameTime;
    _frameTime = time;
    double timeDelta = _frameTime - _previousFrameTime;
    _accumulatedTime += timeDelta;
    if (_accumulatedTime > maxAccumulatedTime) {
      // If the animation frame callback was paused we may end up with
      // a huge time delta. Clamp it to something reasonable.
      _timeLost += _accumulatedTime-maxAccumulatedTime;
      _accumulatedTime = maxAccumulatedTime;
    }

    while (_accumulatedTime >= updateTimeStep) {
      _gameTime += updateTimeStep;
      processTimers();
      if (onUpdate != null) {
        onUpdate(this);
      }
      _accumulatedTime -= updateTimeStep;
    }
    new Timer(_duration, _update);
  }

  /** Start the game loop. */
  void start() {
    _watch.start();
    Timer.run(_update);

  }
  /** Stop the game loop. */
  void stop() {
    _watch.stop();
  }
}