part of ar_shared;

typedef MessageHandler(Message message);

class MessageDispatcher {
  static final MessageDispatcher _instance = new MessageDispatcher._internal();
  
  Map<String, MessageHandler> messageHandlers;
  
  factory MessageDispatcher.instance() {
    return _instance;
  }
  
  MessageDispatcher._internal() {
    messageHandlers = new Map<String, MessageHandler>();
  }
  
  registerHandler(String messageType, MessageHandler messageHandler) {
    messageHandlers[messageType] = messageHandler;
  }
  
  dispatch(Message message) {
    MessageHandler messageHandler = messageHandlers[message.messageType];
    if(messageHandler != null) {
      messageHandler(message);
    }
    else {
      print('could not dispatch message of type "${message.messageType}". No MessageHandler is registered.');
    }
  }
}