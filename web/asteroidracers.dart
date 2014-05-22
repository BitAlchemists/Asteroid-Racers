library asteroidracers;

import 'dart:html';

import '../lib/web_client/web_client.dart';


/**
 * The entry point to the application.
 */
void main() {  
  CanvasElement canvas = querySelector('#gamecanvas');
  canvas.width = canvas.clientWidth;
  
  GameConfig config = new GameConfig();
  config.localServer = true;
  config.debugJson = true;
  
  GameController gameController = new GameController(config);
  gameController.setup(canvas);
  gameController.start();

}


double fpsAverage;

/**
 * Display the animation's FPS in a div.
 */
void showFps(num fps) {
  
  if (fpsAverage == null) {
    fpsAverage = fps;
  }

  fpsAverage = fps * 0.05 + fpsAverage * 0.95;

  querySelector("#notes").text = "${fpsAverage.round().toInt()} fps";
}