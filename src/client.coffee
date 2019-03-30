Board = require './board'
repl = require 'otaat-repl'
colors = require 'colors'

serialDevice = process.argv[2] or '/dev/ttyUSB0'
baudrate = parseInt(process.argv[3]) or 115200

board = new Board("serialport", {serialDevice, baudrate})
console.log "connecting to #{serialDevice} with #{baudrate}".green


board.on "data", (data) =>
  console.log "raw data: \"".grey + "#{data}".blue + "\"".grey

board.on "rfReceive", (event) =>
  if 'pulses' of event and event.pulses?
    event.pulseCount = event.pulses.length
  data = JSON.stringify(event)
  data = data.substring(1, data.length-1)
  console.log "processed: ".grey + "#{data}".blue + "".grey

board.on "rf", (event) =>
  data = event.protocol + ": " + JSON.stringify(event.values)
  console.log "matched proto: \"".grey + "#{data}".blue + "\"".grey

board.connect().then( =>
  console.log "connected".green
  repl.start({
    prompt: "homeduino> ",
    input: process.stdin,
    output: process.stdout
  }).context.board = board
).catch( (error) ->
  console.log error.message
)