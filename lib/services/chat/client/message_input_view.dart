part of chat_client;

class MessageInput extends View<InputElement> {
  MessageInput(InputElement elem) : super(elem);

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
