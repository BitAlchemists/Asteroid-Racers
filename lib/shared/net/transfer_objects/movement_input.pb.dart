///
//  Generated code. Do not modify.
///
library net_movement_input;


import 'package:protobuf/protobuf.dart';

class MovementInput extends GeneratedMessage {
  static final BuilderInfo _i = new BuilderInfo('MovementInput')
    ..a(1, 'newOrientation', GeneratedMessage.OD)
    ..a(2, 'accelerate', GeneratedMessage.OB)
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

  bool get accelerate => getField(2);
  void set accelerate(bool v) { setField(2, v); }
  bool hasAccelerate() => hasField(2);
  void clearAccelerate() => clearField(2);
}

class _ReadonlyMovementInput extends MovementInput with ReadonlyMessageMixin {}

