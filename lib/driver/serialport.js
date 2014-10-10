var Promise, SerialPort, SerialPortserialPort, events, serialport,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

events = require('events');

serialport = require("serialport");

SerialPort = serialport.SerialPort;

Promise = require('bluebird');

Promise.promisifyAll(SerialPort.prototype);

SerialPortserialPort = (function(_super) {
  __extends(SerialPortserialPort, _super);

  function SerialPortserialPort(port, baudrate) {
    var openImmediately;
    this.serialPort = new SerialPort(port, {
      baudrate: baudrate,
      parser: serialport.parsers.readline("\r\n")
    }, openImmediately = false);
  }

  SerialPortserialPort.prototype.connect = function(timeout, retries) {
    this.ready = false;
    this.serialPort.removeAllListeners('error');
    this.serialPort.removeAllListeners('data');
    this.serialPort.removeAllListeners('close');
    this.serialPort.on('error', (function(_this) {
      return function(error) {
        return _this.emit('error', error);
      };
    })(this));
    this.serialPort.on('close', (function(_this) {
      return function() {
        return _this.emit('close');
      };
    })(this));
    return this.serialPort.openAsync().then((function(_this) {
      return function() {
        var resolver;
        resolver = null;
        _this.serialPort.on("data", function(data) {
          var line;
          console.log(data);
          line = data.replace(/\0/g, '').trim();
          _this.emit('data', line);
          if (line === "ready") {
            _this.ready = true;
            _this.emit('ready');
            return;
          }
          if (!_this.ready) {
            _this.driver.write("RESET\n")["catch"](function(error) {
              return this.emit("error", error);
            });
            return;
          }
          return _this.emit('line', line);
        });
        return new Promise(function(resolve, reject) {
          Promise.delay(1000).then(function() {
            return _this.serialPort.writeAsync("PING\n")["catch"](reject);
          }).done();
          resolver = resolve;
          return _this.once("ready", resolver);
        }).timeout(timeout)["catch"](function(err) {
          _this.removeListener("ready", resolver);
          _this.serialPort.removeAllListeners('data');
          if (err.name === "TimeoutError" && retries > 0) {
            _this.emit('reconnect', err);
            return _this.connect(timeout, retries - 1);
          } else {
            throw err;
          }
        });
      };
    })(this));
  };

  SerialPortserialPort.prototype.disconnect = function() {
    return this.serialPort.closeAsync();
  };

  SerialPortserialPort.prototype.write = function(data) {
    return this.serialPort.writeAsync(data);
  };

  return SerialPortserialPort;

})(events.EventEmitter);

module.exports = SerialPortserialPort;
