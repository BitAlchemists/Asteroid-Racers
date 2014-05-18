part of web_client;

abstract class Connection {
  Function onReceiveMessageDelegate;
  
  Future open();
  void sendEncodedMessage(String encodedMessage);
}