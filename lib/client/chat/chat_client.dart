library chatclient;

import 'dart:html';
import 'dart:json' as JSON;
import 'dart:async';
import 'logger_client.dart';


part 'view.dart';
part 'message_input_view.dart';
part 'username_input_view.dart';
part 'chat_window.dart';

MessageInput _messageInput;
UsernameInput _usernameInput;
ChatWindow _chatWindow;


startupChat() {
  TextAreaElement chatElem = query('#chat-display');
  InputElement usernameElem = query('#chat-username');
  InputElement messageElem = query('#chat-message');
  _chatWindow = new ChatWindow(chatElem);
  _usernameInput = new UsernameInput(usernameElem);
  _messageInput = new MessageInput(messageElem);
}
