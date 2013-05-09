part of ar_client;

class ClientConnectionHandler {
  WebSocket webSocket;
  String url;

  ClientConnectionHandler(this.url) {
    _init();
  }
  
  _init([int retrySeconds = 2]) {
    bool encounteredError = false;
    print("Connecting to Web socket");
    webSocket = new WebSocket(url);

    scheduleReconnect() {
      print('web socket closed, retrying in $retrySeconds seconds');
      if (!encounteredError) {
        new Timer(new Duration(seconds:retrySeconds),
            () => _init(retrySeconds*2));
      }
      encounteredError = true;
    }

    webSocket.onOpen.listen((e) {
      print('Connected');
    });

    webSocket.onClose.listen((e) => scheduleReconnect());
    webSocket.onError.listen((e) => scheduleReconnect());

    webSocket.onMessage.listen((MessageEvent e) {
      print('received message ${e.data}');
      _receivedEncodedMessage(e.data);
    });
  }

  send(Message message) {
    String json = message.toJson();
    _sendEncodedMessage(encoded);
  }

  _receivedEncodedMessage(String encodedMessage) {
    Message message = Message.fromJson(encodedMessage);
    MessageDispatcher.instance().dispatch(message);
  }

  _sendEncodedMessage(String encodedMessage) {
    if (webSocket != null && webSocket.readyState == WebSocket.OPEN) {
      webSocket.send(encodedMessage);
    } else {
      print('WebSocket not connected, message $encodedMessage not sent');
    }
  }
}

/*
if (message['f'] != null) {
chatWindow.displayMessage(message['m'], message['f']);
}
*/