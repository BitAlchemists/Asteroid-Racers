Asteroid-Racers
===============

Asteroid Racers is a multiplayer browser game that lets you race against other players with your spaceship in the weightlessness of outer space.

Set up the development environment
----------------------------------
- Download the Dart SDK: https://www.dartlang.org/downloads/
- Clone the Asteroid-Racers repo
- pub get

For Linux servers:
apt-get update

apt-get install git 

apt-get install apt-transport-https curl
sh -c 'curl https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -'
sh -c 'curl https://storage.googleapis.com/download.dartlang.org/linux/debian/dart_stable.list > /etc/apt/sources.list.d/dart_stable.list'
apt-get update
apt-get install dart

git clone https://github.com/BitAlchemists/Asteroid-Racers.git
cd Asteroid-Racers/

/usr/lib/dart/bin/pub get

There are two ways to test the client locally.

1) The server runs within the browser:
- set config.localServer in web/asteroidracers.dart to true
- run web/asteroidracers.html

2) The server runs as a dedicated application:
- set config.localServer in web/asteroidracers.dart to false
- pub build
- run bin/run_server.dart to run the server
- run web/asteroidracers.html to run the client

For details visit the wiki: https://github.com/BitAlchemists/Asteroid-Racers/wiki


Install protobuf
https://www.dartlang.org/articles/serialization/#protobuf-review

