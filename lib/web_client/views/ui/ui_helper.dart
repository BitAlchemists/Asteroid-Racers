part of web_client;

class UIHelper {
  
  static num _textFieldHeight = 20;
  
  static stagexl.TextField createTextField({String text: "", num numLines: 1}){
    stagexl.TextField textField = new stagexl.TextField();
    textField.textColor = stagexl.Color.White;
    textField.height = _textFieldHeight * numLines;
    textField.text = text;
    return textField;
  }

  static stagexl.TextField createInputField([num numLines = 1]){
    stagexl.TextField textField = new stagexl.TextField();
    textField.backgroundColor = stagexl.Color.White;
    textField.textColor = stagexl.Color.Black;
    textField.background = true;  
    textField.height = _textFieldHeight * numLines;
    textField.type = stagexl.TextFieldType.INPUT;
    return textField;
  }
}