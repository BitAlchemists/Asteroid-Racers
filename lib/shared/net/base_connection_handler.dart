part of ar_shared;

abstract class BaseConnectionHandler {
  send(Message message);
  
  receivedEncodedMessage(String encodedMessage) {
    Message message = new Message.fromJson(encodedMessage);
    MessageDispatcher.instance.dispatch(message);
  }

}