var Board, Promise, SerialPort, assert, events, rfcontrol, serialport,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

serialport = require("serialport");

SerialPort = serialport.SerialPort;

Promise = require('bluebird');

Promise.promisifyAll(SerialPort.prototype);

assert = require('assert');

events = require('events');

rfcontrol = require('rfcontroljs');

Board = (function(_super) {
  __extends(Board, _super);

  Board.prototype._awaitingAck = [];

  Board.prototype.ready = false;

  function Board(port, baudrate) {
    this.port = port;
    this.baudrate = baudrate != null ? baudrate : 9600;
    this._waitForAcknowledge = __bind(this._waitForAcknowledge, this);
    this._onAcknowledge = __bind(this._onAcknowledge, this);
    this._onData = __bind(this._onData, this);
    this.on('ready', (function(_this) {
      return function() {
        return _this.setupWatchdog();
      };
    })(this));
  }

  Board.prototype.connect = function(timeout, retries) {
    if (timeout == null) {
      timeout = 20000;
    }
    if (retries == null) {
      retries = 3;
    }
    this.stopWatchdog();
    return this.pendingConnect = (this.serialPort != null ? this.serialPort.closeAsync() : Promise.resolve())["finally"]((function(_this) {
      return function() {
        var openImmediately;
        _this.ready = false;
        _this.serialPort = new SerialPort(_this.port, {
          baudrate: _this.baudrate,
          parser: serialport.parsers.readline("\r\n")
        }, openImmediately = false);
        _this.serialPort.on('error', function(error) {
          return _this.emit('error', error);
        });
        return _this.serialPort.openAsync().then(function() {
          var resolver;
          _this.serialPort.on("data", _this._onData);
          resolver = null;
          return new Promise(function(resolve, reject) {
            _this.serialPort.writeAsync("PING\n")["catch"](reject);
            resolver = resolve;
            return _this.once("ready", resolver);
          }).timeout(timeout)["catch"](function(err) {
            _this.removeListener("ready", resolver);
            _this.removeListener("data", _this._onData);
            if (err.name === "TimeoutError" && retries > 0) {
              _this.emit('reconnect', err);
              return _this.connect(timeout, retries - 1);
            } else {
              throw err;
            }
          });
        });
      };
    })(this));
  };

  Board.prototype.disconnect = function() {
    var close;
    if (this.serialPort != null) {
      close = this.serialPort.closeAsync();
      this.serialPort = null;
      return close;
    } else {
      return Promise.resolve();
    }
  };

  Board.prototype.setupWatchdog = function() {
    this.stopWatchdog();
    return this._watchdogTimeout = setTimeout(((function(_this) {
      return function() {
        var now;
        now = new Date().getTime();
        if (now - _this._lastDataTime < 10000) {
          _this.setupWatchdog();
          return;
        }
        return _this.serialPort.writeAsync("PING\n").then(function() {
          return _this.setupWatchdog();
        }).timeout(5000)["catch"](function(err) {
          _this.serialPort = null;
          _this.stopWatchdog();
          _this.emit('reconnect', err);
          return Promise.delay(5000).then(function() {
            return _this.connect()["catch"](function(error) {
              _this.emit('reconnect', err);
              return _this.setupWatchdog();
            });
          }).done();
        }).done();
      };
    })(this)), 10000);
  };

  Board.prototype.stopWatchdog = function() {
    return clearTimeout(this._watchdogTimeout);
  };

  Board.prototype._onData = function(_line) {
    var args, cmd, line;
    line = _line.replace(/\0/g, '').trim();
    this.emit("data", line);
    if (/ready$/.test(line)) {
      this.ready = true;
      this.emit('ready');
      return;
    }
    if (!this.ready) {
      this.serialPort.writeAsync("RESET\n")["catch"](function(error) {
        return this.emit("error", error);
      });
    }
    this._lastDataTime = new Date().getTime();
    args = line.split(" ");
    assert(args.length >= 1);
    cmd = args[0];
    args.splice(0, 1);
    switch (cmd) {
      case 'ACK':
      case 'ERR':
        return this._handleAcknowledge(cmd, args);
      case 'RF':
        return this._handleRFControl(cmd, args);
      case 'KP':
        return this._handleKeypad(cmd, args);
      case 'PING':
        break;
      default:
        return console.log("unknown message received: " + line);
    }
  };

  Board.prototype.whenReady = function() {
    if (this.pendingConnect == null) {
      return Promise.reject(new Error("First call connect!"));
    }
    return this.pendingConnect;
  };

  Board.prototype.digitalWrite = function(pin, value) {
    assert(typeof pin === "number");
    assert(value === 0 || value === 1);
    return this.serialPort.writeAsync("DW " + pin + " " + value + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.analogWrite = function(pin, value) {
    assert(typeof pin === "number");
    assert(typeof value === "number");
    return this.serialPort.writeAsync("AW " + pin + " " + value + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.digitalRead = function(pin) {
    assert(typeof pin === "number");
    return this.serialPort.writeAsync("DR " + pin + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.analogRead = function(pin) {
    assert(typeof pin === "number");
    return this.serialPort.writeAsync("AR " + pin + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.pinMode = function(pin, mode) {
    assert(typeof pin === "number");
    assert(mode === 0 || mode === 1 || mode === 2);
    return this.serialPort.writeAsync("PM " + pin + " " + mode + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.readDHT = function(type, pin) {
    assert(type === 11 || type === 22 || type === 33 || type === 44 || type === 55);
    assert(typeof pin === "number");
    return this.serialPort.writeAsync("DHT " + type + " " + pin + "\n").then(this._waitForAcknowledge).then(function(args) {
      return {
        temperature: parseFloat(args[0]),
        humidity: parseFloat(args[1])
      };
    });
  };

  Board.prototype.rfControlStartReceiving = function(pin) {
    assert(typeof pin === "number");
    assert(pin === 0 || pin === 1);
    return this.serialPort.writeAsync("RF receive " + pin + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype.rfControlSendMessage = function(pin, protocolName, message) {
    var result;
    result = rfcontrol.encodeMessage(protocolName, message);
    return this.rfControlSendPulses(pin, result.pulseLengths, result.pulses);
  };

  Board.prototype.rfControlSendPulses = function(pin, pulseLengths, pulses) {
    var i, pl, pulseLengthsArgs, repeats, _i, _len;
    assert(typeof pin === "number", "pin should be a number");
    assert(Array.isArray(pulseLengths), "pulseLengths should be an array");
    assert(pulseLengths.length <= 8, "pulseLengths.length should be <= 8");
    assert(typeof pulses === "string", "pulses should be a string");
    repeats = 5;
    pulseLengthsArgs = "";
    i = 0;
    for (_i = 0, _len = pulseLengths.length; _i < _len; _i++) {
      pl = pulseLengths[_i];
      pulseLengthsArgs += " " + pl;
      i++;
    }
    while (i < 8) {
      pulseLengthsArgs += " 0";
      i++;
    }
    return this.serialPort.writeAsync("RF send " + pin + " " + repeats + " " + pulseLengthsArgs + " " + pulses + "\n").then(this._waitForAcknowledge);
  };

  Board.prototype._onAcknowledge = function() {
    return new Promise((function(_this) {
      return function(resolve) {
        return _this._awaitingAck.push(resolve);
      };
    })(this));
  };

  Board.prototype._waitForAcknowledge = function() {
    return this._onAcknowledge().then((function(_this) {
      return function(_arg) {
        var args, cmd;
        cmd = _arg.cmd, args = _arg.args;
        switch (cmd) {
          case 'ERR':
            throw new Error(args[0]);
            break;
          case 'ACK':
            switch (args.length) {
              case 0:
                break;
              case 1:
                return args[0];
              default:
                return args;
            }
            break;
          default:
            return assert(false);
        }
      };
    })(this));
  };

  Board.prototype._handleAcknowledge = function(cmd, args) {
    var resolver;
    assert(this._awaitingAck.length > 0);
    resolver = this._awaitingAck[0];
    resolver({
      cmd: cmd,
      args: args
    });
    this._awaitingAck.splice(0, 1);
  };

  Board.prototype._handleRFControl = function(cmd, args) {
    var a, info, r, results, strSeq, _i, _j, _len, _len1, _ref;
    assert(args.length === 10);
    assert(args[0] === 'receive');
    strSeq = args[1];
    _ref = args.slice(2, 10);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      a = _ref[_i];
      strSeq += " " + a;
    }
    info = rfcontrol.prepareCompressedPulses(strSeq);
    this.emit('rfReceive', info);
    results = rfcontrol.decodePulses(info.pulseLengths, info.pulses);
    for (_j = 0, _len1 = results.length; _j < _len1; _j++) {
      r = results[_j];
      this.emit('rf', r);
    }
  };

  Board.prototype._handleKeypad = function(cmd, args) {
    var key;
    assert(args.length === 1);
    key = args[0];
    this.emit('keypad', {
      key: key
    });
  };

  Board.getRfProtocol = function(protocolName) {
    return rfcontrol.getProtocol(protocolName);
  };

  return Board;

})(events.EventEmitter);

module.exports = Board;
