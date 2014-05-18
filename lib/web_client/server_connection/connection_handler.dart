part of web_client;

class ConnectionHandler {
  final Connection _connection;
  
  final StreamController<Message> _messageStreamController = new StreamController<Message>.broadcast();
  Stream<Message> get onMessage => _messageStreamController.stream;
  
  ConnectionHandler(this._connection){
    _connection.onReceiveMessageDelegate = receivedEncodedMessage;
  }
  
  receivedEncodedMessage(String encodedMessage) {
    log('received message $encodedMessage');

    Message message = new Message.fromJson(encodedMessage);
    
    _messageStreamController.add(message);
  }
  
  Future connect(){
    return _connection.open();
  }
  
  void send(Message message) {
    String json = message.toJson();
    _connection.sendEncodedMessage(json);
  }
}