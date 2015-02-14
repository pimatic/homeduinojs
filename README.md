homeduinojs
===========

Node.js library for using [homeduino](https://github.com/sweetpi/homeduino).

API
---

### connect

```CoffeeScript

homeduino = require('homeduino')
Board = homeduino.Board
board = new Board('/dev/ttyUSB0', 115200)

board.connect().then( ->
  #do stuff
).done()
```

### readDHT(type, pin)

Read a dht sensor

```CoffeeScript
board.readDHT(22, 13).then( (ret) -> 
  console.log ret.temperature, ret.humidity
).done()
```

### readDST()

Read a Dallas DS18B20 sensor

```CoffeeScript
board.readDST().then( (ret) -> 
  console.log ret.temperature
).done()
```

### rfControlStartReceiving(pin)

```CoffeeScript

board.on "rfReceive", (event) -> 
  console.log 'received:', event.pulseLengths, event.pulses

board.on "rf", (event) -> 
  console.log "#{event.protocol}: ", event.values

board.connect().then( ->
  console.log "board ready"
  board.rfControlStartReceiving(0).then( ->
    console.log "receiving..."
  ).done()
).done()
```

### pin read and writes

```CoffeeScript
board.digitalWrite(4, 1).done()
board.analogWrite(1, 10).done()
board.digitalRead(4).then( (value) ->
  console.log value
).done()
board.analogRead(4).then( (value) ->
  console.log value
).done()
board.pinMode(1, 0).done()
```

REPL-Client
-----------

```
git clone https://github.com/pimatic/homeduinojs && cd homeduinojs && npm install
```

Start the repl client:

```
sudo ./client.js /dev/ttyUSB0 115200
```

It will connect to the arduino and give you a prompt, where you can enter a javascript command:

```
connecting to /dev/ttyUSB0 with 115200
data: "ready"
connected
homeduino> board.rfControlStartReceiving(0)
data: "ACK"
undefined
```
