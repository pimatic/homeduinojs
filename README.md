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


### readDstSensors (pin)

Returns all Dallas temp sensors on [pin]

```CoffeeScript
board.readDstSensors(12).then( (ret) -> 
  console.log ret.sensors
).done()
```


### readDstSensor (pin, address)

Reads a sensor with [address] on [pin].

```CoffeeScript
board.readDstSensor(12, '12312312333').then( (ret) -> 
  console.log ret.temperature
).done()
```


### readDstAll (pin)

Reads all sensors connected to [pin]

```CoffeeScript
board.readDstAll(12).then( (ret) -> 
  console.log ret.temperatures
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

Setup:

```
git clone https://github.com/pimatic/homeduinojs && cd homeduinojs && npm install
```

Start the REPL-Client:

```
sudo ./client.js /dev/ttyUSB0 115200
```

It will connect to the arduino and give you a prompt, where you can enter a 
 javascript command. To start receiving RF data enter the command 
 `board.rfControlStartReceiving(0)` or  `board.rfControlStartReceiving(1)`
 depending on the receiving pin used in your setup

```
connecting to /dev/ttyUSB0 with 115200
raw data: "ready"
connected
homeduino> board.rfControlStartReceiving(0)
raw data: "ACK"
undefined
homeduino> raw data: "RF receive 516 1928 3880 9204 0 0 0 0 01020102010202020201010102010101010101010202020101010101010102010201020103"
processed: "pulseLengths":[516,1928,3880,9204],"pulses":"01020102010202020201010102010101010101010202020101010101010102010201020103"
matched proto: "weather1: {"id":120,"channel":1,"temperature":22.4,"humidity":42,"lowBattery":false}"
matched proto: "weather5: {"id":234,"lowBattery":true,"temperature":179.3,"humidity":40}"
matched proto: "weather16: {"id":234,"channel":1,"temperature":179.3,"humidity":164,"lowBattery":true}"

```

The output is colorized by default. You can disable colors by starting 
 the REPL-Client with the option `--no-color`. 
