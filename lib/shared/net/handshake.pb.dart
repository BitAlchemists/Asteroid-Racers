///
//  Generated code. Do not modify.
///
library net_handshake;

import 'package:fixnum/fixnum.dart';
import 'package:protobuf/protobuf.dart';

class Handshake extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('Handshake')
    ..a(1, 'username', GeneratedMessage.OS)
    ..hasRequiredFields = false
  ;

  Handshake() : super();
  Handshake.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  Handshake.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  Handshake clone() => new Handshake()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static Handshake create() => new Handshake();
  static PbList<Handshake> createRepeated() => new PbList<Handshake>();
  static Handshake getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyHandshake();
    return _defaultInstance;
  }
  static Handshake _defaultInstance;

  String get username => getField(1);
  void set username(String v) { setField(1, v); }
  bool hasUsername() => hasField(1);
  void clearUsername() => clearField(1);
}

class _ReadonlyHandshake extends Handshake with ReadonlyMessageMixin {}

