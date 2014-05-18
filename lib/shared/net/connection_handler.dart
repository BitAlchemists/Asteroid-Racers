part of ar_shared;

class ConnectionHandler {
  final Connection _connection;
  
  final StreamController<Message> _messageStreamController = new StreamController<Message>.broadcast();
  Stream<Message> get onMessage => _messageStreamController.stream;
  
  ConnectionHandler(this._connection){
    _connection.onReceiveMessageDelegate = onReceiveMessage;
  }
  
  Future connect(){
    return _connection.open();
  }
  
  void send(Message message) {
    _connection.send(message);
  }
  
  void onReceiveMessage(Message message) {
    _messageStreamController.add(message);
  }
}