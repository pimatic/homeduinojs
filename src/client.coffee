Board = require './board'
repl = require 'otaat-repl'
colors = require 'colors'

device = process.argv[2] or '/dev/ttyUSB0'
baudrate = process.argv[3] or 115200

board = new Board(device, baudrate)
console.log "connecting to #{device} with #{baudrate}".green
board.on "data", (data) => console.log "data: \"".grey + "#{data}".blue + "\"".grey
board.connect().then( =>
  console.log "connected".green
  repl.start({
    prompt: "homeduino> ",
    input: process.stdin,
    output: process.stdout
  }).context.board = board
).done()