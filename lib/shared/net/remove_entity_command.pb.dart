///
//  Generated code. Do not modify.
///
library net_remove_entity_command;

import 'package:fixnum/fixnum.dart';
import 'package:protobuf/protobuf.dart';

class RemoveEntityCommand extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('RemoveEntityCommand')
    ..a(1, 'entityId', GeneratedMessage.Q3)
  ;

  RemoveEntityCommand() : super();
  RemoveEntityCommand.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  RemoveEntityCommand.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  RemoveEntityCommand clone() => new RemoveEntityCommand()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static RemoveEntityCommand create() => new RemoveEntityCommand();
  static PbList<RemoveEntityCommand> createRepeated() => new PbList<RemoveEntityCommand>();
  static RemoveEntityCommand getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyRemoveEntityCommand();
    return _defaultInstance;
  }
  static RemoveEntityCommand _defaultInstance;

  int get entityId => getField(1);
  void set entityId(int v) { setField(1, v); }
  bool hasEntityId() => hasField(1);
  void clearEntityId() => clearField(1);
}

class _ReadonlyRemoveEntityCommand extends RemoveEntityCommand with ReadonlyMessageMixin {}

