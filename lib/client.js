var Board, baudrate, board, colors, device, repl;

Board = require('./board');

repl = require('otaat-repl');

colors = require('colors');

device = process.argv[2] || '/dev/ttyUSB0';

baudrate = process.argv[3] || 115200;

board = new Board(device, baudrate);

console.log(("connecting to " + device + " with " + baudrate).green);

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
