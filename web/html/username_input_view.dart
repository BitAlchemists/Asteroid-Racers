part of god_html;

class UsernameInput extends View<InputElement> {
  UsernameInput(InputElement elem) : super(elem);

  bind() {
    elem.onChange.listen((e) => _onUsernameChange());
  }

  _onUsernameChange() {
    if (!elem.value.isEmpty) {
      messageInput.enable();
    } else {
      messageInput.disable();
    }
  }

  String get username => elem.value;
}
