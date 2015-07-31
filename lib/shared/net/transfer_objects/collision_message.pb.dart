///
//  Generated code. Do not modify.
///
library net_collision_message;


import 'package:protobuf/protobuf.dart';

class CollisionMessage extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('CollisionMessage')
    ..a(1, 'entityId', GeneratedMessage.Q3)
  ;

  CollisionMessage() : super();
  CollisionMessage.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  CollisionMessage.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  CollisionMessage clone() => new CollisionMessage()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static CollisionMessage create() => new CollisionMessage();
  static PbList<CollisionMessage> createRepeated() => new PbList<CollisionMessage>();
  static CollisionMessage getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyCollisionMessage();
    return _defaultInstance;
  }
  static CollisionMessage _defaultInstance;

  int get entityId => getField(1);
  void set entityId(int v) { setField(1, v); }
  bool hasEntityId() => hasField(1);
  void clearEntityId() => clearField(1);
}

class _ReadonlyCollisionMessage extends CollisionMessage with ReadonlyMessageMixin {}

