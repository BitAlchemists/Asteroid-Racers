library tcp_server;

import 'dart:io';
//import 'dart:isolate';
import 'dart:async';
import 'package:path/path.dart' as path;
import "../shared/ar_shared.dart";
import "../world_server/world_server.dart";

//import '../core/shared/ar_shared.dart';

//import '../_needs_refactoring/file-logger.dart' as log;
//import 'utils/server-utils.dart';

part 'utils/static_file_handler.dart';
part "utils/server-utils.dart";

part 'net/web_socket_client_connection.dart';
part "net/web_socket_client_connection_manager.dart";

Future runServer(String webPath, String logPath, int port) {
  WorldServer worldServer = new WorldServer();
  WebSocketClientConnectionManager connectionManager = new WebSocketClientConnectionManager(worldServer);
  StaticFileHandler fileHandler = new StaticFileHandler(webPath);
  
  return HttpServer.bind('0.0.0.0', port).then((HttpServer server) {
    print('listening for connections on $port');
        
    ClientProxy.worldServer = new WorldServer();
    
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
        print("catching error " + e.toString());
        request.response.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        request.response.write("500 - Internal Server Error");
      }
    });
  },
  onError: (error) => print("Error starting HTTP server: $error"));
}
