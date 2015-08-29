part of ui;

class UIHelper {
  
  
  static stagexl.TextField createTextField({String text: "", num numLines: 1}){
    stagexl.TextField textField = new stagexl.TextField();
    textField.textColor = stagexl.Color.White;
    textField.height = textField.textHeight * numLines;
    textField.text = text;
    textField.wordWrap = true;

    return textField;
  }

  static stagexl.TextField createInputField([num numLines = 1]){
    stagexl.TextField textField = new stagexl.TextField();
    textField.backgroundColor = stagexl.Color.White;
    textField.background = true;  
    textField.textColor = stagexl.Color.Black;
    textField.height = textField.textHeight * numLines + 5;
    textField.type = stagexl.TextFieldType.INPUT;

    return textField;
  }
}