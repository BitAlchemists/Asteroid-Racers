///
//  Generated code. Do not modify.
///
library net_int_message;

import 'package:fixnum/fixnum.dart';
import 'package:protobuf/protobuf.dart';

class IntMessage extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('IntMessage')
    ..a(1, 'integer', GeneratedMessage.QU3)
  ;

  IntMessage() : super();
  IntMessage.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  IntMessage.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  IntMessage clone() => new IntMessage()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static IntMessage create() => new IntMessage();
  static PbList<IntMessage> createRepeated() => new PbList<IntMessage>();
  static IntMessage getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyIntMessage();
    return _defaultInstance;
  }
  static IntMessage _defaultInstance;

  int get integer => getField(1);
  void set integer(int v) { setField(1, v); }
  bool hasInteger() => hasField(1);
  void clearInteger() => clearField(1);
}

class _ReadonlyIntMessage extends IntMessage with ReadonlyMessageMixin {}

