library chatclient;

import 'dart:html';
import 'dart:json' as JSON;
import 'dart:async';

part 'src/chat_connection.dart';
part 'src/view.dart';
part 'src/message_input_view.dart';
part 'src/username_input_view.dart';
part 'src/chat_window.dart';

ChatConnection chatConnection;
MessageInput messageInput;
UsernameInput usernameInput;
ChatWindow chatWindow;


startupChat() {
  TextAreaElement chatElem = query('#chat-display');
  InputElement usernameElem = query('#chat-username');
  InputElement messageElem = query('#chat-message');
  chatWindow = new ChatWindow(chatElem);
  usernameInput = new UsernameInput(usernameElem);
  messageInput = new MessageInput(messageElem);
  chatConnection = new ChatConnection("ws://127.0.0.1:1337/ws");
}
