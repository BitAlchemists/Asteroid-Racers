///
//  Generated code. Do not modify.
///
library chat_message;

import 'package:fixnum/fixnum.dart';
import 'package:protobuf/protobuf.dart';

class ChatMessage extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('ChatMessage')
    ..a(1, 'from', GeneratedMessage.OS)
    ..a(2, 'text', GeneratedMessage.QS)
  ;

  ChatMessage() : super();
  ChatMessage.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  ChatMessage.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  ChatMessage clone() => new ChatMessage()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static ChatMessage create() => new ChatMessage();
  static PbList<ChatMessage> createRepeated() => new PbList<ChatMessage>();
  static ChatMessage getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyChatMessage();
    return _defaultInstance;
  }
  static ChatMessage _defaultInstance;

  String get from => getField(1);
  void set from(String v) { setField(1, v); }
  bool hasFrom() => hasField(1);
  void clearFrom() => clearField(1);

  String get text => getField(2);
  void set text(String v) { setField(2, v); }
  bool hasText() => hasField(2);
  void clearText() => clearField(2);
}

class _ReadonlyChatMessage extends ChatMessage with ReadonlyMessageMixin {}

