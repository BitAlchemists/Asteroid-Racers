///
//  Generated code. Do not modify.
///
library net_race;

import 'package:fixnum/fixnum.dart';
import 'package:protobuf/protobuf.dart';

class RaceJoin extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('RaceJoin')
    ..a(1, 'id', GeneratedMessage.Q3)
  ;

  RaceJoin() : super();
  RaceJoin.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  RaceJoin.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  RaceJoin clone() => new RaceJoin()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static RaceJoin create() => new RaceJoin();
  static PbList<RaceJoin> createRepeated() => new PbList<RaceJoin>();
  static RaceJoin getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyRaceJoin();
    return _defaultInstance;
  }
  static RaceJoin _defaultInstance;

  int get id => getField(1);
  void set id(int v) { setField(1, v); }
  bool hasId() => hasField(1);
  void clearId() => clearField(1);
}

class _ReadonlyRaceJoin extends RaceJoin with ReadonlyMessageMixin {}

class RaceLeave extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('RaceLeave')
    ..hasRequiredFields = false
  ;

  RaceLeave() : super();
  RaceLeave.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  RaceLeave.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  RaceLeave clone() => new RaceLeave()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static RaceLeave create() => new RaceLeave();
  static PbList<RaceLeave> createRepeated() => new PbList<RaceLeave>();
  static RaceLeave getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyRaceLeave();
    return _defaultInstance;
  }
  static RaceLeave _defaultInstance;
}

class _ReadonlyRaceLeave extends RaceLeave with ReadonlyMessageMixin {}

