var Board, Promise, assert, events, rfcontrol, settled,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Promise = require('bluebird');

assert = require('assert');

events = require('events');

rfcontrol = require('rfcontroljs');

settled = function(promise) {
  return Promise.settle([promise]);
};

Board = (function(_super) {
  __extends(Board, _super);

  Board.HIGH = 1;

  Board.LOW = 0;

  Board.INPUT = 0;

  Board.OUTPUT = 1;

  Board.INPUT_PULLUP = 2;

  Board.prototype._awaitingAck = [];

  Board.prototype._opened = false;

  Board.prototype.ready = false;

  function Board(driver, driverOptions) {
    this._waitForAcknowledge = __bind(this._waitForAcknowledge, this);
    this._onAcknowledge = __bind(this._onAcknowledge, this);
    var GpioDriver, SerialPortDriver;
    assert(driver === "serialport" || driver === "gpio");
    switch (driver) {
      case "serialport":
        SerialPortDriver = require('./driver/serialport');
        this.driver = new SerialPortDriver(driverOptions);
        break;
      case "gpio":
        GpioDriver = require('./driver/gpio');
        this.driver = new GpioDriver(driverOptions);
    }
    this._lastAction = Promise.resolve();
    this.driver.on('ready', (function(_this) {
      return function() {
        _this._lastDataTime = new Date().getTime();
        _this.ready = true;
        return _this.emit('ready');
      };
    })(this));
    this.driver.on('error', (function(_this) {
      return function(error) {
        return _this.emit('error', error);
      };
    })(this));
    this.driver.on('reconnect', (function(_this) {
      return function(error) {
        return _this.emit('reconnect', error);
      };
    })(this));
    this.driver.on('close', (function(_this) {
      return function() {
        _this.ready = false;
        return _this.emit('close');
      };
    })(this));
    this.driver.on("data", (function(_this) {
      return function(data) {
        return _this.emit("data", data);
      };
    })(this));
    this.driver.on("line", (function(_this) {
      return function(line) {
        _this.emit("line", line);
        return _this._onLine(line);
      };
    })(this));
    this.on('ready', (function(_this) {
      return function() {
        return _this.setupWatchdog();
      };
    })(this));
  }

  Board.prototype.connect = function(timeout, retries) {
    this.timeout = timeout != null ? timeout : 5 * 60 * 1000;
    this.retries = retries != null ? retries : 3;
    return this.pendingConnect = this.driver.connect(timeout, retries);
  };

  Board.prototype.disconnect = function() {
    this.stopWatchdog();
    return this.driver.disconnect();
  };

  Board.prototype.setupWatchdog = function() {
    this.stopWatchdog();
    return this._watchdogTimeout = setTimeout(((function(_this) {
      return function() {
        var now;
        now = new Date().getTime();
        if (now - _this._lastDataTime < _this.timeout) {
          _this.setupWatchdog();
          return;
        }
        return _this.driver.write("PING\n").then(function() {
          return _this.setupWatchdog();
        }).timeout(20 * 1000)["catch"](function(err) {
          _this.emit('reconnect', err);
          _this.connect(_this.timeout, _this.retries)["catch"](function(error) {
            _this.emit('reconnect', err);
          });
        });
      };
    })(this)), 20 * 1000);
  };

  Board.prototype.stopWatchdog = function() {
    return clearTimeout(this._watchdogTimeout);
  };

  Board.prototype._onLine = function(line) {
    var args, cmd;
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

  Board.prototype.writeAndWait = function(data) {
    return this._lastAction = settled(this._lastAction).then((function(_this) {
      return function() {
        return Promise.all([_this.driver.write(data), _this._waitForAcknowledge()]).then(function(_arg) {
          var result, _;
          _ = _arg[0], result = _arg[1];
          return result;
        });
      };
    })(this));
  };

  Board.prototype.digitalWrite = function(pin, value) {
    assert(typeof pin === "number");
    assert(value === 0 || value === 1);
    return this.writeAndWait("DW " + pin + " " + value + "\n");
  };

  Board.prototype.analogWrite = function(pin, value) {
    assert(typeof pin === "number");
    assert(typeof value === "number");
    return this.writeAndWait("AW " + pin + " " + value + "\n");
  };

  Board.prototype.digitalRead = function(pin) {
    assert(typeof pin === "number");
    return this.writeAndWait("DR " + pin + "\n");
  };

  Board.prototype.analogRead = function(pin) {
    assert(typeof pin === "number");
    return this.writeAndWait("AR " + pin + "\n");
  };

  Board.prototype.pinMode = function(pin, mode) {
    assert(typeof pin === "number");
    assert(mode === 0 || mode === 1 || mode === 2);
    return this.writeAndWait("PM " + pin + " " + mode + "\n");
  };

  Board.prototype.readDHT = function(type, pin) {
    assert(type === 11 || type === 22 || type === 33 || type === 44 || type === 55);
    assert(typeof pin === "number", "pin should be a number");
    return this.writeAndWait("DHT " + type + " " + pin + "\n").then(function(args) {
      return {
        temperature: parseFloat(args[0]),
        humidity: parseFloat(args[1])
      };
    });
  };

  Board.prototype.readDstSensors = function(pin) {
    var promise, reading;
    reading = this.writeAndWait("DST " + pin + " sensors\n");
    promise = reading.then(function(args) {
      args.shift();
      return {
        sensors: args
      };
    });
    return promise;
  };

  Board.prototype.readDstSensor = function(pin, address) {
    var promise, reading;
    reading = this.writeAndWait("DST " + pin + " " + address + "\n");
    promise = reading.then(function(args) {
      console.log("readDstSensor: ", args);
      return {
        temperature: parseFloat(args)
      };
    });
    return promise;
  };

  Board.prototype.readDstAll = function(pin) {
    var promise, reading;
    reading = this.writeAndWait("DST " + pin + " all\n");
    promise = reading.then(function(args) {
      console.log("readDstAll args: ", args);
      return {
        temperature: parseFloat(args[0])
      };
    });
    return promise;
  };

  Board.prototype.rfControlStartReceiving = function(pin) {
    assert(typeof pin === "number", "pin should be a number");
    return this.writeAndWait("RF receive " + pin + "\n");
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
    repeats = 7;
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
    return this.writeAndWait("RF send " + pin + " " + repeats + " " + pulseLengthsArgs + " " + pulses + "\n");
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
