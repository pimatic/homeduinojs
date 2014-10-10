var Board, baudrate, board, colors, port, repl;

Board = require('./board');

repl = require('otaat-repl');

colors = require('colors');

port = process.argv[2] || '/dev/ttyUSB0';

baudrate = process.argv[3] || 115200;

board = new Board("serialport", {
  port: port,
  baudrate: baudrate
});

console.log(("connecting to " + port + " with " + baudrate).green);

board.on("data", (function(_this) {
  return function(data) {
    return console.log("data: \"".grey + ("" + data).blue + "\"".grey);
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
})(this)).done();
