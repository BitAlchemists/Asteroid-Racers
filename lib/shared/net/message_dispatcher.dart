part of ar_shared;

class MessageDispatcher {
  static final MessageDispatcher _instance;
  typedef MessageHandler(Message message);
  
  Map<String, MessageHandler> messageHandlers;
  
  factory MessageDispatcher.instance() {
    if(_instance == null) {
      _instance = new MessageDispatcher._internal();
    }
    
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