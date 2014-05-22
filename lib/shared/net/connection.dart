part of ar_shared;

abstract class Connection {
  Stream<Message> get onReceiveMessage;
  Function onDisconnectDelegate;
  
  void send(Message message);
  void disconnect();
}