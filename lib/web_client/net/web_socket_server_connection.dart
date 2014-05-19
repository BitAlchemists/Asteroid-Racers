part of web_client;

class WebSocketServerConnection implements ServerConnection {
  //Private Fields
  html.WebSocket _webSocket;
  String _url;
  int _retrySeconds = 2;
  bool _encounteredError = false;
  Completer _onConnectCompleter = new Completer();
  final StreamController<Message> _receiveMessageStreamController = new StreamController<Message>.broadcast();
  
  //Public properties
  Stream<Message> get onReceiveMessage => _receiveMessageStreamController.stream;
  
  //ctor
  WebSocketServerConnection(this._url);
  
  //Connection Logic
  Future connect(){
    log("Connecting to Web socket");
    _webSocket = new html.WebSocket(_url);

    _webSocket.onOpen.listen((e) {
      log('Connected');
      _onConnectCompleter.complete();
    });

    _webSocket.onClose.listen((e) => _scheduleReconnect());
    _webSocket.onError.listen((e) => _scheduleReconnect());

    _webSocket.onMessage.listen(_onReceiveMessage);  
    
    return _onConnectCompleter.future;
  }

  _scheduleReconnect() {
    log('web socket closed, retrying in $_retrySeconds seconds');
    if (!_encounteredError) {
      _retrySeconds *= 2;
      new Timer(new Duration(seconds:_retrySeconds),connect);
    }
    _encounteredError = true;
  }

  // Message handling
  void send(Message message) {
    String encodedMessage = message.toJson();
    
    if (_webSocket != null && _webSocket.readyState == html.WebSocket.OPEN) {
      _webSocket.send(encodedMessage);
    } else {
      log('WebSocket not connected, message $encodedMessage not sent');
    }
  }
  
  _onReceiveMessage(html.MessageEvent e) {
    Message message = new Message.fromJson(e.data);
    _receiveMessageStreamController.add(message);
  }
}

