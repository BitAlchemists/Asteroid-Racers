part of ar_shared;

abstract class Connection {
  Function onReceiveMessageDelegate;
  
  Future open();
  void send(Message message);
}