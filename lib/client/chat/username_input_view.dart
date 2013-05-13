part of ar_client;

class UsernameInput extends View<InputElement> {
  UsernameInput(InputElement elem) : super(elem);

  String get username => elem.value;
}
