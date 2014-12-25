library asteroidracers;

import 'dart:html';

import "package:asteroidracers/game_client/game_client.dart";

/**
 * The entry point to the application.
 */
void main() {  
  var canvas = querySelector('#stage');
  
  GameConfig config = new GameConfig();
  config.localServer = true;
  config.debugJson = true;
  config.debugCollisions = false;
  config.renderBackground = true;
  
  GameClient gameClient = new GameClient(config);
  gameClient.setup(canvas);
  gameClient.connect();
  
  canvas.focus();
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