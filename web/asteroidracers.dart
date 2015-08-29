library asteroidracers;

import 'dart:html';

import "package:asteroidracers/game_client/game_client.dart";

/**
 * The entry point to the application.
 */
void main() {
  print("hello from AR");
  var canvas = querySelector('#stage');

  GameConfig config = new GameConfig();
  config.localServer = false;
  config.debugLocalServerNetEncoding = true;
  config.debugCollisions = false;
  config.renderBackground = true;
  print(1);
  GameClient gameClient = new GameClient(config);
  print(2);
  gameClient.setup(canvas);
  print(3);
  gameClient.connect();
  print("woop?");
  canvas.focus();
}