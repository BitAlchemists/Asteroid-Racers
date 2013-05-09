part of chatclient;

abstract class View<T> {
  final T elem;

  View(this.elem) {
    bind();
  }

  // bind to event listeners
  void bind() { }
}
