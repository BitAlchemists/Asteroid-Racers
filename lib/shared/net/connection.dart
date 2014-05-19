part of ar_shared;

abstract class Connection {
  Stream<Message> get onReceiveMessage;
  
  void send(Message message);
}