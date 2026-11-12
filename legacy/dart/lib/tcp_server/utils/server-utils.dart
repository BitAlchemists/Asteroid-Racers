part of tcp_server;


time(msg, callback()) {
  var sw = new Stopwatch()..start();
  callback();
  sw.stop();
  log.config('Timing for $msg: ${sw.elapsedMicroseconds} us');
}

// runs the callback on the event loop at the next opportunity
Future queue(callback()) {
  return (new Future.delayed(Duration.ZERO, callback)).catchError((e){
    log.warning("error in queue()ed callback: ${e.toString()}");
  });
}
