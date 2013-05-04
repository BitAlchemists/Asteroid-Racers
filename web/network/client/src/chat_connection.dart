part of chatclient;

class ChatConnection {
  WebSocket webSocket;
  String url;

  ChatConnection(this.url) {
    _init();
  }

  send(String from, String message) {
    var encoded = JSON.stringify({'f': from, 'm': message});
    _sendEncodedMessage(encoded);
  }

  _receivedEncodedMessage(String encodedMessage) {
    Map message = JSON.parse(encodedMessage);
    if (message['f'] != null) {
      chatWindow.displayMessage(message['m'], message['f']);
    }
  }

  _sendEncodedMessage(String encodedMessage) {
    if (webSocket != null && webSocket.readyState == WebSocket.OPEN) {
      webSocket.send(encodedMessage);
    } else {
      print('WebSocket not connected, message $encodedMessage not sent');
    }
  }

  _init([int retrySeconds = 2]) {
    bool encounteredError = false;
    chatWindow.displayNotice("Connecting to Web socket");
    webSocket = new WebSocket(url);

    scheduleReconnect() {
      chatWindow.displayNotice('web socket closed, retrying in $retrySeconds seconds');
      if (!encounteredError) {
        new Timer(new Duration(seconds:retrySeconds),
            () => _init(retrySeconds*2));
      }
      encounteredError = true;
    }

    webSocket.onOpen.listen((e) {
      chatWindow.displayNotice('Connected');
    });

    webSocket.onClose.listen((e) => scheduleReconnect());
    webSocket.onError.listen((e) => scheduleReconnect());

    webSocket.onMessage.listen((MessageEvent e) {
      print('received message ${e.data}');
      _receivedEncodedMessage(e.data);
    });
  }
}
