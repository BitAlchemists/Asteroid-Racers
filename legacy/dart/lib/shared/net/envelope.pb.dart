///
//  Generated code. Do not modify.
///
library net_envelope;

import 'package:protobuf/protobuf.dart';

class MessageType extends ProtobufEnum {
  static const MessageType CHAT = const MessageType._(1, 'CHAT');
  static const MessageType ENTITY = const MessageType._(2, 'ENTITY');
  static const MessageType ENTITY_REMOVE = const MessageType._(3, 'ENTITY_REMOVE');
  static const MessageType HANDSHAKE = const MessageType._(4, 'HANDSHAKE');
  static const MessageType PLAYER = const MessageType._(5, 'PLAYER');
  static const MessageType PING_PONG = const MessageType._(6, 'PING_PONG');
  static const MessageType COLLISION = const MessageType._(7, 'COLLISION');
  static const MessageType INPUT = const MessageType._(8, 'INPUT');
  static const MessageType RACE_JOIN = const MessageType._(9, 'RACE_JOIN');
  static const MessageType RACE_EVENT = const MessageType._(10, 'RACE_EVENT');
  static const MessageType RACE_LEAVE = const MessageType._(11, 'RACE_LEAVE');

  static const List<MessageType> values = const <MessageType> [
    CHAT,
    ENTITY,
    ENTITY_REMOVE,
    HANDSHAKE,
    PLAYER,
    PING_PONG,
    COLLISION,
    INPUT,
    RACE_JOIN,
    RACE_EVENT,
    RACE_LEAVE,
  ];

  static final Map<int, MessageType> _byValue = ProtobufEnum.initByValue(values);
  static MessageType valueOf(int value) => _byValue[value];

  const MessageType._(int v, String n) : super(v, n);
}

class Envelope extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Envelope')
    ..e(1, 'messageType', GeneratedMessage.QE, MessageType.CHAT, (var v) => MessageType.valueOf(v))
    ..a(2, 'payload', GeneratedMessage.OY)
  ;

  Envelope() : super();
  Envelope.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  Envelope.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  Envelope clone() => new Envelope()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static Envelope create() => new Envelope();
  static PbList<Envelope> createRepeated() => new PbList<Envelope>();
  static Envelope getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyEnvelope();
    return _defaultInstance;
  }
  static Envelope _defaultInstance;

  MessageType get messageType => getField(1);
  void set messageType(MessageType v) { setField(1, v); }
  bool hasMessageType() => hasField(1);
  void clearMessageType() => clearField(1);

  List<int> get payload => getField(2);
  void set payload(List<int> v) { setField(2, v); }
  bool hasPayload() => hasField(2);
  void clearPayload() => clearField(2);
}

class _ReadonlyEnvelope extends Envelope with ReadonlyMessageMixin {}

