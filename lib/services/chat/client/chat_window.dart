part of chat_client;

class ChatWindow extends Window {
  stagexl.TextField _chatInput;
  stagexl.TextField get chatInput => _chatInput;
  
  stagexl.TextField _chatOutput;
  stagexl.TextField get chatOutput => _chatOutput;
  
  ChatWindow() : super(250){
    var chatInput = UIHelper.createInputField();
    chatInput.onMouseClick.listen((_) => this.stage.focus = chatInput);
    this.pushView(chatInput);
    var chatOutput = UIHelper.createTextField(numLines:5);
    this.pushView(chatOutput);
  }
}