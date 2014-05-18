part of tcp_server;

class WebSocketConnectionHandler {
  Set<WebSocket> webSockets = new Set<WebSocket>();

  WebSocketConnectionHandler(String basePath) {
    //String loggingPath = basePath.append('logs/connection-log.txt');
    //log.initLogging(loggingPath);
  }

  onConnection(WebSocket webSocket) {
    print('new ws conn');
    webSockets.add(webSocket);
    webSocket.listen((var message){
      //if(message.messageType == "CHAT") {
        queue(() => webSocket.add(message));
      //}
    },
      onDone: () => webSockets.remove(webSocket),
      onError: (e) => webSockets.remove(webSocket)
    );
  }
  
  void onMessage(Message message) {
    print('new ws msg: $message');
  }
}

//Echo

/*
          webSockets.forEach((WebSocket aWebSocket) {
          if (webSocket != aWebSocket) {
            print('queued msg to be sent');
            queue(() => aWebSocket.add(message));
          }
        });
 
   

*/