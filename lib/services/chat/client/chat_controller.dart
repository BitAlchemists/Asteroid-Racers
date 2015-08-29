part of chat_client;

/*
 * 
  * 
  *   displayMessage(String msg, String from) {
    _display("$from: $msg\n");
  }

  displayNotice(String notice) {
    _display("[system]: $notice\n");
  }

  _display(String str) {
    elem.text = "${elem.text}$str";
  }
 */

class ChatController {

  final StreamController _sendChatMessageStreamController = new StreamController();
  
  Stream get onSendChatMesage => _sendChatMessageStreamController.stream;
  MessageType get messageType => MessageType.CHAT;
  
  String username;
  stagexl.TextField _chatOutput;

  ChatController(stagexl.TextField chatInput, stagexl.TextField chatOutput) {
            
    _chatOutput = chatOutput;
    
    chatInput.onKeyDown.listen((stagexl.KeyboardEvent e) {
      if(e.keyCode == html.KeyCode.ENTER){
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.text = chatInput.text;

        Envelope envelope = new Envelope();
        envelope.messageType = MessageType.CHAT;
        envelope.payload = chatMessage.writeToBuffer();
   
        _sendChatMessageStreamController.add(envelope);
                
        chatInput.text = '';        
      }
    });
  }
  
  onReceiveMessage(Envelope envelope) {
    ChatMessage chatMessage = new ChatMessage.fromBuffer(envelope.payload);
    displayMessage(chatMessage.text, chatMessage.from);
  }
  
  displayMessage(String msg, String from) {
   _display("$from: $msg\n");
 }

 displayNotice(String notice) {
   _display("[system]: $notice\n");
 }

 _display(String str) {
   _chatOutput.text = "$str${_chatOutput.text}";
 }
}