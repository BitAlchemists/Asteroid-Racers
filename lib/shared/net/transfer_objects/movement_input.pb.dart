///
//  Generated code. Do not modify.
///
library net_movement_input;

import 'package:fixnum/fixnum.dart';
import 'package:protobuf/protobuf.dart';

class MovementInput extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('MovementInput')
    ..a(1, 'newOrientation', GeneratedMessage.OD)
    ..a(2, 'accelerationFactor', GeneratedMessage.OD)
    ..hasRequiredFields = false
  ;

  MovementInput() : super();
  MovementInput.fromBuffer(List<int> i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromBuffer(i, r);
  MovementInput.fromJson(String i, [ExtensionRegistry r = ExtensionRegistry.EMPTY]) : super.fromJson(i, r);
  MovementInput clone() => new MovementInput()..mergeFromMessage(this);
  BuilderInfo get info_ => _i;
  static MovementInput create() => new MovementInput();
  static PbList<MovementInput> createRepeated() => new PbList<MovementInput>();
  static MovementInput getDefault() {
    if (_defaultInstance == null) _defaultInstance = new _ReadonlyMovementInput();
    return _defaultInstance;
  }
  static MovementInput _defaultInstance;

  double get newOrientation => getField(1);
  void set newOrientation(double v) { setField(1, v); }
  bool hasNewOrientation() => hasField(1);
  void clearNewOrientation() => clearField(1);

  double get accelerationFactor => getField(2);
  void set accelerationFactor(double v) { setField(2, v); }
  bool hasAccelerationFactor() => hasField(2);
  void clearAccelerationFactor() => clearField(2);
}

class _ReadonlyMovementInput extends MovementInput with ReadonlyMessageMixin {}

