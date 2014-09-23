serialport = require("serialport")
SerialPort = serialport.SerialPort
Promise = require 'bluebird'
Promise.promisifyAll(SerialPort.prototype)
assert = require 'assert'
events = require 'events'
rfcontrol = require 'rfcontroljs'

class Board extends events.EventEmitter

  _awaitingAck: []

  constructor: (port, baudrate = 9600) ->
    @serialPort = new SerialPort(port, { 
      baudrate, 
      parser: serialport.parsers.readline("\r\n")
    }, openImmediately = no)
    @serialPort.on("data", (_line) =>
      # Sanitize data
      line = _line.replace(/\0/g, '').trim()
      #console.log "data:", JSON.stringify(line)
      @emit "data", line
      if line is "ready"
        @emit 'ready'
        return
      args = line.split(" ")
      assert args.length >= 1
      cmd = args[0]
      args.splice(0, 1)
      #console.log cmd, args
      switch cmd
        when 'ACK', 'ERR' then @_handleAcknowledge(cmd, args)
        when 'RF' then @_handleRFControl(cmd, args)
        when 'KP' then @_handleKeypad(cmd, args)
        else console.log "unknown message received: #{line}"
    )

  connect: (timeout = 20000) -> 
    return @pendingConnect = @serialPort.openAsync().then( =>
      resolver = null
      return new Promise( (resolve, reject) =>
        resolver = resolve
        @once("ready", resolve)
      ).timeout(timeout).catch( (err) =>
        @removeListener("ready", resolver)
        throw err
      )
    )

  whenReady: -> 
    unless @pendingConnect? then return Promise.reject(new Error("First call connect!"))
    return @pendingConnect

  digitalWrite: (pin, value) ->
    assert typeof pin is "number"
    assert value in [0, 1]
    return @serialPort
      .writeAsync("DW #{pin} #{value}\n")
      .then(@_waitForAcknowledge)

  analogWrite: (pin, value) ->
    assert typeof pin is "number"
    assert typeof value is "number"
    return @serialPort
      .writeAsync("AW #{pin} #{value}\n")
      .then(@_waitForAcknowledge)

  digitalRead: (pin) ->
    assert typeof pin is "number"
    return @serialPort
      .writeAsync("DR #{pin}\n")
      .then(@_waitForAcknowledge)

  analogRead: (pin) ->
    assert typeof pin is "number"
    return @serialPort
      .writeAsync("AR #{pin}\n")
      .then(@_waitForAcknowledge)

  pinMode: (pin, mode) ->
    assert typeof pin is "number"
    assert mode in  [0, 1, 2]
    return @serialPort
      .writeAsync("PM #{pin} #{mode}\n")
      .then(@_waitForAcknowledge)    

  readDHT: (type, pin) ->
    assert type in [11, 22, 33, 44, 55]
    assert typeof pin is "number"
    return @serialPort
      .writeAsync("DHT #{type} #{pin}\n")
      .then(@_waitForAcknowledge)
      .then( (args) -> {
        temperature: parseFloat(args[0]), 
        humidity: parseFloat(args[1])
      })

  rfControlStartReceiving: (pin) ->
    assert typeof pin is "number"
    assert pin in [0, 1]
    return @serialPort
      .writeAsync("RF receive #{pin}\n")
      .then(@_waitForAcknowledge)

  rfControlSendMessage: (pin, protocolName, message) ->
    result = rfcontrol.encodeMessage(protocolName, message)
    return @rfControlSendPulses(pin, result.pulseLengths, result.pulses)

  rfControlSendPulses: (pin, pulseLengths, pulses) ->
    assert typeof pin is "number", "pin should be a number"
    assert Array.isArray(pulseLengths), "pulseLengths should be an array"
    assert pulseLengths.length <= 8, "pulseLengths.length should be <= 8"
    assert typeof pulses is "string", "pulses should be a string"
    repeats = 5
    pulseLengthsArgs = ""
    i = 0
    for pl in pulseLengths
      pulseLengthsArgs += " #{pl}"
      i++
    while i < 8
      pulseLengthsArgs += " 0"
      i++
    return @serialPort
      .writeAsync("RF send #{pin} #{repeats} #{pulseLengthsArgs} #{pulses}\n")
      .then(@_waitForAcknowledge)

  _onAcknowledge: () =>
    return new Promise( (resolve) =>
      @_awaitingAck.push resolve
    )

  _waitForAcknowledge: () =>
    return @_onAcknowledge().then( ( {cmd, args} ) =>
      switch cmd
        when 'ERR' then throw new Error(args[0])
        when 'ACK'
          switch args.length
            when 0 then return
            when 1 then return args[0]
            else return args
        else assert false
    )

  _handleAcknowledge: (cmd, args) ->
    assert @_awaitingAck.length > 0
    resolver = @_awaitingAck[0]
    resolver({cmd, args})
    @_awaitingAck.splice(0, 1)
    return
  
  _handleRFControl: (cmd, args) ->
    assert args.length is 10
    assert args[0] is 'receive'

    strSeq = args[1]
    for a in args[2..9]
      strSeq += " #{a}"

    info = rfcontrol.prepareCompressedPulses(strSeq)
    @emit 'rfReceive', info
    results = rfcontrol.decodePulses(info.pulseLengths, info.pulses)
    for r in results
      @emit 'rf', r
    return

  _handleKeypad: (cmd, args) ->
    assert args.length is 1
    key = args[0]
    @emit 'keypad', {key}
    return

  @getRfProtocol: (protocolName) ->
    return rfcontrol.getProtocol(protocolName)

module.exports = Board