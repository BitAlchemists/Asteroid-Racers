part of web_client;

class WebSocketConnection implements Connection {
  html.WebSocket _webSocket;
  String _url;
  int _retrySeconds = 2;
  bool _encounteredError = false;
  Completer _onConnectCompleter = new Completer();
  
  Function onReceiveMessageDelegate;
  
  WebSocketConnection(this._url);
  
  Future open(){
    log("Connecting to Web socket");
    _webSocket = new html.WebSocket(_url);

    _webSocket.onOpen.listen((e) {
      log('Connected');
      _onConnectCompleter.complete();
    });

    _webSocket.onClose.listen((e) => scheduleReconnect());
    _webSocket.onError.listen((e) => scheduleReconnect());

    _webSocket.onMessage.listen((html.MessageEvent e) {
      Message message = new Message.fromJson(e.data);
      onReceiveMessageDelegate(message);
    });  
    
    return _onConnectCompleter.future;
  }

  scheduleReconnect() {
    log('web socket closed, retrying in $_retrySeconds seconds');
    if (!_encounteredError) {
      _retrySeconds *= 2;
      new Timer(new Duration(seconds:_retrySeconds),open);
    }
    _encounteredError = true;
  }

  void send(Message message) {
    String encodedMessage = message.toJson();
    
    if (_webSocket != null && _webSocket.readyState == html.WebSocket.OPEN) {
      _webSocket.send(encodedMessage);
    } else {
      log('WebSocket not connected, message $encodedMessage not sent');
    }
  }
}

