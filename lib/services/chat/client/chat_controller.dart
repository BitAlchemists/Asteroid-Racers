part of chat_client;

class ChatController {
  MessageInput _messageInput;
  UsernameInput _usernameInput;
  ChatWindow _chatWindow;
  final StreamController _sendChatMessageStreamController = new StreamController();
  
  Stream get onSendChatMesage => _sendChatMessageStreamController.stream;
  String get messageType => MessageType.CHAT; 
  
  String username;

  ChatController() {
    
    TextAreaElement chatElem = querySelector('#chat-display');
    InputElement messageElem = querySelector('#chat-message');
    
    _chatWindow = new ChatWindow(chatElem);
    _messageInput = new MessageInput(messageElem);
    
    messageElem.onChange.listen((e) {
      Message chatMessage = new Message(MessageType.CHAT);
      chatMessage.payload = {'from': username, 'message': _messageInput.message};
      
      _sendChatMessageStreamController.add(chatMessage);
      
      _chatWindow.displayMessage(_messageInput.message, username);
      
      e.target.value = '';
    });

    MessageDispatcher.instance.registerHandler(MessageType.CHAT, (Message chatMessage){
      Map message = chatMessage.payload;
      _chatWindow.displayMessage(message['message'], message['from']);
    }); 
  }
  
  onReceiveMessage(Message message) {
    Map chatMessage = message.payload;
    _chatWindow.displayMessage(chatMessage['message'], chatMessage['from']);
  }
  
  onReceiveLogMessage(String message) {
    _chatWindow.displayMessage(message, "system");
  }
}