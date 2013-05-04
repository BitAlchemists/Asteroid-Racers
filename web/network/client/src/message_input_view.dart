part of chatclient;

class MessageInput extends View<InputElement> {
  MessageInput(InputElement elem) : super(elem);

  bind() {
    elem.onChange.listen((e) {
      chatConnection.send(usernameInput.username, message);
      chatWindow.displayMessage(message, usernameInput.username);
      elem.value = '';
    });
  }

  disable() {
    elem.disabled = true;
    elem.value = 'Enter username';
  }

  enable() {
    elem.disabled = false;
    elem.value = '';
  }

  String get message => elem.value;

}
