///
//  Generated code. Do not modify.
///
library net_message;

import 'package:fixnum/fixnum.dart';
import 'package:protobuf/protobuf.dart';

class Envelope_MessageType extends ProtobufEnum {
  static const Envelope_MessageType CHAT = const Envelope_MessageType._(1, 'CHAT');
  static const Envelope_MessageType ENTITY = const Envelope_MessageType._(2, 'ENTITY');
  static const Envelope_MessageType ENTITY_REMOVE = const Envelope_MessageType._(3, 'ENTITY_REMOVE');
  static const Envelope_MessageType HANDSHAKE = const Envelope_MessageType._(4, 'HANDSHAKE');
  static const Envelope_MessageType PLAYER = const Envelope_MessageType._(5, 'PLAYER');
  static const Envelope_MessageType PING_PONG = const Envelope_MessageType._(6, 'PING_PONG');
  static const Envelope_MessageType COLLISION = const Envelope_MessageType._(7, 'COLLISION');
  static const Envelope_MessageType INPUT = const Envelope_MessageType._(8, 'INPUT');

  static const List<Envelope_MessageType> values = const <Envelope_MessageType> [
    CHAT,
    ENTITY,
    ENTITY_REMOVE,
    HANDSHAKE,
    PLAYER,
    PING_PONG,
    COLLISION,
    INPUT,
  ];

  static final Map<int, Envelope_MessageType> _byValue = ProtobufEnum.initByValue(values);
  static Envelope_MessageType valueOf(int value) => _byValue[value];

  const Envelope_MessageType._(int v, String n) : super(v, n);
}

class Envelope extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Envelope')
    ..e(1, 'messageType', GeneratedMessage.QE, Envelope_MessageType.CHAT, (var v) => Envelope_MessageType.valueOf(v))
    ..a(2, 'encodedMessage', GeneratedMessage.QY)
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

  Envelope_MessageType get messageType => getField(1);
  void set messageType(Envelope_MessageType v) { setField(1, v); }
  bool hasMessageType() => hasField(1);
  void clearMessageType() => clearField(1);

  List<int> get encodedMessage => getField(2);
  void set encodedMessage(List<int> v) { setField(2, v); }
  bool hasEncodedMessage() => hasField(2);
  void clearEncodedMessage() => clearField(2);
}

class _ReadonlyEnvelope extends Envelope with ReadonlyMessageMixin {}

