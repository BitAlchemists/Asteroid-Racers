part of ar_server;

class ServerConnectionHandler {
  Set<WebSocket> webSockets = new Set<WebSocket>();

  ServerConnectionHandler(String basePath) {
    //String loggingPath = basePath.append('logs/connection-log.txt');
    //log.initLogging(loggingPath);
  }

  onConnection(WebSocket webSocket) {
    void onMessage(message) {
      print('new ws msg: $message');
      webSockets.forEach((WebSocket aWebSocket) {
        if (webSocket != aWebSocket) {
          print('queued msg to be sent');
          queue(() => aWebSocket.add(message));
        }
      });
      //time('send to isolate', () => log.log(message));
    }
    
    print('new ws conn');
    webSockets.add(webSocket);
    webSocket.listen(onMessage,
      onDone: () => webSockets.remove(webSocket),
      onError: (e) => webSockets.remove(webSocket)
    );
  }
}

/*
      webSocketConnections.forEach((connection) {
        if (conn != connection) {
          print('queued msg to be sent');
          queue(() => connection.send(message));
        }
      });

*/