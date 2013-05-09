part of chatclient;

class UsernameInput extends View<InputElement> {
  UsernameInput(InputElement elem) : super(elem);

  bind() {
    elem.onChange.listen((e) => _onUsernameChange());
  }

  _onUsernameChange() {
    if (!elem.value.isEmpty) {
      _messageInput.enable();
    } else {
      _messageInput.disable();
    }
  }

  String get username => elem.value;
}
