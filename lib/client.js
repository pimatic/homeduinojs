var Board, baudrate, board, colors, repl, serialDevice;

Board = require('./board');

repl = require('otaat-repl');

colors = require('colors');

serialDevice = process.argv[2] || '/dev/ttyUSB0';

baudrate = parseInt(process.argv[3]) || 115200;

board = new Board("serialport", {
  serialDevice: serialDevice,
  baudrate: baudrate
});

console.log(("connecting to " + serialDevice + " with " + baudrate).green);

board.on("data", (function(_this) {
  return function(data) {
    return console.log("raw data: \"".grey + ("" + data).blue + "\"".grey);
  };
})(this));

board.on("rfReceive", (function(_this) {
  return function(event) {
    var data;
    if ('pulses' in event && (event.pulses != null)) {
      event.pulseCount = event.pulses.length;
    }
    data = JSON.stringify(event);
    data = data.substring(1, data.length - 1);
    return console.log("processed: ".grey + ("" + data).blue + "".grey);
  };
})(this));

board.on("rf", (function(_this) {
  return function(event) {
    var data;
    data = event.protocol + ": " + JSON.stringify(event.values);
    return console.log("matched proto: \"".grey + ("" + data).blue + "\"".grey);
  };
})(this));

board.connect().then((function(_this) {
  return function() {
    console.log("connected".green);
    return repl.start({
      prompt: "homeduino> ",
      input: process.stdin,
      output: process.stdout
    }).context.board = board;
  };
})(this))["catch"](function(error) {
  return console.log(error.message);
});
