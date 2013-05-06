library chatclient;

import 'dart:html';
import 'dart:json' as JSON;
import 'dart:async';

import '../../html/god_html.dart';
import '../../logging/logger_client.dart';

part 'src/chat_connection.dart';

ChatConnection chatConnection;


startupChat() {
  TextAreaElement chatElem = query('#chat-display');
  InputElement usernameElem = query('#chat-username');
  InputElement messageElem = query('#chat-message');
  chatWindow = new ChatWindow(chatElem);
  usernameInput = new UsernameInput(usernameElem);
  messageInput = new MessageInput(messageElem);
  chatConnection = new ChatConnection("ws://127.0.0.1:1337/ws");
}
