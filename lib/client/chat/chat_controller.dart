part of ar_client;


class ChatController {
  
  MessageInput _messageInput;
  UsernameInput _usernameInput;
  ChatWindow _chatWindow;
  
  ChatController() {
    TextAreaElement chatElem = query('#chat-display');
    InputElement usernameElem = query('#chat-username');
    InputElement messageElem = query('#chat-message');
    _chatWindow = new ChatWindow(chatElem);
    _usernameInput = new UsernameInput(usernameElem);
    _messageInput = new MessageInput(messageElem);
    
    messageElem.onChange.listen((e) {
      chatConnection.send(usernameInput.username, message);
      _chatWindow.displayMessage(message, usernameInput.username);
      e.target.value = '';
    });

    usernameElem.onChange.listen((e) {
      if (!e.target.value.isEmpty) {
        _messageInput.enable();
      } else {
        _messageInput.disable();
      }
    });


    
    
    ClientLogger.instance.stdout.listen((String message) {
      _chatWindow.displayNotice(message);
    });

  }
}
