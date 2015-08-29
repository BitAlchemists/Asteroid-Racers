library asteroidracers;

import 'dart:html';

import "package:asteroidracers/game_client/game_client.dart";

/**
 * The entry point to the application.
 */
void main() {
  print("Hello Asteroid Racers");
  var canvas = querySelector('#stage');

  GameConfig config = new GameConfig();
  config.localServer = false;
  config.debugLocalServerNetEncoding = true;
  config.debugCollisions = false;
  config.renderBackground = true;

  GameClient gameClient = new GameClient(config);
  gameClient.setup(canvas);
  gameClient.connect();

  canvas.focus();

  querySelector("#container").remove();
}