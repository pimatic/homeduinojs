var GpioDriver, Promise, events, path, spawn,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

events = require('events');

Promise = require('bluebird');

spawn = require('child_process').spawn;

path = require('path');

GpioDriver = (function(_super) {
  __extends(GpioDriver, _super);

  function GpioDriver(protocolOptions) {
    this.protocolOptions = protocolOptions;
    this.binary = path.resolve(__dirname, '../bin/vhduino');
  }

  GpioDriver.prototype.connect = function(timeout, retries) {
    this.ready = false;
    this.vhduino = spawn(this.binary);
    Promise.promisifyAll(this.vhduino.stdin);
    this.vhduino.stdout.on('data', (function(_this) {
      return function(data) {
        _this.emit('data', line);
        if (line === "ready") {
          _this.ready = true;
          _this.emit('ready');
          return;
        }
        return _this.emit('line', line);
      };
    })(this));
    this.vhduino.stderr.on('data', (function(_this) {
      return function(data) {
        return _this.emit('data', data);
      };
    })(this));
    this.vhduino.on('close', (function(_this) {
      return function(code) {
        return _this.emit('close');
      };
    })(this));
    this.vhduino.on('error', (function(_this) {
      return function(error) {
        return _this.emit('error', error);
      };
    })(this));
    return new Promise((function(_this) {
      return function(resolve, reject) {
        _this.once("ready", resolver);
        return _this.once("error", reject);
      };
    })(this));
  };

  GpioDriver.prototype.disconnect = function() {
    this.vhduino.kill();
    return Promise.resolve();
  };

  GpioDriver.prototype.write = function(data) {
    return this.vhduino.stdin.writeAsyc(data, 'ascii');
  };

  return GpioDriver;

})(events.EventEmitter);

module.exports = SerialPortserialPort;
