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
  String get messageType => MessageType.CHAT; 
  
  String username;
  stagexl.TextField _chatOutput;

  ChatController(stagexl.TextField chatInput, stagexl.TextField chatOutput) {
            
    _chatOutput = chatOutput;
    
    chatInput.onKeyDown.listen((stagexl.KeyboardEvent e) {
      if(e.keyCode == html.KeyCode.ENTER){
        Message chatMessage = new Message(MessageType.CHAT);
        chatMessage.payload = {'text': chatInput.text};
   
        _sendChatMessageStreamController.add(chatMessage);
                
        chatInput.text = '';        
      }
    });
  }
  
  onReceiveMessage(Message message) {
    Map chatMessage = message.payload;
    displayMessage(chatMessage['text'], chatMessage['from']);
  }
  
  onReceiveLogMessage(String message) {
    displayMessage(message, "system");
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