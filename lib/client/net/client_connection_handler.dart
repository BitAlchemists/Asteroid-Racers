part of ar_client;

class ClientConnectionHandler {
  WebSocket webSocket;
  String url;

  ClientConnectionHandler(this.url) {
    _init();
  }
  
  _init([int retrySeconds = 2]) {
    bool encounteredError = false;
    log("Connecting to Web socket");
    webSocket = new WebSocket(url);

    scheduleReconnect() {
      log('web socket closed, retrying in $retrySeconds seconds');
      if (!encounteredError) {
        new Timer(new Duration(seconds:retrySeconds),
            () => _init(retrySeconds*2));
      }
      encounteredError = true;
    }

    webSocket.onOpen.listen((e) {
      log('Connected');
    });

    webSocket.onClose.listen((e) => scheduleReconnect());
    webSocket.onError.listen((e) => scheduleReconnect());

    webSocket.onMessage.listen((MessageEvent e) {
      log('received message ${e.data}');
      _receivedEncodedMessage(e.data);
    });
  }

  send(Message message) {
    String json = message.toJson();
    _sendEncodedMessage(json);
  }

  _receivedEncodedMessage(String encodedMessage) {
    Message message = new Message.fromJson(encodedMessage);
    MessageDispatcher.instance.dispatch(message);
  }

  _sendEncodedMessage(String encodedMessage) {
    if (webSocket != null && webSocket.readyState == WebSocket.OPEN) {
      webSocket.send(encodedMessage);
    } else {
      log('WebSocket not connected, message $encodedMessage not sent');
    }
  }
}

