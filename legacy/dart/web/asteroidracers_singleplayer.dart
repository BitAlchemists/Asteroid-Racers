library asteroidracers;

import 'dart:html';

import "package:asteroidracers/services/net/local_server_connection.dart";
import "package:asteroidracers/game_client/game_client.dart";

/**
 * The entry point to the application.
 */
void main() {  
  var canvas = querySelector('#stage');

  GameConfig config = new GameConfig();
  config.localServer = true;
  config.debugCollisions = false;
  config.renderBackground = true;
  bool debugLocalServerNetEncoding = false;

  var connection = localConnection(debugLocalServerNetEncoding);
  GameClient gameClient = new GameClient(config, connection);
  gameClient.setup(canvas);
  gameClient.connect(connection);
  
  canvas.focus();
}

LocalServerConnection localConnection(bool debug)
{
  return new LocalServerConnection(debug:debug);
}