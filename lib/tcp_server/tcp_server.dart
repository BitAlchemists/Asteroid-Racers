library tcp_server;

import 'dart:io';
//import 'dart:isolate';
import 'dart:async';
import "dart:typed_data";

import 'package:path/path.dart' as path;
import "package:logging/logging.dart" as logging;

import "package:asteroidracers/shared/net.dart";
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/game_server/game_server.dart";
import "package:asteroidracers/game_server/client_proxy.dart";

//import '../core/shared/ar_shared.dart';

//import '../_needs_refactoring/file-logger.dart' as log;
//import 'utils/server-utils.dart';

import 'package:mime_type/mime_type.dart';

import "package:asteroidracers/services/chat/chat_shared.dart";
import "package:asteroidracers/services/chat/chat_server.dart";

import "package:asteroidracers/services/ai/ai.dart" as ai;


part 'utils/static_file_handler.dart';
part "utils/server-utils.dart";

part 'net/web_socket_client_connection.dart';
part "net/web_socket_client_connection_manager.dart";


logging.Logger log = new logging.Logger("TCPServer");

Future runServer(List filePaths, String logPath, int port) {
  GameServer gameServer = new GameServer();
  ClientProxy.gameServer = gameServer;

  WebSocketClientConnectionManager connectionManager = new WebSocketClientConnectionManager(gameServer);
  StaticFileHandler fileHandler = new StaticFileHandler(filePaths);

  //todo: refactor this to be generic for all types of clients (low prio until we make an admin client)
  ChatServer _chat;
  _chat = new ChatServer(gameServer);

  ClientProxy.registerMessageHandler(MessageType.CHAT, _chat.onChatMessage);

  gameServer.prepareDemoConfiguration();

  ai.registerAIDemoService(gameServer);
  //ai.registerAIRacingService(gameServer);

  gameServer.start();

  //Completer completer = new Completer();
  //return completer.future;

  return HttpServer.bind('0.0.0.0', port).then((HttpServer server) {
    log.info('listening for connections on http://localhost:$port');
        
    
    
    //begin to listen for connections
    server.listen((HttpRequest request) {
      try {
        if (request.uri.path == '/ws') {
          //requests to /ws are routed to the connectionHandler
          connectionManager.onConnectionRequest(request);
          
        } else {
          //other requests are treated as file requests
          fileHandler.onRequest(request);
        }        
      }
      catch(e) {
        log.warning("catching error " + e.toString());
        request.response.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        request.response.write("500 - Internal Server Error");
      }
    });
  },
  onError: (error) => log.severe("Error starting HTTP server: $error"));
}
