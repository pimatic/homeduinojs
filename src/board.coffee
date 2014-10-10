Promise = require 'bluebird'
assert = require 'assert'
events = require 'events'
rfcontrol = require 'rfcontroljs'

SerialPortDriver = require './driver/serialport'

class Board extends events.EventEmitter

  _awaitingAck: []
  _opened: no
  ready: no

  constructor: (driver, driverOptions) ->
    assert driver is "serialport"
    # setup a new driver
    @driver = new SerialPortDriver(driverOptions.port, driverOptions.baudrate)
    @driver.on('ready', => 
      @ready = yes
      @emit('ready') 
    )
    @driver.on('error', (error) => @emit('error', error) )
    @driver.on('reconnect', (error) => @emit('reconnect', error) )
    @driver.on('close', => 
      @ready = no
      @emit('close')
    )
    @driver.on("data", (date) =>
      @emit "date", date
    )
    @driver.on("line", (line) =>
      @emit "line", line
      @_onLine(line)
    )
    @on('ready', => @setupWatchdog())

  connect: (timeout = 20000, retries = 3) -> 
    # Stop watchdog if its running and close current connection
    return @pendingConnect = @driver.connect(timeout, retries)

  disconnect: ->
    @stopWatchdog()
    return @driver.disconnect()

  setupWatchdog: ->
    @stopWatchdog()
    @_watchdogTimeout = setTimeout( (=>
      now = new Date().getTime()
      # last received data is not very old, conncection looks ok:
      if now - @_lastDataTime < 10000
        @setupWatchdog()
        return
      # Try to send ping, if it failes, there is something wrong...
      @driver.write("PING\n").then( =>
        @setupWatchdog()
      ).timeout(5000).catch( (err) =>
        @emit 'reconnect', err
        @connect().catch( (error) =>
          # Could not reconnect, so start watchdog again, to trigger next try
          @emit 'reconnect', err
          @setupWatchdog()
          return
        )
        return
      )
    ), 10000)

  stopWatchdog: ->
    clearTimeout(@_watchdogTimeout)

  _onLine: (line) -> 
    #console.log "data:", JSON.stringify(line)
    # @_lastDataTime = new Date().getTime()
    args = line.split(" ")
    assert args.length >= 1
    cmd = args[0]
    args.splice(0, 1)
    #console.log cmd, args
    switch cmd
      when 'ACK', 'ERR' then @_handleAcknowledge(cmd, args)
      when 'RF' then @_handleRFControl(cmd, args)
      when 'KP' then @_handleKeypad(cmd, args)
      when 'PING' then ;#nop
      else console.log "unknown message received: #{line}"
      

  whenReady: -> 
    unless @pendingConnect?
      return Promise.reject(new Error("First call connect!"))
    return @pendingConnect

  digitalWrite: (pin, value) ->
    assert typeof pin is "number"
    assert value in [0, 1]
    return @driver
      .write("DW #{pin} #{value}\n")
      .then(@_waitForAcknowledge)

  analogWrite: (pin, value) ->
    assert typeof pin is "number"
    assert typeof value is "number"
    return @driver
      .write("AW #{pin} #{value}\n")
      .then(@_waitForAcknowledge)

  digitalRead: (pin) ->
    assert typeof pin is "number"
    return @driver
      .write("DR #{pin}\n")
      .then(@_waitForAcknowledge)

  analogRead: (pin) ->
    assert typeof pin is "number"
    return @driver
      .write("AR #{pin}\n")
      .then(@_waitForAcknowledge)

  pinMode: (pin, mode) ->
    assert typeof pin is "number"
    assert mode in  [0, 1, 2]
    return @driver
      .write("PM #{pin} #{mode}\n")
      .then(@_waitForAcknowledge)    

  readDHT: (type, pin) ->
    assert type in [11, 22, 33, 44, 55]
    assert typeof pin is "number"
    return @driver
      .write("DHT #{type} #{pin}\n")
      .then(@_waitForAcknowledge)
      .then( (args) -> {
        temperature: parseFloat(args[0]), 
        humidity: parseFloat(args[1])
      })

  rfControlStartReceiving: (pin) ->
    assert typeof pin is "number"
    assert pin in [0, 1]
    return @driver
      .write("RF receive #{pin}\n")
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
    return @driver
      .write("RF send #{pin} #{repeats} #{pulseLengthsArgs} #{pulses}\n")
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