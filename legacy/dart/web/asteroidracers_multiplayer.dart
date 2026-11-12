library asteroidracers;

import 'dart:html';

import "package:asteroidracers/game_client/game_client.dart";
import "package:asteroidracers/services/net/web_socket_server_connection.dart";

/**
 * The entry point to the application.
 */
void main() {
  print("Hello Asteroid Racers");
  var canvas = querySelector('#stage');

  GameConfig config = new GameConfig();
  config.localServer = false;
  config.debugCollisions = false;
  config.renderBackground = true;

  var connection = webConnection();
  GameClient gameClient = new GameClient(config, connection);
  gameClient.setup(canvas);
  gameClient.connect(connection);

  canvas.focus();

  querySelector("#container").remove();

}

WebSocketServerConnection webConnection()
{
  //ServerConnection server;
  //var domain = html.document.domain;
  Location location = window.location;
  var port = 1337;
  var wsPath = "ws://" + location.hostname + ":" + port.toString() + "/ws";
  return new WebSocketServerConnection(wsPath);
}

