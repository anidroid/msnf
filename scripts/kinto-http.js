(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.KintoClient = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
require('whatwg-fetch');
module.exports = self.fetch.bind(self);

},{"whatwg-fetch":5}],3:[function(require,module,exports){
(function (global){

var rng;

if (global.crypto && crypto.getRandomValues) {
  // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
  // Moderately fast, high quality
  var _rnds8 = new Uint8Array(16);
  rng = function whatwgRNG() {
    crypto.getRandomValues(_rnds8);
    return _rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var  _rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return _rnds;
  };
}

module.exports = rng;


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],4:[function(require,module,exports){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

// Unique ID creation requires a high quality random # generator.  We feature
// detect to determine the best RNG source, normalizing to a function that
// returns 128-bits of randomness, since that's what's usually required
var _rng = require('./rng');

// Maps for number <-> hex string conversion
var _byteToHex = [];
var _hexToByte = {};
for (var i = 0; i < 256; i++) {
  _byteToHex[i] = (i + 0x100).toString(16).substr(1);
  _hexToByte[_byteToHex[i]] = i;
}

// **`parse()` - Parse a UUID into it's component bytes**
function parse(s, buf, offset) {
  var i = (buf && offset) || 0, ii = 0;

  buf = buf || [];
  s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
    if (ii < 16) { // Don't overflow!
      buf[i + ii++] = _hexToByte[oct];
    }
  });

  // Zero out remaining bytes if string was short
  while (ii < 16) {
    buf[i + ii++] = 0;
  }

  return buf;
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
function unparse(buf, offset) {
  var i = offset || 0, bth = _byteToHex;
  return  bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html

// random #'s we need to init node and clockseq
var _seedBytes = _rng();

// Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
var _nodeId = [
  _seedBytes[0] | 0x01,
  _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
];

// Per 4.2.2, randomize (14 bit) clockseq
var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

// Previous uuid creation time
var _lastMSecs = 0, _lastNSecs = 0;

// See https://github.com/broofa/node-uuid for API details
function v1(options, buf, offset) {
  var i = buf && offset || 0;
  var b = buf || [];

  options = options || {};

  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq;

  // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime();

  // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock
  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;

  // Time since last uuid creation (in msecs)
  var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

  // Per 4.2.1.2, Bump clockseq on clock regression
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  }

  // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }

  // Per 4.2.1.2 Throw error if too many uuids are requested
  if (nsecs >= 10000) {
    throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;

  // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
  msecs += 12219292800000;

  // `time_low`
  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff;

  // `time_mid`
  var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff;

  // `time_high_and_version`
  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
  b[i++] = tmh >>> 16 & 0xff;

  // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
  b[i++] = clockseq >>> 8 | 0x80;

  // `clock_seq_low`
  b[i++] = clockseq & 0xff;

  // `node`
  var node = options.node || _nodeId;
  for (var n = 0; n < 6; n++) {
    b[i + n] = node[n];
  }

  return buf ? buf : unparse(b);
}

// **`v4()` - Generate random UUID**

// See https://github.com/broofa/node-uuid for API details
function v4(options, buf, offset) {
  // Deprecated - 'format' argument, as supported in v1.2
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || _rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ii++) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || unparse(rnds);
}

// Export public API
var uuid = v4;
uuid.v1 = v1;
uuid.v4 = v4;
uuid.parse = parse;
uuid.unparse = unparse;

module.exports = uuid;

},{"./rng":3}],5:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  Headers.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    reader.readAsArrayBuffer(blob)
    return fileReaderReady(reader)
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    reader.readAsText(blob)
    return fileReaderReady(reader)
  }

  var support = {
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob();
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  function Body() {
    this.bodyUsed = false


    this._initBody = function(body) {
      this._bodyInit = body
      if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (!body) {
        this._bodyText = ''
      } else if (support.arrayBuffer && ArrayBuffer.prototype.isPrototypeOf(body)) {
        // Only support ArrayBuffers for POST method.
        // Receiving ArrayBuffers happens via Blobs, instead.
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        return this.blob().then(readBlobAsArrayBuffer)
      }

      this.text = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      }
    } else {
      this.text = function() {
        var rejected = consumed(this)
        return rejected ? rejected : Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body
    if (Request.prototype.isPrototypeOf(input)) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = input
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this)
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function headers(xhr) {
    var head = new Headers()
    var pairs = xhr.getAllResponseHeaders().trim().split('\n')
    pairs.forEach(function(header) {
      var split = header.trim().split(':')
      var key = split.shift().trim()
      var value = split.join(':').trim()
      head.append(key, value)
    })
    return head
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = options.statusText
    this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers;
  self.Request = Request;
  self.Response = Response;

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request
      if (Request.prototype.isPrototypeOf(input) && !init) {
        request = input
      } else {
        request = new Request(input, init)
      }

      var xhr = new XMLHttpRequest()

      function responseURL() {
        if ('responseURL' in xhr) {
          return xhr.responseURL
        }

        // Avoid security warnings on getResponseHeader when not allowed by CORS
        if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
          return xhr.getResponseHeader('X-Request-URL')
        }

        return;
      }

      xhr.onload = function() {
        var status = (xhr.status === 1223) ? 204 : xhr.status
        if (status < 100 || status > 599) {
          reject(new TypeError('Network request failed'))
          return
        }
        var options = {
          status: status,
          statusText: xhr.statusText,
          headers: headers(xhr),
          url: responseURL()
        }
        var body = 'response' in xhr ? xhr.response : xhr.responseText;
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.SUPPORTED_PROTOCOL_VERSION = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _desc, _value, _class;

var _utils = require("./utils");

var _http = require("./http");

var _http2 = _interopRequireDefault(_http);

var _endpoint = require("./endpoint");

var _endpoint2 = _interopRequireDefault(_endpoint);

var _requests = require("./requests");

var requests = _interopRequireWildcard(_requests);

var _batch = require("./batch");

var _bucket = require("./bucket");

var _bucket2 = _interopRequireDefault(_bucket);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object['ke' + 'ys'](descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object['define' + 'Property'](target, property, desc);
    desc = null;
  }

  return desc;
}

/**
 * Currently supported protocol version.
 * @type {String}
 */
var SUPPORTED_PROTOCOL_VERSION = exports.SUPPORTED_PROTOCOL_VERSION = "v1";

/**
 * High level HTTP client for the Kinto API.
 *
 * @example
 * const client = new KintoClient("https://kinto.dev.mozaws.net/v1");
 * client.bucket("default")
*    .collection("my-blog")
*    .createRecord({title: "First article"})
 *   .then(console.log.bind(console))
 *   .catch(console.error.bind(console));
 */
var KintoClientBase = (_dec = (0, _utils.nobatch)("This operation is not supported within a batch operation."), _dec2 = (0, _utils.nobatch)("This operation is not supported within a batch operation."), _dec3 = (0, _utils.nobatch)("This operation is not supported within a batch operation."), _dec4 = (0, _utils.nobatch)("This operation is not supported within a batch operation."), _dec5 = (0, _utils.nobatch)("Can't use batch within a batch!"), _dec6 = (0, _utils.capable)(["permissions_endpoint"]), _dec7 = (0, _utils.support)("1.4", "2.0"), (_class = function () {
  /**
   * Constructor.
   *
   * @param  {String}       remote  The remote URL.
   * @param  {Object}       [options={}]                  The options object.
   * @param  {Boolean}      [options.safe=true]           Adds concurrency headers to every requests.
   * @param  {EventEmitter} [options.events=EventEmitter] The events handler instance.
   * @param  {Object}       [options.headers={}]          The key-value headers to pass to each request.
   * @param  {String}       [options.bucket="default"]    The default bucket to use.
   * @param  {String}       [options.requestMode="cors"]  The HTTP request mode (from ES6 fetch spec).
   * @param  {Number}       [options.timeout=5000]        The requests timeout in ms.
   */

  function KintoClientBase(remote) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, KintoClientBase);

    if (typeof remote !== "string" || !remote.length) {
      throw new Error("Invalid remote URL: " + remote);
    }
    if (remote[remote.length - 1] === "/") {
      remote = remote.slice(0, -1);
    }
    this._backoffReleaseTime = null;

    /**
     * Default request options container.
     * @private
     * @type {Object}
     */
    this.defaultReqOptions = {
      bucket: options.bucket || "default",
      headers: options.headers || {},
      safe: !!options.safe
    };

    this._options = options;
    this._requests = [];
    this._isBatch = !!options.batch;

    // public properties
    /**
     * The remote server base URL.
     * @type {String}
     */
    this.remote = remote;
    /**
     * Current server information.
     * @ignore
     * @type {Object|null}
     */
    this.serverInfo = null;
    /**
     * The event emitter instance. Should comply with the `EventEmitter`
     * interface.
     * @ignore
     * @type {Class}
     */
    this.events = options.events;

    var requestMode = options.requestMode;
    var timeout = options.timeout;
    /**
     * The HTTP instance.
     * @ignore
     * @type {HTTP}
     */

    this.http = new _http2.default(this.events, { requestMode: requestMode, timeout: timeout });
    this._registerHTTPEvents();
  }

  /**
   * The remote endpoint base URL. Setting the value will also extract and
   * validate the version.
   * @type {String}
   */


  _createClass(KintoClientBase, [{
    key: "_registerHTTPEvents",


    /**
     * Registers HTTP events.
     * @private
     */
    value: function _registerHTTPEvents() {
      var _this = this;

      // Prevent registering event from a batch client instance
      if (!this._isBatch) {
        this.events.on("backoff", function (backoffMs) {
          _this._backoffReleaseTime = backoffMs;
        });
      }
    }

    /**
     * Retrieve a bucket object to perform operations on it.
     *
     * @param  {String}  name              The bucket name.
     * @param  {Object}  [options={}]      The request options.
     * @param  {Boolean} [options.safe]    The resulting safe option.
     * @param  {String}  [options.bucket]  The resulting bucket name option.
     * @param  {Object}  [options.headers] The extended headers object option.
     * @return {Bucket}
     */

  }, {
    key: "bucket",
    value: function bucket(name) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var bucketOptions = (0, _utils.omit)(this._getRequestOptions(options), "bucket");
      return new _bucket2.default(this, name, bucketOptions);
    }

    /**
     * Generates a request options object, deeply merging the client configured
     * defaults with the ones provided as argument.
     *
     * Note: Headers won't be overriden but merged with instance default ones.
     *
     * @private
     * @param    {Object}  [options={}]      The request options.
     * @property {Boolean} [options.safe]    The resulting safe option.
     * @property {String}  [options.bucket]  The resulting bucket name option.
     * @property {Object}  [options.headers] The extended headers object option.
     * @return   {Object}
     */

  }, {
    key: "_getRequestOptions",
    value: function _getRequestOptions() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return _extends({}, this.defaultReqOptions, options, {
        batch: this._isBatch,
        // Note: headers should never be overriden but extended
        headers: _extends({}, this.defaultReqOptions.headers, options.headers)
      });
    }

    /**
     * Retrieves server information and persist them locally. This operation is
     * usually performed a single time during the instance lifecycle.
     *
     * @param  {Object}  [options={}] The request options.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "fetchServerInfo",
    value: function fetchServerInfo() {
      var _this2 = this;

      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      if (this.serverInfo) {
        return Promise.resolve(this.serverInfo);
      }
      return this.http.request(this.remote + (0, _endpoint2.default)("root"), {
        headers: _extends({}, this.defaultReqOptions.headers, options.headers)
      }).then(function (_ref) {
        var json = _ref.json;

        _this2.serverInfo = json;
        return _this2.serverInfo;
      });
    }

    /**
     * Retrieves Kinto server settings.
     *
     * @param  {Object}  [options={}] The request options.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "fetchServerSettings",
    value: function fetchServerSettings() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.fetchServerInfo(options).then(function (_ref2) {
        var settings = _ref2.settings;
        return settings;
      });
    }

    /**
     * Retrieve server capabilities information.
     *
     * @param  {Object}  [options={}] The request options.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "fetchServerCapabilities",
    value: function fetchServerCapabilities() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.fetchServerInfo(options).then(function (_ref3) {
        var capabilities = _ref3.capabilities;
        return capabilities;
      });
    }

    /**
     * Retrieve authenticated user information.
     *
     * @param  {Object}  [options={}] The request options.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "fetchUser",
    value: function fetchUser() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.fetchServerInfo(options).then(function (_ref4) {
        var user = _ref4.user;
        return user;
      });
    }

    /**
     * Retrieve authenticated user information.
     *
     * @param  {Object}  [options={}] The request options.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "fetchHTTPApiVersion",
    value: function fetchHTTPApiVersion() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.fetchServerInfo(options).then(function (_ref5) {
        var http_api_version = _ref5.http_api_version;

        return http_api_version;
      });
    }

    /**
     * Process batch requests, chunking them according to the batch_max_requests
     * server setting when needed.
     *
     * @param  {Array}  requests     The list of batch subrequests to perform.
     * @param  {Object} [options={}] The options object.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "_batchRequests",
    value: function _batchRequests(requests) {
      var _this3 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var headers = _extends({}, this.defaultReqOptions.headers, options.headers);
      if (!requests.length) {
        return Promise.resolve([]);
      }
      return this.fetchServerSettings().then(function (serverSettings) {
        var maxRequests = serverSettings["batch_max_requests"];
        if (maxRequests && requests.length > maxRequests) {
          var chunks = (0, _utils.partition)(requests, maxRequests);
          return (0, _utils.pMap)(chunks, function (chunk) {
            return _this3._batchRequests(chunk, options);
          });
        }
        return _this3.execute({
          path: (0, _endpoint2.default)("batch"),
          method: "POST",
          headers: headers,
          body: {
            defaults: { headers: headers },
            requests: requests
          }
        })
        // we only care about the responses
        .then(function (_ref6) {
          var responses = _ref6.responses;
          return responses;
        });
      });
    }

    /**
     * Sends batch requests to the remote server.
     *
     * Note: Reserved for internal use only.
     *
     * @ignore
     * @param  {Function} fn                        The function to use for describing batch ops.
     * @param  {Object}   [options={}]              The options object.
     * @param  {Boolean}  [options.safe]            The safe option.
     * @param  {String}   [options.bucket]          The bucket name option.
     * @param  {String}   [options.collection]      The collection name option.
     * @param  {Object}   [options.headers]         The headers object option.
     * @param  {Boolean}  [options.aggregate=false] Produces an aggregated result object.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "batch",
    value: function batch(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var rootBatch = new KintoClientBase(this.remote, _extends({}, this._options, this._getRequestOptions(options), {
        batch: true
      }));
      var bucketBatch = void 0,
          collBatch = void 0;
      if (options.bucket) {
        bucketBatch = rootBatch.bucket(options.bucket);
        if (options.collection) {
          collBatch = bucketBatch.collection(options.collection);
        }
      }
      var batchClient = collBatch || bucketBatch || rootBatch;
      try {
        fn(batchClient);
      } catch (err) {
        return Promise.reject(err);
      }
      return this._batchRequests(rootBatch._requests, options).then(function (responses) {
        if (options.aggregate) {
          return (0, _batch.aggregate)(responses, rootBatch._requests);
        }
        return responses;
      });
    }

    /**
     * Executes an atomic HTTP request.
     *
     * @private
     * @param  {Object}  request             The request object.
     * @param  {Object}  [options={}]        The options object.
     * @param  {Boolean} [options.raw=false] If true, resolve with full response
     * @param  {Boolean} [options.stringify=true] If true, serialize body data to
     * JSON.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "execute",
    value: function execute(request) {
      var _this4 = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? { raw: false, stringify: true } : arguments[1];
      var raw = options.raw;
      var stringify = options.stringify;
      // If we're within a batch, add the request to the stack to send at once.

      if (this._isBatch) {
        this._requests.push(request);
        // Resolve with a message in case people attempt at consuming the result
        // from within a batch operation.
        var msg = "This result is generated from within a batch " + "operation and should not be consumed.";
        return Promise.resolve(raw ? { json: msg, headers: {
            get: function get() {}
          } } : msg);
      }
      var promise = this.fetchServerSettings().then(function (_) {
        return _this4.http.request(_this4.remote + request.path, _extends({}, request, {
          body: stringify ? JSON.stringify(request.body) : request.body
        }));
      });
      return raw ? promise : promise.then(function (_ref7) {
        var json = _ref7.json;
        return json;
      });
    }
  }, {
    key: "paginatedList",
    value: function paginatedList(path, params) {
      var _this5 = this;

      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var _sort$params = _extends({
        sort: "-last_modified"
      }, params);

      var sort = _sort$params.sort;
      var filters = _sort$params.filters;
      var limit = _sort$params.limit;
      var pages = _sort$params.pages;
      var since = _sort$params.since;
      // Safety/Consistency check on ETag value.

      if (since && typeof since !== "string") {
        throw new Error("Invalid value for since (" + since + "), should be ETag value.");
      }

      var querystring = (0, _utils.qsify)(_extends({}, filters, {
        _sort: sort,
        _limit: limit,
        _since: since
      }));
      var results = [],
          current = 0;

      var next = function next(nextPage) {
        if (!nextPage) {
          throw new Error("Pagination exhausted.");
        }
        return processNextPage(nextPage);
      };

      var processNextPage = function processNextPage(nextPage) {
        var headers = options.headers;

        return _this5.http.request(nextPage, { headers: headers }).then(handleResponse);
      };

      var pageResults = function pageResults(results, nextPage, etag, totalRecords) {
        // ETag string is supposed to be opaque and stored «as-is».
        // ETag header values are quoted (because of * and W/"foo").
        return {
          last_modified: etag ? etag.replace(/"/g, "") : etag,
          data: results,
          next: next.bind(null, nextPage),
          hasNextPage: !!nextPage,
          totalRecords: totalRecords
        };
      };

      var handleResponse = function handleResponse(_ref8) {
        var headers = _ref8.headers;
        var json = _ref8.json;

        var nextPage = headers.get("Next-Page");
        var etag = headers.get("ETag");
        var totalRecords = parseInt(headers.get("Total-Records"), 10);

        if (!pages) {
          return pageResults(json.data, nextPage, etag, totalRecords);
        }
        // Aggregate new results with previous ones
        results = results.concat(json.data);
        current += 1;
        if (current >= pages || !nextPage) {
          // Pagination exhausted
          return pageResults(results, nextPage, etag, totalRecords);
        }
        // Follow next page
        return processNextPage(nextPage);
      };

      return this.execute(_extends({
        path: path + "?" + querystring
      }, options), { raw: true }).then(handleResponse);
    }

    /**
     * Lists all permissions.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object[], Error>}
     */

  }, {
    key: "listPermissions",
    value: function listPermissions() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.execute({
        path: (0, _endpoint2.default)("permissions"),
        headers: _extends({}, this.defaultReqOptions.headers, options.headers)
      });
    }

    /**
     * Retrieves the list of buckets.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object[], Error>}
     */

  }, {
    key: "listBuckets",
    value: function listBuckets() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var path = (0, _endpoint2.default)("bucket");
      var reqOptions = this._getRequestOptions(options);
      return this.paginatedList(path, options, reqOptions);
    }

    /**
     * Creates a new bucket on the server.
     *
     * @param  {String}   id                The bucket name.
     * @param  {Object}   [options={}]      The options object.
     * @param  {Boolean}  [options.data]    The bucket data option.
     * @param  {Boolean}  [options.safe]    The safe option.
     * @param  {Object}   [options.headers] The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "createBucket",
    value: function createBucket(id) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!id) {
        throw new Error("A bucket id is required.");
      }
      // Note that we simply ignore any "bucket" option passed here, as the one
      // we're interested in is the one provided as a required argument.
      var reqOptions = this._getRequestOptions(options);
      var _reqOptions$data = reqOptions.data;
      var data = _reqOptions$data === undefined ? {} : _reqOptions$data;
      var permissions = reqOptions.permissions;

      data.id = id;
      var path = (0, _endpoint2.default)("bucket", id);
      return this.execute(requests.createRequest(path, { data: data, permissions: permissions }, reqOptions));
    }

    /**
     * Deletes a bucket from the server.
     *
     * @ignore
     * @param  {Object|String} bucket                  The bucket to delete.
     * @param  {Object}        [options={}]            The options object.
     * @param  {Boolean}       [options.safe]          The safe option.
     * @param  {Object}        [options.headers]       The headers object option.
     * @param  {Number}        [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "deleteBucket",
    value: function deleteBucket(bucket) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var bucketObj = (0, _utils.toDataBody)(bucket);
      if (!bucketObj.id) {
        throw new Error("A bucket id is required.");
      }
      var path = (0, _endpoint2.default)("bucket", bucketObj.id);
      var _bucketObj = { bucketObj: bucketObj };
      var last_modified = _bucketObj.last_modified;

      var reqOptions = this._getRequestOptions(_extends({ last_modified: last_modified }, options));
      return this.execute(requests.deleteRequest(path, reqOptions));
    }

    /**
     * Deletes all buckets on the server.
     *
     * @ignore
     * @param  {Object}  [options={}]            The options object.
     * @param  {Boolean} [options.safe]          The safe option.
     * @param  {Object}  [options.headers]       The headers object option.
     * @param  {Number}  [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "deleteBuckets",
    value: function deleteBuckets() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var reqOptions = this._getRequestOptions(options);
      var path = (0, _endpoint2.default)("bucket");
      return this.execute(requests.deleteRequest(path, reqOptions));
    }
  }, {
    key: "remote",
    get: function get() {
      return this._remote;
    }

    /**
     * @ignore
     */
    ,
    set: function set(url) {
      var version = void 0;
      try {
        version = url.match(/\/(v\d+)\/?$/)[1];
      } catch (err) {
        throw new Error("The remote URL must contain the version: " + url);
      }
      if (version !== SUPPORTED_PROTOCOL_VERSION) {
        throw new Error("Unsupported protocol version: " + version);
      }
      this._remote = url;
      this._version = version;
    }

    /**
     * The current server protocol version, eg. `v1`.
     * @type {String}
     */

  }, {
    key: "version",
    get: function get() {
      return this._version;
    }

    /**
     * Backoff remaining time, in milliseconds. Defaults to zero if no backoff is
     * ongoing.
     *
     * @type {Number}
     */

  }, {
    key: "backoff",
    get: function get() {
      var currentTime = new Date().getTime();
      if (this._backoffReleaseTime && currentTime < this._backoffReleaseTime) {
        return this._backoffReleaseTime - currentTime;
      }
      return 0;
    }
  }]);

  return KintoClientBase;
}(), (_applyDecoratedDescriptor(_class.prototype, "fetchServerSettings", [_dec], Object.getOwnPropertyDescriptor(_class.prototype, "fetchServerSettings"), _class.prototype), _applyDecoratedDescriptor(_class.prototype, "fetchServerCapabilities", [_dec2], Object.getOwnPropertyDescriptor(_class.prototype, "fetchServerCapabilities"), _class.prototype), _applyDecoratedDescriptor(_class.prototype, "fetchUser", [_dec3], Object.getOwnPropertyDescriptor(_class.prototype, "fetchUser"), _class.prototype), _applyDecoratedDescriptor(_class.prototype, "fetchHTTPApiVersion", [_dec4], Object.getOwnPropertyDescriptor(_class.prototype, "fetchHTTPApiVersion"), _class.prototype), _applyDecoratedDescriptor(_class.prototype, "batch", [_dec5], Object.getOwnPropertyDescriptor(_class.prototype, "batch"), _class.prototype), _applyDecoratedDescriptor(_class.prototype, "listPermissions", [_dec6], Object.getOwnPropertyDescriptor(_class.prototype, "listPermissions"), _class.prototype), _applyDecoratedDescriptor(_class.prototype, "deleteBuckets", [_dec7], Object.getOwnPropertyDescriptor(_class.prototype, "deleteBuckets"), _class.prototype)), _class));
exports.default = KintoClientBase;

},{"./batch":7,"./bucket":8,"./endpoint":10,"./http":12,"./requests":14,"./utils":15}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.aggregate = aggregate;
/**
 * Exports batch responses as a result object.
 *
 * @private
 * @param  {Array} responses The batch subrequest responses.
 * @param  {Array} requests  The initial issued requests.
 * @return {Object}
 */
function aggregate() {
  var responses = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
  var requests = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

  if (responses.length !== requests.length) {
    throw new Error("Responses length should match requests one.");
  }
  var results = {
    errors: [],
    published: [],
    conflicts: [],
    skipped: []
  };
  return responses.reduce(function (acc, response, index) {
    var status = response.status;

    if (status >= 200 && status < 400) {
      acc.published.push(response.body);
    } else if (status === 404) {
      acc.skipped.push(response.body);
    } else if (status === 412) {
      acc.conflicts.push({
        // XXX: specifying the type is probably superfluous
        type: "outgoing",
        local: requests[index].body,
        remote: response.body.details && response.body.details.existing || null
      });
    } else {
      acc.errors.push({
        path: response.path,
        sent: requests[index],
        error: response.body
      });
    }
    return acc;
  }, results);
}

},{}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dec, _desc, _value, _class;

var _utils = require("./utils");

var _collection = require("./collection");

var _collection2 = _interopRequireDefault(_collection);

var _requests = require("./requests");

var requests = _interopRequireWildcard(_requests);

var _endpoint = require("./endpoint");

var _endpoint2 = _interopRequireDefault(_endpoint);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object['ke' + 'ys'](descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object['define' + 'Property'](target, property, desc);
    desc = null;
  }

  return desc;
}

/**
 * Abstract representation of a selected bucket.
 *
 */
var Bucket = (_dec = (0, _utils.capable)(["history"]), (_class = function () {
  /**
   * Constructor.
   *
   * @param  {KintoClient} client            The client instance.
   * @param  {String}      name              The bucket name.
   * @param  {Object}      [options={}]      The headers object option.
   * @param  {Object}      [options.headers] The headers object option.
   * @param  {Boolean}     [options.safe]    The safe option.
   */

  function Bucket(client, name) {
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    _classCallCheck(this, Bucket);

    /**
     * @ignore
     */
    this.client = client;
    /**
     * The bucket name.
     * @type {String}
     */
    this.name = name;
    /**
     * The default options object.
     * @ignore
     * @type {Object}
     */
    this.options = options;
    /**
     * @ignore
     */
    this._isBatch = !!options.batch;
  }

  /**
   * Merges passed request options with default bucket ones, if any.
   *
   * @private
   * @param  {Object} [options={}] The options to merge.
   * @return {Object}              The merged options.
   */


  _createClass(Bucket, [{
    key: "_bucketOptions",
    value: function _bucketOptions() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var headers = _extends({}, this.options && this.options.headers, options.headers);
      return _extends({}, this.options, options, {
        headers: headers,
        bucket: this.name,
        batch: this._isBatch
      });
    }

    /**
     * Selects a collection.
     *
     * @param  {String}  name              The collection name.
     * @param  {Object}  [options={}]      The options object.
     * @param  {Object}  [options.headers] The headers object option.
     * @param  {Boolean} [options.safe]    The safe option.
     * @return {Collection}
     */

  }, {
    key: "collection",
    value: function collection(name) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return new _collection2.default(this.client, this, name, this._bucketOptions(options));
    }

    /**
     * Retrieves bucket data.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "getData",
    value: function getData() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.client.execute({
        path: (0, _endpoint2.default)("bucket", this.name),
        headers: _extends({}, this.options.headers, options.headers)
      }).then(function (res) {
        return res.data;
      });
    }

    /**
     * Set bucket data.
     * @param  {Object}  data                    The bucket data object.
     * @param  {Object}  [options={}]            The options object.
     * @param  {Object}  [options.headers]       The headers object option.
     * @param  {Boolean} [options.safe]          The safe option.
     * @param  {Boolean} [options.patch]         The patch option.
     * @param  {Number}  [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "setData",
    value: function setData(data) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!(0, _utils.isObject)(data)) {
        throw new Error("A bucket object is required.");
      }

      var bucket = _extends({}, data, { id: this.name });

      // For default bucket, we need to drop the id from the data object.
      // Bug in Kinto < 3.1.1
      var bucketId = bucket.id;
      if (bucket.id === "default") {
        delete bucket.id;
      }

      var path = (0, _endpoint2.default)("bucket", bucketId);
      var permissions = options.permissions;

      var reqOptions = _extends({}, this._bucketOptions(options));
      var request = requests.updateRequest(path, { data: bucket, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Retrieves the list of history entries in the current bucket.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Array<Object>, Error>}
     */

  }, {
    key: "listHistory",
    value: function listHistory() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var path = (0, _endpoint2.default)("history", this.name);
      var reqOptions = this._bucketOptions(options);
      return this.client.paginatedList(path, options, reqOptions);
    }

    /**
     * Retrieves the list of collections in the current bucket.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Array<Object>, Error>}
     */

  }, {
    key: "listCollections",
    value: function listCollections() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var path = (0, _endpoint2.default)("collection", this.name);
      var reqOptions = this._bucketOptions(options);
      return this.client.paginatedList(path, options, reqOptions);
    }

    /**
     * Creates a new collection in current bucket.
     *
     * @param  {String|undefined}  id          The collection id.
     * @param  {Object}  [options={}]          The options object.
     * @param  {Boolean} [options.safe]        The safe option.
     * @param  {Object}  [options.headers]     The headers object option.
     * @param  {Object}  [options.permissions] The permissions object.
     * @param  {Object}  [options.data]        The data object.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "createCollection",
    value: function createCollection(id) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var reqOptions = this._bucketOptions(options);
      var permissions = reqOptions.permissions;
      var _reqOptions$data = reqOptions.data;
      var data = _reqOptions$data === undefined ? {} : _reqOptions$data;

      data.id = id;
      var path = (0, _endpoint2.default)("collection", this.name, id);
      var request = requests.createRequest(path, { data: data, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Deletes a collection from the current bucket.
     *
     * @param  {Object|String} collection              The collection to delete.
     * @param  {Object}        [options={}]            The options object.
     * @param  {Object}        [options.headers]       The headers object option.
     * @param  {Boolean}       [options.safe]          The safe option.
     * @param  {Number}        [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "deleteCollection",
    value: function deleteCollection(collection) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var collectionObj = (0, _utils.toDataBody)(collection);
      if (!collectionObj.id) {
        throw new Error("A collection id is required.");
      }
      var id = collectionObj.id;
      var last_modified = collectionObj.last_modified;

      var reqOptions = this._bucketOptions(_extends({ last_modified: last_modified }, options));
      var path = (0, _endpoint2.default)("collection", this.name, id);
      var request = requests.deleteRequest(path, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Retrieves the list of groups in the current bucket.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Array<Object>, Error>}
     */

  }, {
    key: "listGroups",
    value: function listGroups() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var path = (0, _endpoint2.default)("group", this.name);
      var reqOptions = this._bucketOptions(options);
      return this.client.paginatedList(path, options, reqOptions);
    }

    /**
     * Creates a new group in current bucket.
     *
     * @param  {String} id                The group id.
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "getGroup",
    value: function getGroup(id) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return this.client.execute({
        path: (0, _endpoint2.default)("group", this.name, id),
        headers: _extends({}, this.options.headers, options.headers)
      });
    }

    /**
     * Creates a new group in current bucket.
     *
     * @param  {String|undefined}  id                    The group id.
     * @param  {Array<String>}     [members=[]]          The list of principals.
     * @param  {Object}            [options={}]          The options object.
     * @param  {Object}            [options.data]        The data object.
     * @param  {Object}            [options.permissions] The permissions object.
     * @param  {Boolean}           [options.safe]        The safe option.
     * @param  {Object}            [options.headers]     The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "createGroup",
    value: function createGroup(id) {
      var members = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var reqOptions = this._bucketOptions(options);
      var data = _extends({}, options.data, {
        id: id,
        members: members
      });
      var path = (0, _endpoint2.default)("group", this.name, id);
      var permissions = options.permissions;

      var request = requests.createRequest(path, { data: data, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Updates an existing group in current bucket.
     *
     * @param  {Object}  group                   The group object.
     * @param  {Object}  [options={}]            The options object.
     * @param  {Object}  [options.data]          The data object.
     * @param  {Object}  [options.permissions]   The permissions object.
     * @param  {Boolean} [options.safe]          The safe option.
     * @param  {Object}  [options.headers]       The headers object option.
     * @param  {Number}  [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "updateGroup",
    value: function updateGroup(group) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!(0, _utils.isObject)(group)) {
        throw new Error("A group object is required.");
      }
      if (!group.id) {
        throw new Error("A group id is required.");
      }
      var reqOptions = this._bucketOptions(options);
      var data = _extends({}, options.data, group);
      var path = (0, _endpoint2.default)("group", this.name, group.id);
      var permissions = options.permissions;

      var request = requests.updateRequest(path, { data: data, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Deletes a group from the current bucket.
     *
     * @param  {Object|String} group                   The group to delete.
     * @param  {Object}        [options={}]            The options object.
     * @param  {Object}        [options.headers]       The headers object option.
     * @param  {Boolean}       [options.safe]          The safe option.
     * @param  {Number}        [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "deleteGroup",
    value: function deleteGroup(group) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var groupObj = (0, _utils.toDataBody)(group);
      var id = groupObj.id;
      var last_modified = groupObj.last_modified;

      var reqOptions = this._bucketOptions(_extends({ last_modified: last_modified }, options));
      var path = (0, _endpoint2.default)("group", this.name, id);
      var request = requests.deleteRequest(path, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Retrieves the list of permissions for this bucket.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "getPermissions",
    value: function getPermissions() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      return this.client.execute({
        path: (0, _endpoint2.default)("bucket", this.name),
        headers: _extends({}, this.options.headers, options.headers)
      }).then(function (res) {
        return res.permissions;
      });
    }

    /**
     * Replaces all existing bucket permissions with the ones provided.
     *
     * @param  {Object}  permissions             The permissions object.
     * @param  {Object}  [options={}]            The options object
     * @param  {Boolean} [options.safe]          The safe option.
     * @param  {Object}  [options.headers]       The headers object option.
     * @param  {Object}  [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "setPermissions",
    value: function setPermissions(permissions) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!(0, _utils.isObject)(permissions)) {
        throw new Error("A permissions object is required.");
      }
      var path = (0, _endpoint2.default)("bucket", this.name);
      var reqOptions = _extends({}, this._bucketOptions(options));
      var last_modified = options.last_modified;

      var data = { last_modified: last_modified };
      var request = requests.updateRequest(path, { data: data, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Performs batch operations at the current bucket level.
     *
     * @param  {Function} fn                   The batch operation function.
     * @param  {Object}   [options={}]         The options object.
     * @param  {Object}   [options.headers]    The headers object option.
     * @param  {Boolean}  [options.safe]       The safe option.
     * @param  {Boolean}  [options.aggregate]  Produces a grouped result object.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "batch",
    value: function batch(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return this.client.batch(fn, this._bucketOptions(options));
    }
  }]);

  return Bucket;
}(), (_applyDecoratedDescriptor(_class.prototype, "listHistory", [_dec], Object.getOwnPropertyDescriptor(_class.prototype, "listHistory"), _class.prototype)), _class));
exports.default = Bucket;

},{"./collection":9,"./endpoint":10,"./requests":14,"./utils":15}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _dec, _dec2, _desc, _value, _class;

var _uuid = require("uuid");

var _utils = require("./utils");

var _requests = require("./requests");

var requests = _interopRequireWildcard(_requests);

var _endpoint = require("./endpoint");

var _endpoint2 = _interopRequireDefault(_endpoint);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object['ke' + 'ys'](descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object['define' + 'Property'](target, property, desc);
    desc = null;
  }

  return desc;
}

/**
 * Abstract representation of a selected collection.
 *
 */
var Collection = (_dec = (0, _utils.capable)(["attachments"]), _dec2 = (0, _utils.capable)(["attachments"]), (_class = function () {
  /**
   * Constructor.
   *
   * @param  {KintoClient}  client            The client instance.
   * @param  {Bucket}       bucket            The bucket instance.
   * @param  {String}       name              The collection name.
   * @param  {Object}       [options={}]      The options object.
   * @param  {Object}       [options.headers] The headers object option.
   * @param  {Boolean}      [options.safe]    The safe option.
   */

  function Collection(client, bucket, name) {
    var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

    _classCallCheck(this, Collection);

    /**
     * @ignore
     */
    this.client = client;
    /**
     * @ignore
     */
    this.bucket = bucket;
    /**
     * The collection name.
     * @type {String}
     */
    this.name = name;

    /**
     * The default collection options object, embedding the default bucket ones.
     * @ignore
     * @type {Object}
     */
    this.options = _extends({}, this.bucket.options, options, {
      headers: _extends({}, this.bucket.options && this.bucket.options.headers, options.headers)
    });
    /**
     * @ignore
     */
    this._isBatch = !!options.batch;
  }

  /**
   * Merges passed request options with default bucket and collection ones, if
   * any.
   *
   * @private
   * @param  {Object} [options={}] The options to merge.
   * @return {Object}              The merged options.
   */


  _createClass(Collection, [{
    key: "_collOptions",
    value: function _collOptions() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var headers = _extends({}, this.options && this.options.headers, options.headers);
      return _extends({}, this.options, options, {
        headers: headers
      });
    }

    /**
     * Retrieves the total number of records in this collection.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Number, Error>}
     */

  }, {
    key: "getTotalRecords",
    value: function getTotalRecords() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var _collOptions2 = this._collOptions(options);

      var headers = _collOptions2.headers;

      return this.client.execute({
        method: "HEAD",
        path: (0, _endpoint2.default)("record", this.bucket.name, this.name),
        headers: headers
      }, { raw: true }).then(function (_ref) {
        var headers = _ref.headers;
        return parseInt(headers.get("Total-Records"), 10);
      });
    }

    /**
     * Retrieves collection data.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "getData",
    value: function getData() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var _collOptions3 = this._collOptions(options);

      var headers = _collOptions3.headers;

      return this.client.execute({
        path: (0, _endpoint2.default)("collection", this.bucket.name, this.name),
        headers: headers
      }).then(function (res) {
        return res.data;
      });
    }

    /**
     * Set collection data.
     * @param  {Object}   data                    The collection data object.
     * @param  {Object}   [options={}]            The options object.
     * @param  {Object}   [options.headers]       The headers object option.
     * @param  {Boolean}  [options.safe]          The safe option.
     * @param  {Boolean}  [options.patch]         The patch option.
     * @param  {Number}   [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "setData",
    value: function setData(data) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!(0, _utils.isObject)(data)) {
        throw new Error("A collection object is required.");
      }
      var reqOptions = this._collOptions(options);
      var permissions = reqOptions.permissions;


      var path = (0, _endpoint2.default)("collection", this.bucket.name, this.name);
      var request = requests.updateRequest(path, { data: data, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Retrieves the list of permissions for this collection.
     *
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "getPermissions",
    value: function getPermissions() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var _collOptions4 = this._collOptions(options);

      var headers = _collOptions4.headers;

      return this.client.execute({
        path: (0, _endpoint2.default)("collection", this.bucket.name, this.name),
        headers: headers
      }).then(function (res) {
        return res.permissions;
      });
    }

    /**
     * Replaces all existing collection permissions with the ones provided.
     *
     * @param  {Object}   permissions             The permissions object.
     * @param  {Object}   [options={}]            The options object
     * @param  {Object}   [options.headers]       The headers object option.
     * @param  {Boolean}  [options.safe]          The safe option.
     * @param  {Number}   [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "setPermissions",
    value: function setPermissions(permissions) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!(0, _utils.isObject)(permissions)) {
        throw new Error("A permissions object is required.");
      }
      var reqOptions = this._collOptions(options);
      var path = (0, _endpoint2.default)("collection", this.bucket.name, this.name);
      var data = { last_modified: options.last_modified };
      var request = requests.updateRequest(path, { data: data, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Creates a record in current collection.
     *
     * @param  {Object}  record                The record to create.
     * @param  {Object}  [options={}]          The options object.
     * @param  {Object}  [options.headers]     The headers object option.
     * @param  {Boolean} [options.safe]        The safe option.
     * @param  {Object}  [options.permissions] The permissions option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "createRecord",
    value: function createRecord(record) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var reqOptions = this._collOptions(options);
      var permissions = reqOptions.permissions;

      var path = (0, _endpoint2.default)("record", this.bucket.name, this.name, record.id);
      var request = requests.createRequest(path, { data: record, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Adds an attachment to a record, creating the record when it doesn't exist.
     *
     * @param  {String}  dataURL                 The data url.
     * @param  {Object}  [record={}]             The record data.
     * @param  {Object}  [options={}]            The options object.
     * @param  {Object}  [options.headers]       The headers object option.
     * @param  {Boolean} [options.safe]          The safe option.
     * @param  {Number}  [options.last_modified] The last_modified option.
     * @param  {Object}  [options.permissions]   The permissions option.
     * @param  {String}  [options.filename]      Force the attachment filename.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "addAttachment",
    value: function addAttachment(dataURI) {
      var _this = this;

      var record = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      var reqOptions = this._collOptions(options);
      var permissions = reqOptions.permissions;

      var id = record.id || _uuid.v4.v4();
      var path = (0, _endpoint2.default)("attachment", this.bucket.name, this.name, id);
      var addAttachmentRequest = requests.addAttachmentRequest(path, dataURI, {
        data: record,
        permissions: permissions
      }, reqOptions);
      return this.client.execute(addAttachmentRequest, { stringify: false }).then(function () {
        return _this.getRecord(id);
      });
    }

    /**
     * Removes an attachment from a given record.
     *
     * @param  {Object}  recordId                The record id.
     * @param  {Object}  [options={}]            The options object.
     * @param  {Object}  [options.headers]       The headers object option.
     * @param  {Boolean} [options.safe]          The safe option.
     * @param  {Number}  [options.last_modified] The last_modified option.
     */

  }, {
    key: "removeAttachment",
    value: function removeAttachment(recordId) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var reqOptions = this._collOptions(options);
      var path = (0, _endpoint2.default)("attachment", this.bucket.name, this.name, recordId);
      var request = requests.deleteRequest(path, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Updates a record in current collection.
     *
     * @param  {Object}  record                  The record to update.
     * @param  {Object}  [options={}]            The options object.
     * @param  {Object}  [options.headers]       The headers object option.
     * @param  {Boolean} [options.safe]          The safe option.
     * @param  {Number}  [options.last_modified] The last_modified option.
     * @param  {Object}  [options.permissions]   The permissions option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "updateRecord",
    value: function updateRecord(record) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      if (!(0, _utils.isObject)(record)) {
        throw new Error("A record object is required.");
      }
      if (!record.id) {
        throw new Error("A record id is required.");
      }
      var reqOptions = this._collOptions(options);
      var permissions = reqOptions.permissions;

      var path = (0, _endpoint2.default)("record", this.bucket.name, this.name, record.id);
      var request = requests.updateRequest(path, { data: record, permissions: permissions }, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Deletes a record from the current collection.
     *
     * @param  {Object|String} record                  The record to delete.
     * @param  {Object}        [options={}]            The options object.
     * @param  {Object}        [options.headers]       The headers object option.
     * @param  {Boolean}       [options.safe]          The safe option.
     * @param  {Number}        [options.last_modified] The last_modified option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "deleteRecord",
    value: function deleteRecord(record) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var recordObj = (0, _utils.toDataBody)(record);
      if (!recordObj.id) {
        throw new Error("A record id is required.");
      }
      var id = recordObj.id;
      var last_modified = recordObj.last_modified;

      var reqOptions = this._collOptions(_extends({ last_modified: last_modified }, options));
      var path = (0, _endpoint2.default)("record", this.bucket.name, this.name, id);
      var request = requests.deleteRequest(path, reqOptions);
      return this.client.execute(request);
    }

    /**
     * Retrieves a record from the current collection.
     *
     * @param  {String} id                The record id to retrieve.
     * @param  {Object} [options={}]      The options object.
     * @param  {Object} [options.headers] The headers object option.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "getRecord",
    value: function getRecord(id) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return this.client.execute(_extends({
        path: (0, _endpoint2.default)("record", this.bucket.name, this.name, id)
      }, this._collOptions(options)));
    }

    /**
     * Lists records from the current collection.
     *
     * Sorting is done by passing a `sort` string option:
     *
     * - The field to order the results by, prefixed with `-` for descending.
     * Default: `-last_modified`.
     *
     * @see http://kinto.readthedocs.io/en/stable/api/1.x/sorting.html
     *
     * Filtering is done by passing a `filters` option object:
     *
     * - `{fieldname: "value"}`
     * - `{min_fieldname: 4000}`
     * - `{in_fieldname: "1,2,3"}`
     * - `{not_fieldname: 0}`
     * - `{exclude_fieldname: "0,1"}`
     *
     * @see http://kinto.readthedocs.io/en/stable/api/1.x/filtering.html
     *
     * Paginating is done by passing a `limit` option, then calling the `next()`
     * method from the resolved result object to fetch the next page, if any.
     *
     * @param  {Object}   [options={}]                    The options object.
     * @param  {Object}   [options.headers]               The headers object option.
     * @param  {Object}   [options.filters=[]]            The filters object.
     * @param  {String}   [options.sort="-last_modified"] The sort field.
     * @param  {String}   [options.limit=null]            The limit field.
     * @param  {String}   [options.pages=1]               The number of result pages to aggregate.
     * @param  {Number}   [options.since=null]            Only retrieve records modified since the provided timestamp.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "listRecords",
    value: function listRecords() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var path = (0, _endpoint2.default)("record", this.bucket.name, this.name);
      var reqOptions = this._collOptions(options);
      return this.client.paginatedList(path, options, reqOptions);
    }

    /**
     * Performs batch operations at the current collection level.
     *
     * @param  {Function} fn                   The batch operation function.
     * @param  {Object}   [options={}]         The options object.
     * @param  {Object}   [options.headers]    The headers object option.
     * @param  {Boolean}  [options.safe]       The safe option.
     * @param  {Boolean}  [options.aggregate]  Produces a grouped result object.
     * @return {Promise<Object, Error>}
     */

  }, {
    key: "batch",
    value: function batch(fn) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var reqOptions = this._collOptions(options);
      return this.client.batch(fn, _extends({}, reqOptions, {
        bucket: this.bucket.name,
        collection: this.name
      }));
    }
  }]);

  return Collection;
}(), (_applyDecoratedDescriptor(_class.prototype, "addAttachment", [_dec], Object.getOwnPropertyDescriptor(_class.prototype, "addAttachment"), _class.prototype), _applyDecoratedDescriptor(_class.prototype, "removeAttachment", [_dec2], Object.getOwnPropertyDescriptor(_class.prototype, "removeAttachment"), _class.prototype)), _class));
exports.default = Collection;

},{"./endpoint":10,"./requests":14,"./utils":15,"uuid":4}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = endpoint;
/**
 * Endpoints templates.
 * @type {Object}
 */
var ENDPOINTS = {
  root: function root() {
    return "/";
  },
  batch: function batch() {
    return "/batch";
  },
  permissions: function permissions() {
    return "/permissions";
  },
  bucket: function bucket(_bucket) {
    return "/buckets" + (_bucket ? "/" + _bucket : "");
  },
  history: function history(bucket) {
    return ENDPOINTS.bucket(bucket) + "/history";
  },
  collection: function collection(bucket, coll) {
    return ENDPOINTS.bucket(bucket) + "/collections" + (coll ? "/" + coll : "");
  },
  group: function group(bucket, _group) {
    return ENDPOINTS.bucket(bucket) + "/groups" + (_group ? "/" + _group : "");
  },
  record: function record(bucket, coll, id) {
    return ENDPOINTS.collection(bucket, coll) + "/records" + (id ? "/" + id : "");
  },
  attachment: function attachment(bucket, coll, id) {
    return ENDPOINTS.record(bucket, coll, id) + "/attachment";
  }
};

/**
 * Retrieves a server enpoint by its name.
 *
 * @private
 * @param  {String}    name The endpoint name.
 * @param  {...string} args The endpoint parameters.
 * @return {String}
 */
function endpoint(name) {
  for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  return ENDPOINTS[name].apply(ENDPOINTS, args);
}

},{}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Kinto server error code descriptors.
 * @type {Object}
 */
exports.default = {
  104: "Missing Authorization Token",
  105: "Invalid Authorization Token",
  106: "Request body was not valid JSON",
  107: "Invalid request parameter",
  108: "Missing request parameter",
  109: "Invalid posted data",
  110: "Invalid Token / id",
  111: "Missing Token / id",
  112: "Content-Length header was not provided",
  113: "Request body too large",
  114: "Resource was created, updated or deleted meanwhile",
  115: "Method not allowed on this end point (hint: server may be readonly)",
  116: "Requested version not available on this server",
  117: "Client has sent too many requests",
  121: "Resource access is forbidden for this user",
  122: "Another resource violates constraint",
  201: "Service Temporary unavailable due to high load",
  202: "Service deprecated",
  999: "Internal Server Error"
};

},{}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _errors = require("./errors");

var _errors2 = _interopRequireDefault(_errors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Enhanced HTTP client for the Kinto protocol.
 * @private
 */

var HTTP = function () {
  _createClass(HTTP, null, [{
    key: "DEFAULT_REQUEST_HEADERS",

    /**
     * Default HTTP request headers applied to each outgoing request.
     *
     * @type {Object}
     */
    get: function get() {
      return {
        "Accept": "application/json",
        "Content-Type": "application/json"
      };
    }

    /**
     * Default options.
     *
     * @type {Object}
     */

  }, {
    key: "defaultOptions",
    get: function get() {
      return { timeout: 5000, requestMode: "cors" };
    }

    /**
     * Constructor.
     *
     * @param {EventEmitter} events                       The event handler.
     * @param {Object}       [options={}}                 The options object.
     * @param {Number}       [options.timeout=5000]       The request timeout in ms (default: `5000`).
     * @param {String}       [options.requestMode="cors"] The HTTP request mode (default: `"cors"`).
     */

  }]);

  function HTTP(events) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, HTTP);

    // public properties
    /**
     * The event emitter instance.
     * @type {EventEmitter}
     */
    if (!events) {
      throw new Error("No events handler provided");
    }
    this.events = events;

    /**
     * The request mode.
     * @see  https://fetch.spec.whatwg.org/#requestmode
     * @type {String}
     */
    this.requestMode = options.requestMode || HTTP.defaultOptions.requestMode;

    /**
     * The request timeout.
     * @type {Number}
     */
    this.timeout = options.timeout || HTTP.defaultOptions.timeout;
  }

  /**
   * Performs an HTTP request to the Kinto server.
   *
   * Resolves with an objet containing the following HTTP response properties:
   * - `{Number}  status`  The HTTP status code.
   * - `{Object}  json`    The JSON response body.
   * - `{Headers} headers` The response headers object; see the ES6 fetch() spec.
   *
   * @param  {String} url               The URL.
   * @param  {Object} [options={}]      The fetch() options object.
   * @param  {Object} [options.headers] The request headers object (default: {})
   * @return {Promise}
   */


  _createClass(HTTP, [{
    key: "request",
    value: function request(url) {
      var _this = this;

      var options = arguments.length <= 1 || arguments[1] === undefined ? { headers: {} } : arguments[1];

      var response = void 0,
          status = void 0,
          statusText = void 0,
          headers = void 0,
          hasTimedout = void 0;
      // Ensure default request headers are always set
      options.headers = _extends({}, HTTP.DEFAULT_REQUEST_HEADERS, options.headers);
      // If a multipart body is provided, remove any custom Content-Type header as
      // the fetch() implementation will add the correct one for us.
      if (options.body && typeof options.body.append === "function") {
        delete options.headers["Content-Type"];
      }
      options.mode = this.requestMode;
      return new Promise(function (resolve, reject) {
        var _timeoutId = setTimeout(function () {
          hasTimedout = true;
          reject(new Error("Request timeout."));
        }, _this.timeout);
        fetch(url, options).then(function (res) {
          if (!hasTimedout) {
            clearTimeout(_timeoutId);
            resolve(res);
          }
        }).catch(function (err) {
          if (!hasTimedout) {
            clearTimeout(_timeoutId);
            reject(err);
          }
        });
      }).then(function (res) {
        response = res;
        headers = res.headers;
        status = res.status;
        statusText = res.statusText;
        _this._checkForDeprecationHeader(headers);
        _this._checkForBackoffHeader(status, headers);
        _this._checkForRetryAfterHeader(status, headers);
        return res.text();
      })
      // Check if we have a body; if so parse it as JSON.
      .then(function (text) {
        if (text.length === 0) {
          return null;
        }
        // Note: we can't consume the response body twice.
        return JSON.parse(text);
      }).catch(function (err) {
        var error = new Error("HTTP " + (status || 0) + "; " + err);
        error.response = response;
        error.stack = err.stack;
        throw error;
      }).then(function (json) {
        if (json && status >= 400) {
          var message = "HTTP " + status + " " + (json.error || "") + ": ";
          if (json.errno && json.errno in _errors2.default) {
            var errnoMsg = _errors2.default[json.errno];
            message += errnoMsg;
            if (json.message && json.message !== errnoMsg) {
              message += " (" + json.message + ")";
            }
          } else {
            message += statusText || "";
          }
          var error = new Error(message.trim());
          error.response = response;
          error.data = json;
          throw error;
        }
        return { status: status, json: json, headers: headers };
      });
    }
  }, {
    key: "_checkForDeprecationHeader",
    value: function _checkForDeprecationHeader(headers) {
      var alertHeader = headers.get("Alert");
      if (!alertHeader) {
        return;
      }
      var alert = void 0;
      try {
        alert = JSON.parse(alertHeader);
      } catch (err) {
        console.warn("Unable to parse Alert header message", alertHeader);
        return;
      }
      console.warn(alert.message, alert.url);
      this.events.emit("deprecated", alert);
    }
  }, {
    key: "_checkForBackoffHeader",
    value: function _checkForBackoffHeader(status, headers) {
      var backoffMs = void 0;
      var backoffSeconds = parseInt(headers.get("Backoff"), 10);
      if (backoffSeconds > 0) {
        backoffMs = new Date().getTime() + backoffSeconds * 1000;
      } else {
        backoffMs = 0;
      }
      this.events.emit("backoff", backoffMs);
    }
  }, {
    key: "_checkForRetryAfterHeader",
    value: function _checkForRetryAfterHeader(status, headers) {
      var retryAfter = headers.get("Retry-After");
      if (!retryAfter) {
        return;
      }
      retryAfter = new Date().getTime() + parseInt(retryAfter, 10) * 1000;
      this.events.emit("retry-after", retryAfter);
    }
  }]);

  return HTTP;
}();

exports.default = HTTP;

},{"./errors":11}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

require("isomorphic-fetch");

var _events = require("events");

var _base = require("./base");

var _base2 = _interopRequireDefault(_base);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var KintoClient = function (_KintoClientBase) {
  _inherits(KintoClient, _KintoClientBase);

  function KintoClient(remote) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, KintoClient);

    var events = options.events || new _events.EventEmitter();

    return _possibleConstructorReturn(this, Object.getPrototypeOf(KintoClient).call(this, remote, Object.assign({ events: events }, options)));
  }

  return KintoClient;
}(_base2.default);

// This is a hack to avoid Browserify to expose the above class
// at `new KintoClient()` instead of `new KintoClient.default()`.
// See https://github.com/Kinto/kinto-http.js/issues/77


exports.default = KintoClient;
if ((typeof module === "undefined" ? "undefined" : _typeof(module)) === "object") {
  module.exports = KintoClient;
}

},{"./base":6,"events":1,"isomorphic-fetch":2}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.createRequest = createRequest;
exports.updateRequest = updateRequest;
exports.deleteRequest = deleteRequest;
exports.addAttachmentRequest = addAttachmentRequest;

var _utils = require("./utils");

var requestDefaults = {
  safe: false,
  // check if we should set default content type here
  headers: {},
  permissions: undefined,
  data: undefined,
  patch: false
};

/**
 * @private
 */
function safeHeader(safe, last_modified) {
  if (!safe) {
    return {};
  }
  if (last_modified) {
    return { "If-Match": "\"" + last_modified + "\"" };
  }
  return { "If-None-Match": "*" };
}

/**
 * @private
 */
function createRequest(path, _ref) {
  var data = _ref.data;
  var permissions = _ref.permissions;
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var _requestDefaults$opti = _extends({}, requestDefaults, options);

  var headers = _requestDefaults$opti.headers;
  var safe = _requestDefaults$opti.safe;

  return {
    method: data && data.id ? "PUT" : "POST",
    path: path,
    headers: _extends({}, headers, safeHeader(safe)),
    body: {
      data: data,
      permissions: permissions
    }
  };
}

/**
 * @private
 */
function updateRequest(path, _ref2) {
  var data = _ref2.data;
  var permissions = _ref2.permissions;
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var _requestDefaults$opti2 = _extends({}, requestDefaults, options);

  var headers = _requestDefaults$opti2.headers;
  var safe = _requestDefaults$opti2.safe;
  var patch = _requestDefaults$opti2.patch;

  var _data$options = _extends({}, data, options);

  var last_modified = _data$options.last_modified;


  if (Object.keys((0, _utils.omit)(data, "id", "last_modified")).length === 0) {
    data = undefined;
  }

  return {
    method: patch ? "PATCH" : "PUT",
    path: path,
    headers: _extends({}, headers, safeHeader(safe, last_modified)),
    body: {
      data: data,
      permissions: permissions
    }
  };
}

/**
 * @private
 */
function deleteRequest(path) {
  var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var _requestDefaults$opti3 = _extends({}, requestDefaults, options);

  var headers = _requestDefaults$opti3.headers;
  var safe = _requestDefaults$opti3.safe;
  var last_modified = _requestDefaults$opti3.last_modified;

  if (safe && !last_modified) {
    throw new Error("Safe concurrency check requires a last_modified value.");
  }
  return {
    method: "DELETE",
    path: path,
    headers: _extends({}, headers, safeHeader(safe, last_modified))
  };
}

/**
 * @private
 */
function addAttachmentRequest(path, dataURI) {
  var _ref3 = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var data = _ref3.data;
  var permissions = _ref3.permissions;
  var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

  var _requestDefaults$opti4 = _extends({}, requestDefaults, options);

  var headers = _requestDefaults$opti4.headers;
  var safe = _requestDefaults$opti4.safe;

  var _data$options2 = _extends({}, data, options);

  var last_modified = _data$options2.last_modified;

  if (safe && !last_modified) {
    throw new Error("Safe concurrency check requires a last_modified value.");
  }

  var body = { data: data, permissions: permissions };
  var formData = (0, _utils.createFormData)(dataURI, body, options);

  return {
    method: "POST",
    path: path,
    headers: _extends({}, headers, safeHeader(safe, last_modified)),
    body: formData
  };
}

},{"./utils":15}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.partition = partition;
exports.pMap = pMap;
exports.omit = omit;
exports.toDataBody = toDataBody;
exports.qsify = qsify;
exports.checkVersion = checkVersion;
exports.support = support;
exports.capable = capable;
exports.nobatch = nobatch;
exports.isObject = isObject;
exports.parseDataURL = parseDataURL;
exports.extractFileInfo = extractFileInfo;
exports.createFormData = createFormData;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

/**
 * Chunks an array into n pieces.
 *
 * @private
 * @param  {Array}  array
 * @param  {Number} n
 * @return {Array}
 */
function partition(array, n) {
  if (n <= 0) {
    return array;
  }
  return array.reduce(function (acc, x, i) {
    if (i === 0 || i % n === 0) {
      acc.push([x]);
    } else {
      acc[acc.length - 1].push(x);
    }
    return acc;
  }, []);
}

/**
 * Maps a list to promises using the provided mapping function, executes them
 * sequentially then returns a Promise resolving with ordered results obtained.
 * Think of this as a sequential Promise.all.
 *
 * @private
 * @param  {Array}    list The list to map.
 * @param  {Function} fn   The mapping function.
 * @return {Promise}
 */
function pMap(list, fn) {
  var results = [];
  return list.reduce(function (promise, entry) {
    return promise.then(function () {
      return Promise.resolve(fn(entry)).then(function (result) {
        return results = results.concat(result);
      });
    });
  }, Promise.resolve()).then(function () {
    return results;
  });
}

/**
 * Takes an object and returns a copy of it with the provided keys omitted.
 *
 * @private
 * @param  {Object}    obj  The source object.
 * @param  {...String} keys The keys to omit.
 * @return {Object}
 */
function omit(obj) {
  for (var _len = arguments.length, keys = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    keys[_key - 1] = arguments[_key];
  }

  return Object.keys(obj).reduce(function (acc, key) {
    if (keys.indexOf(key) === -1) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

/**
 * Always returns a resource data object from the provided argument.
 *
 * @private
 * @param  {Object|String} resource
 * @return {Object}
 */
function toDataBody(resource) {
  if (isObject(resource)) {
    return resource;
  }
  if (typeof resource === "string") {
    return { id: resource };
  }
  throw new Error("Invalid argument.");
}

/**
 * Transforms an object into an URL query string, stripping out any undefined
 * values.
 *
 * @param  {Object} obj
 * @return {String}
 */
function qsify(obj) {
  var encode = function encode(v) {
    return encodeURIComponent(typeof v === "boolean" ? String(v) : v);
  };
  var stripUndefined = function stripUndefined(o) {
    return JSON.parse(JSON.stringify(o));
  };
  var stripped = stripUndefined(obj);
  return Object.keys(stripped).map(function (k) {
    var ks = encode(k) + "=";
    if (Array.isArray(stripped[k])) {
      return ks + stripped[k].map(function (v) {
        return encode(v);
      }).join(",");
    } else {
      return ks + encode(stripped[k]);
    }
  }).join("&");
}

/**
 * Checks if a version is within the provided range.
 *
 * @param  {String} version    The version to check.
 * @param  {String} minVersion The minimum supported version (inclusive).
 * @param  {String} maxVersion The minimum supported version (exclusive).
 * @throws {Error} If the version is outside of the provided range.
 */
function checkVersion(version, minVersion, maxVersion) {
  var extract = function extract(str) {
    return str.split(".").map(function (x) {
      return parseInt(x, 10);
    });
  };

  var _extract = extract(version);

  var _extract2 = _slicedToArray(_extract, 2);

  var verMajor = _extract2[0];
  var verMinor = _extract2[1];

  var _extract3 = extract(minVersion);

  var _extract4 = _slicedToArray(_extract3, 2);

  var minMajor = _extract4[0];
  var minMinor = _extract4[1];

  var _extract5 = extract(maxVersion);

  var _extract6 = _slicedToArray(_extract5, 2);

  var maxMajor = _extract6[0];
  var maxMinor = _extract6[1];

  var checks = [verMajor < minMajor, verMajor === minMajor && verMinor < minMinor, verMajor > maxMajor, verMajor === maxMajor && verMinor >= maxMinor];
  if (checks.some(function (x) {
    return x;
  })) {
    throw new Error("Version " + version + " doesn't satisfy " + (minVersion + " <= x < " + maxVersion));
  }
}

/**
 * Generates a decorator function ensuring a version check is performed against
 * the provided requirements before executing it.
 *
 * @param  {String} min The required min version (inclusive).
 * @param  {String} max The required max version (inclusive).
 * @return {Function}
 */
function support(min, max) {
  return function (target, key, descriptor) {
    var fn = descriptor.value;
    return {
      configurable: true,
      get: function get() {
        var _this = this;

        var wrappedMethod = function wrappedMethod() {
          for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }

          // "this" is the current instance which its method is decorated.
          var client = "client" in _this ? _this.client : _this;
          return client.fetchHTTPApiVersion().then(function (version) {
            return checkVersion(version, min, max);
          }).then(function () {
            return fn.apply(_this, args);
          });
        };
        Object.defineProperty(this, key, {
          value: wrappedMethod,
          configurable: true,
          writable: true
        });
        return wrappedMethod;
      }
    };
  };
}

/**
 * Generates a decorator function ensuring that the specified capabilities are
 * available on the server before executing it.
 *
 * @param  {Array<String>} capabilities The required capabilities.
 * @return {Function}
 */
function capable(capabilities) {
  return function (target, key, descriptor) {
    var fn = descriptor.value;
    return {
      configurable: true,
      get: function get() {
        var _this2 = this;

        var wrappedMethod = function wrappedMethod() {
          for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
            args[_key3] = arguments[_key3];
          }

          // "this" is the current instance which its method is decorated.
          var client = "client" in _this2 ? _this2.client : _this2;
          return client.fetchServerCapabilities().then(function (available) {
            var missing = capabilities.filter(function (c) {
              return !available.hasOwnProperty(c);
            });
            if (missing.length > 0) {
              throw new Error("Required capabilities " + missing.join(", ") + " " + "not present on server");
            }
          }).then(function () {
            return fn.apply(_this2, args);
          });
        };
        Object.defineProperty(this, key, {
          value: wrappedMethod,
          configurable: true,
          writable: true
        });
        return wrappedMethod;
      }
    };
  };
}

/**
 * Generates a decorator function ensuring an operation is not performed from
 * within a batch request.
 *
 * @param  {String} message The error message to throw.
 * @return {Function}
 */
function nobatch(message) {
  return function (target, key, descriptor) {
    var fn = descriptor.value;
    return {
      configurable: true,
      get: function get() {
        var _this3 = this;

        var wrappedMethod = function wrappedMethod() {
          for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
            args[_key4] = arguments[_key4];
          }

          // "this" is the current instance which its method is decorated.
          if (_this3._isBatch) {
            throw new Error(message);
          }
          return fn.apply(_this3, args);
        };
        Object.defineProperty(this, key, {
          value: wrappedMethod,
          configurable: true,
          writable: true
        });
        return wrappedMethod;
      }
    };
  };
}

/**
 * Returns true if the specified value is an object (i.e. not an array nor null).
 * @param  {Object} thing The value to inspect.
 * @return {bool}
 */
function isObject(thing) {
  return (typeof thing === "undefined" ? "undefined" : _typeof(thing)) === "object" && thing !== null && !Array.isArray(thing);
}

/**
 * Parses a data url.
 * @param  {String} dataURL The data url.
 * @return {Object}
 */
function parseDataURL(dataURL) {
  var regex = /^data:(.*);base64,(.*)/;
  var match = dataURL.match(regex);
  if (!match) {
    throw new Error("Invalid data-url: " + String(dataURL).substr(0, 32) + "...");
  }
  var props = match[1];
  var base64 = match[2];

  var _props$split = props.split(";");

  var _props$split2 = _toArray(_props$split);

  var type = _props$split2[0];

  var rawParams = _props$split2.slice(1);

  var params = rawParams.reduce(function (acc, param) {
    var _param$split = param.split("=");

    var _param$split2 = _slicedToArray(_param$split, 2);

    var key = _param$split2[0];
    var value = _param$split2[1];

    return _extends({}, acc, _defineProperty({}, key, value));
  }, {});
  return _extends({}, params, { type: type, base64: base64 });
}

/**
 * Extracts file information from a data url.
 * @param  {String} dataURL The data url.
 * @return {Object}
 */
function extractFileInfo(dataURL) {
  var _parseDataURL = parseDataURL(dataURL);

  var name = _parseDataURL.name;
  var type = _parseDataURL.type;
  var base64 = _parseDataURL.base64;

  var binary = atob(base64);
  var array = [];
  for (var i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }
  var blob = new Blob([new Uint8Array(array)], { type: type });
  return { blob: blob, name: name };
}

/**
 * Creates a FormData instance from a data url and an existing JSON response
 * body.
 * @param  {String} dataURL            The data url.
 * @param  {Object} body               The response body.
 * @param  {Object} [options={}]       The options object.
 * @param  {Object} [options.filename] Force attachment file name.
 * @return {FormData}
 */
function createFormData(dataURL, body) {
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
  var _options$filename = options.filename;
  var filename = _options$filename === undefined ? "untitled" : _options$filename;

  var _extractFileInfo = extractFileInfo(dataURL);

  var blob = _extractFileInfo.blob;
  var name = _extractFileInfo.name;

  var formData = new FormData();
  formData.append("attachment", blob, name || filename);
  for (var property in body) {
    if (typeof body[property] !== "undefined") {
      formData.append(property, JSON.stringify(body[property]));
    }
  }
  return formData;
}

},{}]},{},[13])(13)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9pc29tb3JwaGljLWZldGNoL2ZldGNoLW5wbS1icm93c2VyaWZ5LmpzIiwibm9kZV9tb2R1bGVzL3V1aWQvcm5nLWJyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvdXVpZC91dWlkLmpzIiwibm9kZV9tb2R1bGVzL3doYXR3Zy1mZXRjaC9mZXRjaC5qcyIsInNyYy9iYXNlLmpzIiwic3JjL2JhdGNoLmpzIiwic3JjL2J1Y2tldC5qcyIsInNyYy9jb2xsZWN0aW9uLmpzIiwic3JjL2VuZHBvaW50LmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9odHRwLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3JlcXVlc3RzLmpzIiwic3JjL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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VUFBSixDQUFlLEtBQWYsQ0FBRCxDQUFULEVBQWtDLEVBQUMsVUFBRCxFQUFsQyxDQUFiO0FBQ0EsU0FBTyxFQUFDLFVBQUQsRUFBTyxVQUFQLEVBQVA7QUFDRDs7QUFFRDs7Ozs7Ozs7O0FBU08sU0FBUyxjQUFULENBQXdCLE9BQXhCLEVBQWlDLElBQWpDLEVBQW1EO0FBQUEsTUFBWixPQUFZLHlEQUFKLEVBQUk7QUFBQSwwQkFDMUIsT0FEMEIsQ0FDakQsUUFEaUQ7QUFBQSxNQUNqRCxRQURpRCxxQ0FDeEMsVUFEd0M7O0FBQUEseUJBRW5DLGdCQUFnQixPQUFoQixDQUZtQzs7QUFBQSxNQUVqRCxJQUZpRCxvQkFFakQsSUFGaUQ7QUFBQSxNQUUzQyxJQUYyQyxvQkFFM0MsSUFGMkM7O0FBR3hELE1BQU0sV0FBVyxJQUFJLFFBQUosRUFBakI7QUFDQSxXQUFTLE1BQVQsQ0FBZ0IsWUFBaEIsRUFBOEIsSUFBOUIsRUFBb0MsUUFBUSxRQUE1QztBQUNBLE9BQUssSUFBTSxRQUFYLElBQXVCLElBQXZCLEVBQTZCO0FBQzNCLFFBQUksT0FBTyxLQUFLLFFBQUwsQ0FBUCxLQUEwQixXQUE5QixFQUEyQztBQUN6QyxlQUFTLE1BQVQsQ0FBZ0IsUUFBaEIsRUFBMEIsS0FBSyxTQUFMLENBQWUsS0FBSyxRQUFMLENBQWYsQ0FBMUI7QUFDRDtBQUNGO0FBQ0QsU0FBTyxRQUFQO0FBQ0QiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEF0IGxlYXN0IGdpdmUgc29tZSBraW5kIG9mIGNvbnRleHQgdG8gdGhlIHVzZXJcbiAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4gKCcgKyBlciArICcpJyk7XG4gICAgICAgIGVyci5jb250ZXh0ID0gZXI7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiLy8gdGhlIHdoYXR3Zy1mZXRjaCBwb2x5ZmlsbCBpbnN0YWxscyB0aGUgZmV0Y2goKSBmdW5jdGlvblxuLy8gb24gdGhlIGdsb2JhbCBvYmplY3QgKHdpbmRvdyBvciBzZWxmKVxuLy9cbi8vIFJldHVybiB0aGF0IGFzIHRoZSBleHBvcnQgZm9yIHVzZSBpbiBXZWJwYWNrLCBCcm93c2VyaWZ5IGV0Yy5cbnJlcXVpcmUoJ3doYXR3Zy1mZXRjaCcpO1xubW9kdWxlLmV4cG9ydHMgPSBzZWxmLmZldGNoLmJpbmQoc2VsZik7XG4iLCJcbnZhciBybmc7XG5cbmlmIChnbG9iYWwuY3J5cHRvICYmIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMpIHtcbiAgLy8gV0hBVFdHIGNyeXB0by1iYXNlZCBSTkcgLSBodHRwOi8vd2lraS53aGF0d2cub3JnL3dpa2kvQ3J5cHRvXG4gIC8vIE1vZGVyYXRlbHkgZmFzdCwgaGlnaCBxdWFsaXR5XG4gIHZhciBfcm5kczggPSBuZXcgVWludDhBcnJheSgxNik7XG4gIHJuZyA9IGZ1bmN0aW9uIHdoYXR3Z1JORygpIHtcbiAgICBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKF9ybmRzOCk7XG4gICAgcmV0dXJuIF9ybmRzODtcbiAgfTtcbn1cblxuaWYgKCFybmcpIHtcbiAgLy8gTWF0aC5yYW5kb20oKS1iYXNlZCAoUk5HKVxuICAvL1xuICAvLyBJZiBhbGwgZWxzZSBmYWlscywgdXNlIE1hdGgucmFuZG9tKCkuICBJdCdzIGZhc3QsIGJ1dCBpcyBvZiB1bnNwZWNpZmllZFxuICAvLyBxdWFsaXR5LlxuICB2YXIgIF9ybmRzID0gbmV3IEFycmF5KDE2KTtcbiAgcm5nID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHI7IGkgPCAxNjsgaSsrKSB7XG4gICAgICBpZiAoKGkgJiAweDAzKSA9PT0gMCkgciA9IE1hdGgucmFuZG9tKCkgKiAweDEwMDAwMDAwMDtcbiAgICAgIF9ybmRzW2ldID0gciA+Pj4gKChpICYgMHgwMykgPDwgMykgJiAweGZmO1xuICAgIH1cblxuICAgIHJldHVybiBfcm5kcztcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBybmc7XG5cbiIsIi8vICAgICB1dWlkLmpzXG4vL1xuLy8gICAgIENvcHlyaWdodCAoYykgMjAxMC0yMDEyIFJvYmVydCBLaWVmZmVyXG4vLyAgICAgTUlUIExpY2Vuc2UgLSBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvbWl0LWxpY2Vuc2UucGhwXG5cbi8vIFVuaXF1ZSBJRCBjcmVhdGlvbiByZXF1aXJlcyBhIGhpZ2ggcXVhbGl0eSByYW5kb20gIyBnZW5lcmF0b3IuICBXZSBmZWF0dXJlXG4vLyBkZXRlY3QgdG8gZGV0ZXJtaW5lIHRoZSBiZXN0IFJORyBzb3VyY2UsIG5vcm1hbGl6aW5nIHRvIGEgZnVuY3Rpb24gdGhhdFxuLy8gcmV0dXJucyAxMjgtYml0cyBvZiByYW5kb21uZXNzLCBzaW5jZSB0aGF0J3Mgd2hhdCdzIHVzdWFsbHkgcmVxdWlyZWRcbnZhciBfcm5nID0gcmVxdWlyZSgnLi9ybmcnKTtcblxuLy8gTWFwcyBmb3IgbnVtYmVyIDwtPiBoZXggc3RyaW5nIGNvbnZlcnNpb25cbnZhciBfYnl0ZVRvSGV4ID0gW107XG52YXIgX2hleFRvQnl0ZSA9IHt9O1xuZm9yICh2YXIgaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICBfYnl0ZVRvSGV4W2ldID0gKGkgKyAweDEwMCkudG9TdHJpbmcoMTYpLnN1YnN0cigxKTtcbiAgX2hleFRvQnl0ZVtfYnl0ZVRvSGV4W2ldXSA9IGk7XG59XG5cbi8vICoqYHBhcnNlKClgIC0gUGFyc2UgYSBVVUlEIGludG8gaXQncyBjb21wb25lbnQgYnl0ZXMqKlxuZnVuY3Rpb24gcGFyc2UocywgYnVmLCBvZmZzZXQpIHtcbiAgdmFyIGkgPSAoYnVmICYmIG9mZnNldCkgfHwgMCwgaWkgPSAwO1xuXG4gIGJ1ZiA9IGJ1ZiB8fCBbXTtcbiAgcy50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1swLTlhLWZdezJ9L2csIGZ1bmN0aW9uKG9jdCkge1xuICAgIGlmIChpaSA8IDE2KSB7IC8vIERvbid0IG92ZXJmbG93IVxuICAgICAgYnVmW2kgKyBpaSsrXSA9IF9oZXhUb0J5dGVbb2N0XTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFplcm8gb3V0IHJlbWFpbmluZyBieXRlcyBpZiBzdHJpbmcgd2FzIHNob3J0XG4gIHdoaWxlIChpaSA8IDE2KSB7XG4gICAgYnVmW2kgKyBpaSsrXSA9IDA7XG4gIH1cblxuICByZXR1cm4gYnVmO1xufVxuXG4vLyAqKmB1bnBhcnNlKClgIC0gQ29udmVydCBVVUlEIGJ5dGUgYXJyYXkgKGFsYSBwYXJzZSgpKSBpbnRvIGEgc3RyaW5nKipcbmZ1bmN0aW9uIHVucGFyc2UoYnVmLCBvZmZzZXQpIHtcbiAgdmFyIGkgPSBvZmZzZXQgfHwgMCwgYnRoID0gX2J5dGVUb0hleDtcbiAgcmV0dXJuICBidGhbYnVmW2krK11dICsgYnRoW2J1ZltpKytdXSArXG4gICAgICAgICAgYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gKyAnLScgK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dICsgJy0nICtcbiAgICAgICAgICBidGhbYnVmW2krK11dICsgYnRoW2J1ZltpKytdXSArICctJyArXG4gICAgICAgICAgYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gKyAnLScgK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dICtcbiAgICAgICAgICBidGhbYnVmW2krK11dICsgYnRoW2J1ZltpKytdXSArXG4gICAgICAgICAgYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV07XG59XG5cbi8vICoqYHYxKClgIC0gR2VuZXJhdGUgdGltZS1iYXNlZCBVVUlEKipcbi8vXG4vLyBJbnNwaXJlZCBieSBodHRwczovL2dpdGh1Yi5jb20vTGlvc0svVVVJRC5qc1xuLy8gYW5kIGh0dHA6Ly9kb2NzLnB5dGhvbi5vcmcvbGlicmFyeS91dWlkLmh0bWxcblxuLy8gcmFuZG9tICMncyB3ZSBuZWVkIHRvIGluaXQgbm9kZSBhbmQgY2xvY2tzZXFcbnZhciBfc2VlZEJ5dGVzID0gX3JuZygpO1xuXG4vLyBQZXIgNC41LCBjcmVhdGUgYW5kIDQ4LWJpdCBub2RlIGlkLCAoNDcgcmFuZG9tIGJpdHMgKyBtdWx0aWNhc3QgYml0ID0gMSlcbnZhciBfbm9kZUlkID0gW1xuICBfc2VlZEJ5dGVzWzBdIHwgMHgwMSxcbiAgX3NlZWRCeXRlc1sxXSwgX3NlZWRCeXRlc1syXSwgX3NlZWRCeXRlc1szXSwgX3NlZWRCeXRlc1s0XSwgX3NlZWRCeXRlc1s1XVxuXTtcblxuLy8gUGVyIDQuMi4yLCByYW5kb21pemUgKDE0IGJpdCkgY2xvY2tzZXFcbnZhciBfY2xvY2tzZXEgPSAoX3NlZWRCeXRlc1s2XSA8PCA4IHwgX3NlZWRCeXRlc1s3XSkgJiAweDNmZmY7XG5cbi8vIFByZXZpb3VzIHV1aWQgY3JlYXRpb24gdGltZVxudmFyIF9sYXN0TVNlY3MgPSAwLCBfbGFzdE5TZWNzID0gMDtcblxuLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9icm9vZmEvbm9kZS11dWlkIGZvciBBUEkgZGV0YWlsc1xuZnVuY3Rpb24gdjEob3B0aW9ucywgYnVmLCBvZmZzZXQpIHtcbiAgdmFyIGkgPSBidWYgJiYgb2Zmc2V0IHx8IDA7XG4gIHZhciBiID0gYnVmIHx8IFtdO1xuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIHZhciBjbG9ja3NlcSA9IG9wdGlvbnMuY2xvY2tzZXEgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMuY2xvY2tzZXEgOiBfY2xvY2tzZXE7XG5cbiAgLy8gVVVJRCB0aW1lc3RhbXBzIGFyZSAxMDAgbmFuby1zZWNvbmQgdW5pdHMgc2luY2UgdGhlIEdyZWdvcmlhbiBlcG9jaCxcbiAgLy8gKDE1ODItMTAtMTUgMDA6MDApLiAgSlNOdW1iZXJzIGFyZW4ndCBwcmVjaXNlIGVub3VnaCBmb3IgdGhpcywgc29cbiAgLy8gdGltZSBpcyBoYW5kbGVkIGludGVybmFsbHkgYXMgJ21zZWNzJyAoaW50ZWdlciBtaWxsaXNlY29uZHMpIGFuZCAnbnNlY3MnXG4gIC8vICgxMDAtbmFub3NlY29uZHMgb2Zmc2V0IGZyb20gbXNlY3MpIHNpbmNlIHVuaXggZXBvY2gsIDE5NzAtMDEtMDEgMDA6MDAuXG4gIHZhciBtc2VjcyA9IG9wdGlvbnMubXNlY3MgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubXNlY3MgOiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuICAvLyBQZXIgNC4yLjEuMiwgdXNlIGNvdW50IG9mIHV1aWQncyBnZW5lcmF0ZWQgZHVyaW5nIHRoZSBjdXJyZW50IGNsb2NrXG4gIC8vIGN5Y2xlIHRvIHNpbXVsYXRlIGhpZ2hlciByZXNvbHV0aW9uIGNsb2NrXG4gIHZhciBuc2VjcyA9IG9wdGlvbnMubnNlY3MgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubnNlY3MgOiBfbGFzdE5TZWNzICsgMTtcblxuICAvLyBUaW1lIHNpbmNlIGxhc3QgdXVpZCBjcmVhdGlvbiAoaW4gbXNlY3MpXG4gIHZhciBkdCA9IChtc2VjcyAtIF9sYXN0TVNlY3MpICsgKG5zZWNzIC0gX2xhc3ROU2VjcykvMTAwMDA7XG5cbiAgLy8gUGVyIDQuMi4xLjIsIEJ1bXAgY2xvY2tzZXEgb24gY2xvY2sgcmVncmVzc2lvblxuICBpZiAoZHQgPCAwICYmIG9wdGlvbnMuY2xvY2tzZXEgPT09IHVuZGVmaW5lZCkge1xuICAgIGNsb2Nrc2VxID0gY2xvY2tzZXEgKyAxICYgMHgzZmZmO1xuICB9XG5cbiAgLy8gUmVzZXQgbnNlY3MgaWYgY2xvY2sgcmVncmVzc2VzIChuZXcgY2xvY2tzZXEpIG9yIHdlJ3ZlIG1vdmVkIG9udG8gYSBuZXdcbiAgLy8gdGltZSBpbnRlcnZhbFxuICBpZiAoKGR0IDwgMCB8fCBtc2VjcyA+IF9sYXN0TVNlY3MpICYmIG9wdGlvbnMubnNlY3MgPT09IHVuZGVmaW5lZCkge1xuICAgIG5zZWNzID0gMDtcbiAgfVxuXG4gIC8vIFBlciA0LjIuMS4yIFRocm93IGVycm9yIGlmIHRvbyBtYW55IHV1aWRzIGFyZSByZXF1ZXN0ZWRcbiAgaWYgKG5zZWNzID49IDEwMDAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1dWlkLnYxKCk6IENhblxcJ3QgY3JlYXRlIG1vcmUgdGhhbiAxME0gdXVpZHMvc2VjJyk7XG4gIH1cblxuICBfbGFzdE1TZWNzID0gbXNlY3M7XG4gIF9sYXN0TlNlY3MgPSBuc2VjcztcbiAgX2Nsb2Nrc2VxID0gY2xvY2tzZXE7XG5cbiAgLy8gUGVyIDQuMS40IC0gQ29udmVydCBmcm9tIHVuaXggZXBvY2ggdG8gR3JlZ29yaWFuIGVwb2NoXG4gIG1zZWNzICs9IDEyMjE5MjkyODAwMDAwO1xuXG4gIC8vIGB0aW1lX2xvd2BcbiAgdmFyIHRsID0gKChtc2VjcyAmIDB4ZmZmZmZmZikgKiAxMDAwMCArIG5zZWNzKSAlIDB4MTAwMDAwMDAwO1xuICBiW2krK10gPSB0bCA+Pj4gMjQgJiAweGZmO1xuICBiW2krK10gPSB0bCA+Pj4gMTYgJiAweGZmO1xuICBiW2krK10gPSB0bCA+Pj4gOCAmIDB4ZmY7XG4gIGJbaSsrXSA9IHRsICYgMHhmZjtcblxuICAvLyBgdGltZV9taWRgXG4gIHZhciB0bWggPSAobXNlY3MgLyAweDEwMDAwMDAwMCAqIDEwMDAwKSAmIDB4ZmZmZmZmZjtcbiAgYltpKytdID0gdG1oID4+PiA4ICYgMHhmZjtcbiAgYltpKytdID0gdG1oICYgMHhmZjtcblxuICAvLyBgdGltZV9oaWdoX2FuZF92ZXJzaW9uYFxuICBiW2krK10gPSB0bWggPj4+IDI0ICYgMHhmIHwgMHgxMDsgLy8gaW5jbHVkZSB2ZXJzaW9uXG4gIGJbaSsrXSA9IHRtaCA+Pj4gMTYgJiAweGZmO1xuXG4gIC8vIGBjbG9ja19zZXFfaGlfYW5kX3Jlc2VydmVkYCAoUGVyIDQuMi4yIC0gaW5jbHVkZSB2YXJpYW50KVxuICBiW2krK10gPSBjbG9ja3NlcSA+Pj4gOCB8IDB4ODA7XG5cbiAgLy8gYGNsb2NrX3NlcV9sb3dgXG4gIGJbaSsrXSA9IGNsb2Nrc2VxICYgMHhmZjtcblxuICAvLyBgbm9kZWBcbiAgdmFyIG5vZGUgPSBvcHRpb25zLm5vZGUgfHwgX25vZGVJZDtcbiAgZm9yICh2YXIgbiA9IDA7IG4gPCA2OyBuKyspIHtcbiAgICBiW2kgKyBuXSA9IG5vZGVbbl07XG4gIH1cblxuICByZXR1cm4gYnVmID8gYnVmIDogdW5wYXJzZShiKTtcbn1cblxuLy8gKipgdjQoKWAgLSBHZW5lcmF0ZSByYW5kb20gVVVJRCoqXG5cbi8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYnJvb2ZhL25vZGUtdXVpZCBmb3IgQVBJIGRldGFpbHNcbmZ1bmN0aW9uIHY0KG9wdGlvbnMsIGJ1Ziwgb2Zmc2V0KSB7XG4gIC8vIERlcHJlY2F0ZWQgLSAnZm9ybWF0JyBhcmd1bWVudCwgYXMgc3VwcG9ydGVkIGluIHYxLjJcbiAgdmFyIGkgPSBidWYgJiYgb2Zmc2V0IHx8IDA7XG5cbiAgaWYgKHR5cGVvZihvcHRpb25zKSA9PSAnc3RyaW5nJykge1xuICAgIGJ1ZiA9IG9wdGlvbnMgPT0gJ2JpbmFyeScgPyBuZXcgQXJyYXkoMTYpIDogbnVsbDtcbiAgICBvcHRpb25zID0gbnVsbDtcbiAgfVxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICB2YXIgcm5kcyA9IG9wdGlvbnMucmFuZG9tIHx8IChvcHRpb25zLnJuZyB8fCBfcm5nKSgpO1xuXG4gIC8vIFBlciA0LjQsIHNldCBiaXRzIGZvciB2ZXJzaW9uIGFuZCBgY2xvY2tfc2VxX2hpX2FuZF9yZXNlcnZlZGBcbiAgcm5kc1s2XSA9IChybmRzWzZdICYgMHgwZikgfCAweDQwO1xuICBybmRzWzhdID0gKHJuZHNbOF0gJiAweDNmKSB8IDB4ODA7XG5cbiAgLy8gQ29weSBieXRlcyB0byBidWZmZXIsIGlmIHByb3ZpZGVkXG4gIGlmIChidWYpIHtcbiAgICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgMTY7IGlpKyspIHtcbiAgICAgIGJ1ZltpICsgaWldID0gcm5kc1tpaV07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ1ZiB8fCB1bnBhcnNlKHJuZHMpO1xufVxuXG4vLyBFeHBvcnQgcHVibGljIEFQSVxudmFyIHV1aWQgPSB2NDtcbnV1aWQudjEgPSB2MTtcbnV1aWQudjQgPSB2NDtcbnV1aWQucGFyc2UgPSBwYXJzZTtcbnV1aWQudW5wYXJzZSA9IHVucGFyc2U7XG5cbm1vZHVsZS5leHBvcnRzID0gdXVpZDtcbiIsIihmdW5jdGlvbihzZWxmKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICBpZiAoc2VsZi5mZXRjaCkge1xuICAgIHJldHVyblxuICB9XG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplTmFtZShuYW1lKSB7XG4gICAgaWYgKHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgbmFtZSA9IFN0cmluZyhuYW1lKVxuICAgIH1cbiAgICBpZiAoL1teYS16MC05XFwtIyQlJicqKy5cXF5fYHx+XS9pLnRlc3QobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgY2hhcmFjdGVyIGluIGhlYWRlciBmaWVsZCBuYW1lJylcbiAgICB9XG4gICAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKVxuICB9XG5cbiAgZnVuY3Rpb24gbm9ybWFsaXplVmFsdWUodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuICAgICAgdmFsdWUgPSBTdHJpbmcodmFsdWUpXG4gICAgfVxuICAgIHJldHVybiB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gSGVhZGVycyhoZWFkZXJzKSB7XG4gICAgdGhpcy5tYXAgPSB7fVxuXG4gICAgaWYgKGhlYWRlcnMgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgICBoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgdmFsdWUpXG4gICAgICB9LCB0aGlzKVxuXG4gICAgfSBlbHNlIGlmIChoZWFkZXJzKSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhoZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgaGVhZGVyc1tuYW1lXSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICBuYW1lID0gbm9ybWFsaXplTmFtZShuYW1lKVxuICAgIHZhbHVlID0gbm9ybWFsaXplVmFsdWUodmFsdWUpXG4gICAgdmFyIGxpc3QgPSB0aGlzLm1hcFtuYW1lXVxuICAgIGlmICghbGlzdCkge1xuICAgICAgbGlzdCA9IFtdXG4gICAgICB0aGlzLm1hcFtuYW1lXSA9IGxpc3RcbiAgICB9XG4gICAgbGlzdC5wdXNoKHZhbHVlKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGVbJ2RlbGV0ZSddID0gZnVuY3Rpb24obmFtZSkge1xuICAgIGRlbGV0ZSB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciB2YWx1ZXMgPSB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXVxuICAgIHJldHVybiB2YWx1ZXMgPyB2YWx1ZXNbMF0gOiBudWxsXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5nZXRBbGwgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldIHx8IFtdXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwLmhhc093blByb3BlcnR5KG5vcm1hbGl6ZU5hbWUobmFtZSkpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldID0gW25vcm1hbGl6ZVZhbHVlKHZhbHVlKV1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMubWFwKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHRoaXMubWFwW25hbWVdLmZvckVhY2goZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2YWx1ZSwgbmFtZSwgdGhpcylcbiAgICAgIH0sIHRoaXMpXG4gICAgfSwgdGhpcylcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnN1bWVkKGJvZHkpIHtcbiAgICBpZiAoYm9keS5ib2R5VXNlZCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBUeXBlRXJyb3IoJ0FscmVhZHkgcmVhZCcpKVxuICAgIH1cbiAgICBib2R5LmJvZHlVc2VkID0gdHJ1ZVxuICB9XG5cbiAgZnVuY3Rpb24gZmlsZVJlYWRlclJlYWR5KHJlYWRlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KVxuICAgICAgfVxuICAgICAgcmVhZGVyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KHJlYWRlci5lcnJvcilcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEJsb2JBc0FycmF5QnVmZmVyKGJsb2IpIHtcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICAgIHJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKVxuICAgIHJldHVybiBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEJsb2JBc1RleHQoYmxvYikge1xuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgcmVhZGVyLnJlYWRBc1RleHQoYmxvYilcbiAgICByZXR1cm4gZmlsZVJlYWRlclJlYWR5KHJlYWRlcilcbiAgfVxuXG4gIHZhciBzdXBwb3J0ID0ge1xuICAgIGJsb2I6ICdGaWxlUmVhZGVyJyBpbiBzZWxmICYmICdCbG9iJyBpbiBzZWxmICYmIChmdW5jdGlvbigpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ldyBCbG9iKCk7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfSkoKSxcbiAgICBmb3JtRGF0YTogJ0Zvcm1EYXRhJyBpbiBzZWxmLFxuICAgIGFycmF5QnVmZmVyOiAnQXJyYXlCdWZmZXInIGluIHNlbGZcbiAgfVxuXG4gIGZ1bmN0aW9uIEJvZHkoKSB7XG4gICAgdGhpcy5ib2R5VXNlZCA9IGZhbHNlXG5cblxuICAgIHRoaXMuX2luaXRCb2R5ID0gZnVuY3Rpb24oYm9keSkge1xuICAgICAgdGhpcy5fYm9keUluaXQgPSBib2R5XG4gICAgICBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LmJsb2IgJiYgQmxvYi5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5QmxvYiA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5mb3JtRGF0YSAmJiBGb3JtRGF0YS5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5Rm9ybURhdGEgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKCFib2R5KSB7XG4gICAgICAgIHRoaXMuX2JvZHlUZXh0ID0gJydcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlciAmJiBBcnJheUJ1ZmZlci5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihib2R5KSkge1xuICAgICAgICAvLyBPbmx5IHN1cHBvcnQgQXJyYXlCdWZmZXJzIGZvciBQT1NUIG1ldGhvZC5cbiAgICAgICAgLy8gUmVjZWl2aW5nIEFycmF5QnVmZmVycyBoYXBwZW5zIHZpYSBCbG9icywgaW5zdGVhZC5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgQm9keUluaXQgdHlwZScpXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuaGVhZGVycy5zZXQoJ2NvbnRlbnQtdHlwZScsICd0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLTgnKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlCbG9iICYmIHRoaXMuX2JvZHlCbG9iLnR5cGUpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCB0aGlzLl9ib2R5QmxvYi50eXBlKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuYmxvYikge1xuICAgICAgdGhpcy5ibG9iID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3RlZFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5QmxvYilcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5Rm9ybURhdGEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkIG5vdCByZWFkIEZvcm1EYXRhIGJvZHkgYXMgYmxvYicpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShuZXcgQmxvYihbdGhpcy5fYm9keVRleHRdKSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmFycmF5QnVmZmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsb2IoKS50aGVuKHJlYWRCbG9iQXNBcnJheUJ1ZmZlcilcbiAgICAgIH1cblxuICAgICAgdGhpcy50ZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3RlZFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgICAgcmV0dXJuIHJlYWRCbG9iQXNUZXh0KHRoaXMuX2JvZHlCbG9iKVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlGb3JtRGF0YSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY291bGQgbm90IHJlYWQgRm9ybURhdGEgYm9keSBhcyB0ZXh0JylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlUZXh0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudGV4dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVqZWN0ZWQgPSBjb25zdW1lZCh0aGlzKVxuICAgICAgICByZXR1cm4gcmVqZWN0ZWQgPyByZWplY3RlZCA6IFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5VGV4dClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5mb3JtRGF0YSkge1xuICAgICAgdGhpcy5mb3JtRGF0YSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50ZXh0KCkudGhlbihkZWNvZGUpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5qc29uID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy50ZXh0KCkudGhlbihKU09OLnBhcnNlKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvLyBIVFRQIG1ldGhvZHMgd2hvc2UgY2FwaXRhbGl6YXRpb24gc2hvdWxkIGJlIG5vcm1hbGl6ZWRcbiAgdmFyIG1ldGhvZHMgPSBbJ0RFTEVURScsICdHRVQnLCAnSEVBRCcsICdPUFRJT05TJywgJ1BPU1QnLCAnUFVUJ11cblxuICBmdW5jdGlvbiBub3JtYWxpemVNZXRob2QobWV0aG9kKSB7XG4gICAgdmFyIHVwY2FzZWQgPSBtZXRob2QudG9VcHBlckNhc2UoKVxuICAgIHJldHVybiAobWV0aG9kcy5pbmRleE9mKHVwY2FzZWQpID4gLTEpID8gdXBjYXNlZCA6IG1ldGhvZFxuICB9XG5cbiAgZnVuY3Rpb24gUmVxdWVzdChpbnB1dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHlcbiAgICBpZiAoUmVxdWVzdC5wcm90b3R5cGUuaXNQcm90b3R5cGVPZihpbnB1dCkpIHtcbiAgICAgIGlmIChpbnB1dC5ib2R5VXNlZCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKVxuICAgICAgfVxuICAgICAgdGhpcy51cmwgPSBpbnB1dC51cmxcbiAgICAgIHRoaXMuY3JlZGVudGlhbHMgPSBpbnB1dC5jcmVkZW50aWFsc1xuICAgICAgaWYgKCFvcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMoaW5wdXQuaGVhZGVycylcbiAgICAgIH1cbiAgICAgIHRoaXMubWV0aG9kID0gaW5wdXQubWV0aG9kXG4gICAgICB0aGlzLm1vZGUgPSBpbnB1dC5tb2RlXG4gICAgICBpZiAoIWJvZHkpIHtcbiAgICAgICAgYm9keSA9IGlucHV0Ll9ib2R5SW5pdFxuICAgICAgICBpbnB1dC5ib2R5VXNlZCA9IHRydWVcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy51cmwgPSBpbnB1dFxuICAgIH1cblxuICAgIHRoaXMuY3JlZGVudGlhbHMgPSBvcHRpb25zLmNyZWRlbnRpYWxzIHx8IHRoaXMuY3JlZGVudGlhbHMgfHwgJ29taXQnXG4gICAgaWYgKG9wdGlvbnMuaGVhZGVycyB8fCAhdGhpcy5oZWFkZXJzKSB7XG4gICAgICB0aGlzLmhlYWRlcnMgPSBuZXcgSGVhZGVycyhvcHRpb25zLmhlYWRlcnMpXG4gICAgfVxuICAgIHRoaXMubWV0aG9kID0gbm9ybWFsaXplTWV0aG9kKG9wdGlvbnMubWV0aG9kIHx8IHRoaXMubWV0aG9kIHx8ICdHRVQnKVxuICAgIHRoaXMubW9kZSA9IG9wdGlvbnMubW9kZSB8fCB0aGlzLm1vZGUgfHwgbnVsbFxuICAgIHRoaXMucmVmZXJyZXIgPSBudWxsXG5cbiAgICBpZiAoKHRoaXMubWV0aG9kID09PSAnR0VUJyB8fCB0aGlzLm1ldGhvZCA9PT0gJ0hFQUQnKSAmJiBib2R5KSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCb2R5IG5vdCBhbGxvd2VkIGZvciBHRVQgb3IgSEVBRCByZXF1ZXN0cycpXG4gICAgfVxuICAgIHRoaXMuX2luaXRCb2R5KGJvZHkpXG4gIH1cblxuICBSZXF1ZXN0LnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgUmVxdWVzdCh0aGlzKVxuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlKGJvZHkpIHtcbiAgICB2YXIgZm9ybSA9IG5ldyBGb3JtRGF0YSgpXG4gICAgYm9keS50cmltKCkuc3BsaXQoJyYnKS5mb3JFYWNoKGZ1bmN0aW9uKGJ5dGVzKSB7XG4gICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgdmFyIHNwbGl0ID0gYnl0ZXMuc3BsaXQoJz0nKVxuICAgICAgICB2YXIgbmFtZSA9IHNwbGl0LnNoaWZ0KCkucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignPScpLnJlcGxhY2UoL1xcKy9nLCAnICcpXG4gICAgICAgIGZvcm0uYXBwZW5kKGRlY29kZVVSSUNvbXBvbmVudChuYW1lKSwgZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBmb3JtXG4gIH1cblxuICBmdW5jdGlvbiBoZWFkZXJzKHhocikge1xuICAgIHZhciBoZWFkID0gbmV3IEhlYWRlcnMoKVxuICAgIHZhciBwYWlycyA9IHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKS50cmltKCkuc3BsaXQoJ1xcbicpXG4gICAgcGFpcnMuZm9yRWFjaChmdW5jdGlvbihoZWFkZXIpIHtcbiAgICAgIHZhciBzcGxpdCA9IGhlYWRlci50cmltKCkuc3BsaXQoJzonKVxuICAgICAgdmFyIGtleSA9IHNwbGl0LnNoaWZ0KCkudHJpbSgpXG4gICAgICB2YXIgdmFsdWUgPSBzcGxpdC5qb2luKCc6JykudHJpbSgpXG4gICAgICBoZWFkLmFwcGVuZChrZXksIHZhbHVlKVxuICAgIH0pXG4gICAgcmV0dXJuIGhlYWRcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXF1ZXN0LnByb3RvdHlwZSlcblxuICBmdW5jdGlvbiBSZXNwb25zZShib2R5SW5pdCwgb3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9XG4gICAgfVxuXG4gICAgdGhpcy50eXBlID0gJ2RlZmF1bHQnXG4gICAgdGhpcy5zdGF0dXMgPSBvcHRpb25zLnN0YXR1c1xuICAgIHRoaXMub2sgPSB0aGlzLnN0YXR1cyA+PSAyMDAgJiYgdGhpcy5zdGF0dXMgPCAzMDBcbiAgICB0aGlzLnN0YXR1c1RleHQgPSBvcHRpb25zLnN0YXR1c1RleHRcbiAgICB0aGlzLmhlYWRlcnMgPSBvcHRpb25zLmhlYWRlcnMgaW5zdGFuY2VvZiBIZWFkZXJzID8gb3B0aW9ucy5oZWFkZXJzIDogbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICAgIHRoaXMudXJsID0gb3B0aW9ucy51cmwgfHwgJydcbiAgICB0aGlzLl9pbml0Qm9keShib2R5SW5pdClcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXNwb25zZS5wcm90b3R5cGUpXG5cbiAgUmVzcG9uc2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZSh0aGlzLl9ib2R5SW5pdCwge1xuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIHN0YXR1c1RleHQ6IHRoaXMuc3RhdHVzVGV4dCxcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKHRoaXMuaGVhZGVycyksXG4gICAgICB1cmw6IHRoaXMudXJsXG4gICAgfSlcbiAgfVxuXG4gIFJlc3BvbnNlLmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IDAsIHN0YXR1c1RleHQ6ICcnfSlcbiAgICByZXNwb25zZS50eXBlID0gJ2Vycm9yJ1xuICAgIHJldHVybiByZXNwb25zZVxuICB9XG5cbiAgdmFyIHJlZGlyZWN0U3RhdHVzZXMgPSBbMzAxLCAzMDIsIDMwMywgMzA3LCAzMDhdXG5cbiAgUmVzcG9uc2UucmVkaXJlY3QgPSBmdW5jdGlvbih1cmwsIHN0YXR1cykge1xuICAgIGlmIChyZWRpcmVjdFN0YXR1c2VzLmluZGV4T2Yoc3RhdHVzKSA9PT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHN0YXR1cyBjb2RlJylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IHN0YXR1cywgaGVhZGVyczoge2xvY2F0aW9uOiB1cmx9fSlcbiAgfVxuXG4gIHNlbGYuSGVhZGVycyA9IEhlYWRlcnM7XG4gIHNlbGYuUmVxdWVzdCA9IFJlcXVlc3Q7XG4gIHNlbGYuUmVzcG9uc2UgPSBSZXNwb25zZTtcblxuICBzZWxmLmZldGNoID0gZnVuY3Rpb24oaW5wdXQsIGluaXQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgcmVxdWVzdFxuICAgICAgaWYgKFJlcXVlc3QucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoaW5wdXQpICYmICFpbml0KSB7XG4gICAgICAgIHJlcXVlc3QgPSBpbnB1dFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KGlucHV0LCBpbml0KVxuICAgICAgfVxuXG4gICAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KClcblxuICAgICAgZnVuY3Rpb24gcmVzcG9uc2VVUkwoKSB7XG4gICAgICAgIGlmICgncmVzcG9uc2VVUkwnIGluIHhocikge1xuICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VVUkxcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEF2b2lkIHNlY3VyaXR5IHdhcm5pbmdzIG9uIGdldFJlc3BvbnNlSGVhZGVyIHdoZW4gbm90IGFsbG93ZWQgYnkgQ09SU1xuICAgICAgICBpZiAoL15YLVJlcXVlc3QtVVJMOi9tLnRlc3QoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpKSkge1xuICAgICAgICAgIHJldHVybiB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ1gtUmVxdWVzdC1VUkwnKVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGF0dXMgPSAoeGhyLnN0YXR1cyA9PT0gMTIyMykgPyAyMDQgOiB4aHIuc3RhdHVzXG4gICAgICAgIGlmIChzdGF0dXMgPCAxMDAgfHwgc3RhdHVzID4gNTk5KSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICBzdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgICBzdGF0dXNUZXh0OiB4aHIuc3RhdHVzVGV4dCxcbiAgICAgICAgICBoZWFkZXJzOiBoZWFkZXJzKHhociksXG4gICAgICAgICAgdXJsOiByZXNwb25zZVVSTCgpXG4gICAgICAgIH1cbiAgICAgICAgdmFyIGJvZHkgPSAncmVzcG9uc2UnIGluIHhociA/IHhoci5yZXNwb25zZSA6IHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgIHJlc29sdmUobmV3IFJlc3BvbnNlKGJvZHksIG9wdGlvbnMpKVxuICAgICAgfVxuXG4gICAgICB4aHIub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcignTmV0d29yayByZXF1ZXN0IGZhaWxlZCcpKVxuICAgICAgfVxuXG4gICAgICB4aHIub3BlbihyZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwsIHRydWUpXG5cbiAgICAgIGlmIChyZXF1ZXN0LmNyZWRlbnRpYWxzID09PSAnaW5jbHVkZScpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWVcbiAgICAgIH1cblxuICAgICAgaWYgKCdyZXNwb25zZVR5cGUnIGluIHhociAmJiBzdXBwb3J0LmJsb2IpIHtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJ1xuICAgICAgfVxuXG4gICAgICByZXF1ZXN0LmhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCB2YWx1ZSlcbiAgICAgIH0pXG5cbiAgICAgIHhoci5zZW5kKHR5cGVvZiByZXF1ZXN0Ll9ib2R5SW5pdCA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogcmVxdWVzdC5fYm9keUluaXQpXG4gICAgfSlcbiAgfVxuICBzZWxmLmZldGNoLnBvbHlmaWxsID0gdHJ1ZVxufSkodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnID8gc2VsZiA6IHRoaXMpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCB7IHBhcnRpdGlvbiwgcE1hcCwgb21pdCwgcXNpZnksIHN1cHBvcnQsIG5vYmF0Y2gsIHRvRGF0YUJvZHkgfSBmcm9tIFwiLi91dGlsc1wiO1xuaW1wb3J0IEhUVFAgZnJvbSBcIi4vaHR0cFwiO1xuaW1wb3J0IGVuZHBvaW50IGZyb20gXCIuL2VuZHBvaW50XCI7XG5pbXBvcnQgKiBhcyByZXF1ZXN0cyBmcm9tIFwiLi9yZXF1ZXN0c1wiO1xuaW1wb3J0IHsgYWdncmVnYXRlIH0gZnJvbSBcIi4vYmF0Y2hcIjtcbmltcG9ydCBCdWNrZXQgZnJvbSBcIi4vYnVja2V0XCI7XG5pbXBvcnQgeyBjYXBhYmxlIH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuXG4vKipcbiAqIEN1cnJlbnRseSBzdXBwb3J0ZWQgcHJvdG9jb2wgdmVyc2lvbi5cbiAqIEB0eXBlIHtTdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTVVBQT1JURURfUFJPVE9DT0xfVkVSU0lPTiA9IFwidjFcIjtcblxuLyoqXG4gKiBIaWdoIGxldmVsIEhUVFAgY2xpZW50IGZvciB0aGUgS2ludG8gQVBJLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBjbGllbnQgPSBuZXcgS2ludG9DbGllbnQoXCJodHRwczovL2tpbnRvLmRldi5tb3phd3MubmV0L3YxXCIpO1xuICogY2xpZW50LmJ1Y2tldChcImRlZmF1bHRcIilcbiogICAgLmNvbGxlY3Rpb24oXCJteS1ibG9nXCIpXG4qICAgIC5jcmVhdGVSZWNvcmQoe3RpdGxlOiBcIkZpcnN0IGFydGljbGVcIn0pXG4gKiAgIC50aGVuKGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSkpXG4gKiAgIC5jYXRjaChjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSkpO1xuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBLaW50b0NsaWVudEJhc2Uge1xuICAvKipcbiAgICogQ29uc3RydWN0b3IuXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgcmVtb3RlICBUaGUgcmVtb3RlIFVSTC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICBbb3B0aW9ucz17fV0gICAgICAgICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59ICAgICAgW29wdGlvbnMuc2FmZT10cnVlXSAgICAgICAgICAgQWRkcyBjb25jdXJyZW5jeSBoZWFkZXJzIHRvIGV2ZXJ5IHJlcXVlc3RzLlxuICAgKiBAcGFyYW0gIHtFdmVudEVtaXR0ZXJ9IFtvcHRpb25zLmV2ZW50cz1FdmVudEVtaXR0ZXJdIFRoZSBldmVudHMgaGFuZGxlciBpbnN0YW5jZS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICBbb3B0aW9ucy5oZWFkZXJzPXt9XSAgICAgICAgICBUaGUga2V5LXZhbHVlIGhlYWRlcnMgdG8gcGFzcyB0byBlYWNoIHJlcXVlc3QuXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICAgICAgW29wdGlvbnMuYnVja2V0PVwiZGVmYXVsdFwiXSAgICBUaGUgZGVmYXVsdCBidWNrZXQgdG8gdXNlLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgICAgIFtvcHRpb25zLnJlcXVlc3RNb2RlPVwiY29yc1wiXSAgVGhlIEhUVFAgcmVxdWVzdCBtb2RlIChmcm9tIEVTNiBmZXRjaCBzcGVjKS5cbiAgICogQHBhcmFtICB7TnVtYmVyfSAgICAgICBbb3B0aW9ucy50aW1lb3V0PTUwMDBdICAgICAgICBUaGUgcmVxdWVzdHMgdGltZW91dCBpbiBtcy5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHJlbW90ZSwgb3B0aW9ucz17fSkge1xuICAgIGlmICh0eXBlb2YocmVtb3RlKSAhPT0gXCJzdHJpbmdcIiB8fCAhcmVtb3RlLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCByZW1vdGUgVVJMOiBcIiArIHJlbW90ZSk7XG4gICAgfVxuICAgIGlmIChyZW1vdGVbcmVtb3RlLmxlbmd0aC0xXSA9PT0gXCIvXCIpIHtcbiAgICAgIHJlbW90ZSA9IHJlbW90ZS5zbGljZSgwLCAtMSk7XG4gICAgfVxuICAgIHRoaXMuX2JhY2tvZmZSZWxlYXNlVGltZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBEZWZhdWx0IHJlcXVlc3Qgb3B0aW9ucyBjb250YWluZXIuXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHRoaXMuZGVmYXVsdFJlcU9wdGlvbnMgPSB7XG4gICAgICBidWNrZXQ6ICBvcHRpb25zLmJ1Y2tldCAgfHwgXCJkZWZhdWx0XCIsXG4gICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMgfHwge30sXG4gICAgICBzYWZlOiAgICAhIW9wdGlvbnMuc2FmZSxcbiAgICB9O1xuXG4gICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5fcmVxdWVzdHMgPSBbXTtcbiAgICB0aGlzLl9pc0JhdGNoID0gISFvcHRpb25zLmJhdGNoO1xuXG4gICAgLy8gcHVibGljIHByb3BlcnRpZXNcbiAgICAvKipcbiAgICAgKiBUaGUgcmVtb3RlIHNlcnZlciBiYXNlIFVSTC5cbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMucmVtb3RlID0gcmVtb3RlO1xuICAgIC8qKlxuICAgICAqIEN1cnJlbnQgc2VydmVyIGluZm9ybWF0aW9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKiBAdHlwZSB7T2JqZWN0fG51bGx9XG4gICAgICovXG4gICAgdGhpcy5zZXJ2ZXJJbmZvID0gbnVsbDtcbiAgICAvKipcbiAgICAgKiBUaGUgZXZlbnQgZW1pdHRlciBpbnN0YW5jZS4gU2hvdWxkIGNvbXBseSB3aXRoIHRoZSBgRXZlbnRFbWl0dGVyYFxuICAgICAqIGludGVyZmFjZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICogQHR5cGUge0NsYXNzfVxuICAgICAqL1xuICAgIHRoaXMuZXZlbnRzID0gb3B0aW9ucy5ldmVudHM7XG5cbiAgICBjb25zdCB7cmVxdWVzdE1vZGUsIHRpbWVvdXR9ID0gb3B0aW9ucztcbiAgICAvKipcbiAgICAgKiBUaGUgSFRUUCBpbnN0YW5jZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICogQHR5cGUge0hUVFB9XG4gICAgICovXG4gICAgdGhpcy5odHRwID0gbmV3IEhUVFAodGhpcy5ldmVudHMsIHtyZXF1ZXN0TW9kZSwgdGltZW91dH0pO1xuICAgIHRoaXMuX3JlZ2lzdGVySFRUUEV2ZW50cygpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSByZW1vdGUgZW5kcG9pbnQgYmFzZSBVUkwuIFNldHRpbmcgdGhlIHZhbHVlIHdpbGwgYWxzbyBleHRyYWN0IGFuZFxuICAgKiB2YWxpZGF0ZSB0aGUgdmVyc2lvbi5cbiAgICogQHR5cGUge1N0cmluZ31cbiAgICovXG4gIGdldCByZW1vdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlbW90ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAaWdub3JlXG4gICAqL1xuICBzZXQgcmVtb3RlKHVybCkge1xuICAgIGxldCB2ZXJzaW9uO1xuICAgIHRyeSB7XG4gICAgICB2ZXJzaW9uID0gdXJsLm1hdGNoKC9cXC8odlxcZCspXFwvPyQvKVsxXTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSByZW1vdGUgVVJMIG11c3QgY29udGFpbiB0aGUgdmVyc2lvbjogXCIgKyB1cmwpO1xuICAgIH1cbiAgICBpZiAodmVyc2lvbiAhPT0gU1VQUE9SVEVEX1BST1RPQ09MX1ZFUlNJT04pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJvdG9jb2wgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuICAgIH1cbiAgICB0aGlzLl9yZW1vdGUgPSB1cmw7XG4gICAgdGhpcy5fdmVyc2lvbiA9IHZlcnNpb247XG4gIH1cblxuICAvKipcbiAgICogVGhlIGN1cnJlbnQgc2VydmVyIHByb3RvY29sIHZlcnNpb24sIGVnLiBgdjFgLlxuICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgKi9cbiAgZ2V0IHZlcnNpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3ZlcnNpb247XG4gIH1cblxuICAvKipcbiAgICogQmFja29mZiByZW1haW5pbmcgdGltZSwgaW4gbWlsbGlzZWNvbmRzLiBEZWZhdWx0cyB0byB6ZXJvIGlmIG5vIGJhY2tvZmYgaXNcbiAgICogb25nb2luZy5cbiAgICpcbiAgICogQHR5cGUge051bWJlcn1cbiAgICovXG4gIGdldCBiYWNrb2ZmKCkge1xuICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgaWYgKHRoaXMuX2JhY2tvZmZSZWxlYXNlVGltZSAmJiBjdXJyZW50VGltZSA8IHRoaXMuX2JhY2tvZmZSZWxlYXNlVGltZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2JhY2tvZmZSZWxlYXNlVGltZSAtIGN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgSFRUUCBldmVudHMuXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcmVnaXN0ZXJIVFRQRXZlbnRzKCkge1xuICAgIC8vIFByZXZlbnQgcmVnaXN0ZXJpbmcgZXZlbnQgZnJvbSBhIGJhdGNoIGNsaWVudCBpbnN0YW5jZVxuICAgIGlmICghdGhpcy5faXNCYXRjaCkge1xuICAgICAgdGhpcy5ldmVudHMub24oXCJiYWNrb2ZmXCIsIGJhY2tvZmZNcyA9PiB7XG4gICAgICAgIHRoaXMuX2JhY2tvZmZSZWxlYXNlVGltZSA9IGJhY2tvZmZNcztcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBhIGJ1Y2tldCBvYmplY3QgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGl0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lICAgICAgICAgICAgICBUaGUgYnVja2V0IG5hbWUuXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zPXt9XSAgICAgIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgIFRoZSByZXN1bHRpbmcgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge1N0cmluZ30gIFtvcHRpb25zLmJ1Y2tldF0gIFRoZSByZXN1bHRpbmcgYnVja2V0IG5hbWUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgZXh0ZW5kZWQgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtCdWNrZXR9XG4gICAqL1xuICBidWNrZXQobmFtZSwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IGJ1Y2tldE9wdGlvbnMgPSBvbWl0KHRoaXMuX2dldFJlcXVlc3RPcHRpb25zKG9wdGlvbnMpLCBcImJ1Y2tldFwiKTtcbiAgICByZXR1cm4gbmV3IEJ1Y2tldCh0aGlzLCBuYW1lLCBidWNrZXRPcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSByZXF1ZXN0IG9wdGlvbnMgb2JqZWN0LCBkZWVwbHkgbWVyZ2luZyB0aGUgY2xpZW50IGNvbmZpZ3VyZWRcbiAgICogZGVmYXVsdHMgd2l0aCB0aGUgb25lcyBwcm92aWRlZCBhcyBhcmd1bWVudC5cbiAgICpcbiAgICogTm90ZTogSGVhZGVycyB3b24ndCBiZSBvdmVycmlkZW4gYnV0IG1lcmdlZCB3aXRoIGluc3RhbmNlIGRlZmF1bHQgb25lcy5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICAgIHtPYmplY3R9ICBbb3B0aW9ucz17fV0gICAgICBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICAgKiBAcHJvcGVydHkge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgIFRoZSByZXN1bHRpbmcgc2FmZSBvcHRpb24uXG4gICAqIEBwcm9wZXJ0eSB7U3RyaW5nfSAgW29wdGlvbnMuYnVja2V0XSAgVGhlIHJlc3VsdGluZyBidWNrZXQgbmFtZSBvcHRpb24uXG4gICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSAgW29wdGlvbnMuaGVhZGVyc10gVGhlIGV4dGVuZGVkIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiAgIHtPYmplY3R9XG4gICAqL1xuICBfZ2V0UmVxdWVzdE9wdGlvbnMob3B0aW9ucz17fSkge1xuICAgIHJldHVybiB7XG4gICAgICAuLi50aGlzLmRlZmF1bHRSZXFPcHRpb25zLFxuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIGJhdGNoOiB0aGlzLl9pc0JhdGNoLFxuICAgICAgLy8gTm90ZTogaGVhZGVycyBzaG91bGQgbmV2ZXIgYmUgb3ZlcnJpZGVuIGJ1dCBleHRlbmRlZFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAuLi50aGlzLmRlZmF1bHRSZXFPcHRpb25zLmhlYWRlcnMsXG4gICAgICAgIC4uLm9wdGlvbnMuaGVhZGVyc1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyBzZXJ2ZXIgaW5mb3JtYXRpb24gYW5kIHBlcnNpc3QgdGhlbSBsb2NhbGx5LiBUaGlzIG9wZXJhdGlvbiBpc1xuICAgKiB1c3VhbGx5IHBlcmZvcm1lZCBhIHNpbmdsZSB0aW1lIGR1cmluZyB0aGUgaW5zdGFuY2UgbGlmZWN5Y2xlLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucz17fV0gVGhlIHJlcXVlc3Qgb3B0aW9ucy5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIGZldGNoU2VydmVySW5mbyhvcHRpb25zPXt9KSB7XG4gICAgaWYgKHRoaXMuc2VydmVySW5mbykge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLnNlcnZlckluZm8pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5odHRwLnJlcXVlc3QodGhpcy5yZW1vdGUgKyBlbmRwb2ludChcInJvb3RcIiksIHtcbiAgICAgIGhlYWRlcnM6IHsuLi50aGlzLmRlZmF1bHRSZXFPcHRpb25zLmhlYWRlcnMsIC4uLm9wdGlvbnMuaGVhZGVyc31cbiAgICB9KVxuICAgICAgLnRoZW4oKHtqc29ufSkgPT4ge1xuICAgICAgICB0aGlzLnNlcnZlckluZm8gPSBqc29uO1xuICAgICAgICByZXR1cm4gdGhpcy5zZXJ2ZXJJbmZvO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIEtpbnRvIHNlcnZlciBzZXR0aW5ncy5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnM9e31dIFRoZSByZXF1ZXN0IG9wdGlvbnMuXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBAbm9iYXRjaChcIlRoaXMgb3BlcmF0aW9uIGlzIG5vdCBzdXBwb3J0ZWQgd2l0aGluIGEgYmF0Y2ggb3BlcmF0aW9uLlwiKVxuICBmZXRjaFNlcnZlclNldHRpbmdzKG9wdGlvbnM9e30pIHtcbiAgICByZXR1cm4gdGhpcy5mZXRjaFNlcnZlckluZm8ob3B0aW9ucykudGhlbigoe3NldHRpbmdzfSkgPT4gc2V0dGluZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHNlcnZlciBjYXBhYmlsaXRpZXMgaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zPXt9XSBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgQG5vYmF0Y2goXCJUaGlzIG9wZXJhdGlvbiBpcyBub3Qgc3VwcG9ydGVkIHdpdGhpbiBhIGJhdGNoIG9wZXJhdGlvbi5cIilcbiAgZmV0Y2hTZXJ2ZXJDYXBhYmlsaXRpZXMob3B0aW9ucz17fSkge1xuICAgIHJldHVybiB0aGlzLmZldGNoU2VydmVySW5mbyhvcHRpb25zKS50aGVuKCh7Y2FwYWJpbGl0aWVzfSkgPT4gY2FwYWJpbGl0aWVzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBhdXRoZW50aWNhdGVkIHVzZXIgaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zPXt9XSBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgQG5vYmF0Y2goXCJUaGlzIG9wZXJhdGlvbiBpcyBub3Qgc3VwcG9ydGVkIHdpdGhpbiBhIGJhdGNoIG9wZXJhdGlvbi5cIilcbiAgZmV0Y2hVc2VyKG9wdGlvbnM9e30pIHtcbiAgICByZXR1cm4gdGhpcy5mZXRjaFNlcnZlckluZm8ob3B0aW9ucykudGhlbigoe3VzZXJ9KSA9PiB1c2VyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBhdXRoZW50aWNhdGVkIHVzZXIgaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zPXt9XSBUaGUgcmVxdWVzdCBvcHRpb25zLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgQG5vYmF0Y2goXCJUaGlzIG9wZXJhdGlvbiBpcyBub3Qgc3VwcG9ydGVkIHdpdGhpbiBhIGJhdGNoIG9wZXJhdGlvbi5cIilcbiAgZmV0Y2hIVFRQQXBpVmVyc2lvbihvcHRpb25zPXt9KSB7XG4gICAgcmV0dXJuIHRoaXMuZmV0Y2hTZXJ2ZXJJbmZvKG9wdGlvbnMpLnRoZW4oKHtodHRwX2FwaV92ZXJzaW9ufSkgPT4ge1xuICAgICAgcmV0dXJuIGh0dHBfYXBpX3ZlcnNpb247XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUHJvY2VzcyBiYXRjaCByZXF1ZXN0cywgY2h1bmtpbmcgdGhlbSBhY2NvcmRpbmcgdG8gdGhlIGJhdGNoX21heF9yZXF1ZXN0c1xuICAgKiBzZXJ2ZXIgc2V0dGluZyB3aGVuIG5lZWRlZC5cbiAgICpcbiAgICogQHBhcmFtICB7QXJyYXl9ICByZXF1ZXN0cyAgICAgVGhlIGxpc3Qgb2YgYmF0Y2ggc3VicmVxdWVzdHMgdG8gcGVyZm9ybS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucz17fV0gVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgX2JhdGNoUmVxdWVzdHMocmVxdWVzdHMsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCBoZWFkZXJzID0gey4uLnRoaXMuZGVmYXVsdFJlcU9wdGlvbnMuaGVhZGVycywgLi4ub3B0aW9ucy5oZWFkZXJzfTtcbiAgICBpZiAoIXJlcXVlc3RzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZldGNoU2VydmVyU2V0dGluZ3MoKVxuICAgICAgLnRoZW4oc2VydmVyU2V0dGluZ3MgPT4ge1xuICAgICAgICBjb25zdCBtYXhSZXF1ZXN0cyA9IHNlcnZlclNldHRpbmdzW1wiYmF0Y2hfbWF4X3JlcXVlc3RzXCJdO1xuICAgICAgICBpZiAobWF4UmVxdWVzdHMgJiYgcmVxdWVzdHMubGVuZ3RoID4gbWF4UmVxdWVzdHMpIHtcbiAgICAgICAgICBjb25zdCBjaHVua3MgPSBwYXJ0aXRpb24ocmVxdWVzdHMsIG1heFJlcXVlc3RzKTtcbiAgICAgICAgICByZXR1cm4gcE1hcChjaHVua3MsIGNodW5rID0+IHRoaXMuX2JhdGNoUmVxdWVzdHMoY2h1bmssIG9wdGlvbnMpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5leGVjdXRlKHtcbiAgICAgICAgICBwYXRoOiBlbmRwb2ludChcImJhdGNoXCIpLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgICAgaGVhZGVyczogaGVhZGVycyxcbiAgICAgICAgICBib2R5OiB7XG4gICAgICAgICAgICBkZWZhdWx0czoge2hlYWRlcnN9LFxuICAgICAgICAgICAgcmVxdWVzdHM6IHJlcXVlc3RzXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICAgIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgcmVzcG9uc2VzXG4gICAgICAgICAgLnRoZW4oKHtyZXNwb25zZXN9KSA9PiByZXNwb25zZXMpO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZHMgYmF0Y2ggcmVxdWVzdHMgdG8gdGhlIHJlbW90ZSBzZXJ2ZXIuXG4gICAqXG4gICAqIE5vdGU6IFJlc2VydmVkIGZvciBpbnRlcm5hbCB1c2Ugb25seS5cbiAgICpcbiAgICogQGlnbm9yZVxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm4gICAgICAgICAgICAgICAgICAgICAgICBUaGUgZnVuY3Rpb24gdG8gdXNlIGZvciBkZXNjcmliaW5nIGJhdGNoIG9wcy5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIFtvcHRpb25zPXt9XSAgICAgICAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgW29wdGlvbnMuc2FmZV0gICAgICAgICAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICBbb3B0aW9ucy5idWNrZXRdICAgICAgICAgIFRoZSBidWNrZXQgbmFtZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICBbb3B0aW9ucy5jb2xsZWN0aW9uXSAgICAgIFRoZSBjb2xsZWN0aW9uIG5hbWUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgICBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgW29wdGlvbnMuYWdncmVnYXRlPWZhbHNlXSBQcm9kdWNlcyBhbiBhZ2dyZWdhdGVkIHJlc3VsdCBvYmplY3QuXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBAbm9iYXRjaChcIkNhbid0IHVzZSBiYXRjaCB3aXRoaW4gYSBiYXRjaCFcIilcbiAgYmF0Y2goZm4sIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByb290QmF0Y2ggPSBuZXcgS2ludG9DbGllbnRCYXNlKHRoaXMucmVtb3RlLCB7XG4gICAgICAuLi50aGlzLl9vcHRpb25zLFxuICAgICAgLi4udGhpcy5fZ2V0UmVxdWVzdE9wdGlvbnMob3B0aW9ucyksXG4gICAgICBiYXRjaDogdHJ1ZVxuICAgIH0pO1xuICAgIGxldCBidWNrZXRCYXRjaCwgY29sbEJhdGNoO1xuICAgIGlmIChvcHRpb25zLmJ1Y2tldCkge1xuICAgICAgYnVja2V0QmF0Y2ggPSByb290QmF0Y2guYnVja2V0KG9wdGlvbnMuYnVja2V0KTtcbiAgICAgIGlmIChvcHRpb25zLmNvbGxlY3Rpb24pIHtcbiAgICAgICAgY29sbEJhdGNoID0gYnVja2V0QmF0Y2guY29sbGVjdGlvbihvcHRpb25zLmNvbGxlY3Rpb24pO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBiYXRjaENsaWVudCA9IGNvbGxCYXRjaCB8fCBidWNrZXRCYXRjaCB8fCByb290QmF0Y2g7XG4gICAgdHJ5IHtcbiAgICAgIGZuKGJhdGNoQ2xpZW50KTtcbiAgICB9IGNhdGNoKGVycikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9iYXRjaFJlcXVlc3RzKHJvb3RCYXRjaC5fcmVxdWVzdHMsIG9wdGlvbnMpXG4gICAgICAudGhlbigocmVzcG9uc2VzKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25zLmFnZ3JlZ2F0ZSkge1xuICAgICAgICAgIHJldHVybiBhZ2dyZWdhdGUocmVzcG9uc2VzLCByb290QmF0Y2guX3JlcXVlc3RzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzcG9uc2VzO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgYW4gYXRvbWljIEhUVFAgcmVxdWVzdC5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgcmVxdWVzdCAgICAgICAgICAgICBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zPXt9XSAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSBbb3B0aW9ucy5yYXc9ZmFsc2VdIElmIHRydWUsIHJlc29sdmUgd2l0aCBmdWxsIHJlc3BvbnNlXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnN0cmluZ2lmeT10cnVlXSBJZiB0cnVlLCBzZXJpYWxpemUgYm9keSBkYXRhIHRvXG4gICAqIEpTT04uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBleGVjdXRlKHJlcXVlc3QsIG9wdGlvbnM9e3JhdzogZmFsc2UsIHN0cmluZ2lmeTogdHJ1ZX0pIHtcbiAgICBjb25zdCB7cmF3LCBzdHJpbmdpZnl9ID0gb3B0aW9ucztcbiAgICAvLyBJZiB3ZSdyZSB3aXRoaW4gYSBiYXRjaCwgYWRkIHRoZSByZXF1ZXN0IHRvIHRoZSBzdGFjayB0byBzZW5kIGF0IG9uY2UuXG4gICAgaWYgKHRoaXMuX2lzQmF0Y2gpIHtcbiAgICAgIHRoaXMuX3JlcXVlc3RzLnB1c2gocmVxdWVzdCk7XG4gICAgICAvLyBSZXNvbHZlIHdpdGggYSBtZXNzYWdlIGluIGNhc2UgcGVvcGxlIGF0dGVtcHQgYXQgY29uc3VtaW5nIHRoZSByZXN1bHRcbiAgICAgIC8vIGZyb20gd2l0aGluIGEgYmF0Y2ggb3BlcmF0aW9uLlxuICAgICAgY29uc3QgbXNnID0gXCJUaGlzIHJlc3VsdCBpcyBnZW5lcmF0ZWQgZnJvbSB3aXRoaW4gYSBiYXRjaCBcIiArXG4gICAgICAgICAgICAgICAgICBcIm9wZXJhdGlvbiBhbmQgc2hvdWxkIG5vdCBiZSBjb25zdW1lZC5cIjtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmF3ID8ge2pzb246IG1zZywgaGVhZGVyczoge2dldCgpe319fSA6IG1zZyk7XG4gICAgfVxuICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmZldGNoU2VydmVyU2V0dGluZ3MoKVxuICAgICAgLnRoZW4oXyA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLmh0dHAucmVxdWVzdCh0aGlzLnJlbW90ZSArIHJlcXVlc3QucGF0aCwge1xuICAgICAgICAgIC4uLnJlcXVlc3QsXG4gICAgICAgICAgYm9keTogc3RyaW5naWZ5ID8gSlNPTi5zdHJpbmdpZnkocmVxdWVzdC5ib2R5KSA6IHJlcXVlc3QuYm9keSxcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICByZXR1cm4gcmF3ID8gcHJvbWlzZSA6IHByb21pc2UudGhlbigoe2pzb259KSA9PiBqc29uKTtcbiAgfVxuXG4gIHBhZ2luYXRlZExpc3QocGF0aCwgcGFyYW1zLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgeyBzb3J0LCBmaWx0ZXJzLCBsaW1pdCwgcGFnZXMsIHNpbmNlIH0gPSB7XG4gICAgICBzb3J0OiBcIi1sYXN0X21vZGlmaWVkXCIsXG4gICAgICAuLi5wYXJhbXNcbiAgICB9O1xuICAgIC8vIFNhZmV0eS9Db25zaXN0ZW5jeSBjaGVjayBvbiBFVGFnIHZhbHVlLlxuICAgIGlmIChzaW5jZSAmJiB0eXBlb2Yoc2luY2UpICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdmFsdWUgZm9yIHNpbmNlICgke3NpbmNlfSksIHNob3VsZCBiZSBFVGFnIHZhbHVlLmApO1xuICAgIH1cblxuICAgIGNvbnN0IHF1ZXJ5c3RyaW5nID0gcXNpZnkoe1xuICAgICAgLi4uZmlsdGVycyxcbiAgICAgIF9zb3J0OiBzb3J0LFxuICAgICAgX2xpbWl0OiBsaW1pdCxcbiAgICAgIF9zaW5jZTogc2luY2UsXG4gICAgfSk7XG4gICAgbGV0IHJlc3VsdHMgPSBbXSwgY3VycmVudCA9IDA7XG5cbiAgICBjb25zdCBuZXh0ID0gZnVuY3Rpb24obmV4dFBhZ2UpIHtcbiAgICAgIGlmICghbmV4dFBhZ2UpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGFnaW5hdGlvbiBleGhhdXN0ZWQuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHByb2Nlc3NOZXh0UGFnZShuZXh0UGFnZSk7XG4gICAgfTtcblxuICAgIGNvbnN0IHByb2Nlc3NOZXh0UGFnZSA9IChuZXh0UGFnZSkgPT4ge1xuICAgICAgY29uc3Qge2hlYWRlcnN9ID0gb3B0aW9ucztcbiAgICAgIHJldHVybiB0aGlzLmh0dHAucmVxdWVzdChuZXh0UGFnZSwge2hlYWRlcnN9KVxuICAgICAgICAudGhlbihoYW5kbGVSZXNwb25zZSk7XG4gICAgfTtcblxuICAgIGNvbnN0IHBhZ2VSZXN1bHRzID0gKHJlc3VsdHMsIG5leHRQYWdlLCBldGFnLCB0b3RhbFJlY29yZHMpID0+IHtcbiAgICAgIC8vIEVUYWcgc3RyaW5nIGlzIHN1cHBvc2VkIHRvIGJlIG9wYXF1ZSBhbmQgc3RvcmVkIMKrYXMtaXPCuy5cbiAgICAgIC8vIEVUYWcgaGVhZGVyIHZhbHVlcyBhcmUgcXVvdGVkIChiZWNhdXNlIG9mICogYW5kIFcvXCJmb29cIikuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBsYXN0X21vZGlmaWVkOiBldGFnID8gZXRhZy5yZXBsYWNlKC9cIi9nLCBcIlwiKSA6IGV0YWcsXG4gICAgICAgIGRhdGE6IHJlc3VsdHMsXG4gICAgICAgIG5leHQ6IG5leHQuYmluZChudWxsLCBuZXh0UGFnZSksXG4gICAgICAgIGhhc05leHRQYWdlOiAhIW5leHRQYWdlLFxuICAgICAgICB0b3RhbFJlY29yZHMsXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBjb25zdCBoYW5kbGVSZXNwb25zZSA9ICh7aGVhZGVycywganNvbn0pID0+IHtcbiAgICAgIGNvbnN0IG5leHRQYWdlID0gaGVhZGVycy5nZXQoXCJOZXh0LVBhZ2VcIik7XG4gICAgICBjb25zdCBldGFnID0gaGVhZGVycy5nZXQoXCJFVGFnXCIpO1xuICAgICAgY29uc3QgdG90YWxSZWNvcmRzID0gcGFyc2VJbnQoaGVhZGVycy5nZXQoXCJUb3RhbC1SZWNvcmRzXCIpLCAxMCk7XG5cbiAgICAgIGlmICghcGFnZXMpIHtcbiAgICAgICAgcmV0dXJuIHBhZ2VSZXN1bHRzKGpzb24uZGF0YSwgbmV4dFBhZ2UsIGV0YWcsIHRvdGFsUmVjb3Jkcyk7XG4gICAgICB9XG4gICAgICAvLyBBZ2dyZWdhdGUgbmV3IHJlc3VsdHMgd2l0aCBwcmV2aW91cyBvbmVzXG4gICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQoanNvbi5kYXRhKTtcbiAgICAgIGN1cnJlbnQgKz0gMTtcbiAgICAgIGlmIChjdXJyZW50ID49IHBhZ2VzIHx8ICFuZXh0UGFnZSkge1xuICAgICAgICAvLyBQYWdpbmF0aW9uIGV4aGF1c3RlZFxuICAgICAgICByZXR1cm4gcGFnZVJlc3VsdHMocmVzdWx0cywgbmV4dFBhZ2UsIGV0YWcsIHRvdGFsUmVjb3Jkcyk7XG4gICAgICB9XG4gICAgICAvLyBGb2xsb3cgbmV4dCBwYWdlXG4gICAgICByZXR1cm4gcHJvY2Vzc05leHRQYWdlKG5leHRQYWdlKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0ZSh7XG4gICAgICBwYXRoOiBwYXRoICsgXCI/XCIgKyBxdWVyeXN0cmluZyxcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgfSwge3JhdzogdHJ1ZX0pLnRoZW4oaGFuZGxlUmVzcG9uc2UpO1xuICB9XG5cbiAgLyoqXG4gICAqIExpc3RzIGFsbCBwZXJtaXNzaW9ucy5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucz17fV0gICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3RbXSwgRXJyb3I+fVxuICAgKi9cbiAgQGNhcGFibGUoW1wicGVybWlzc2lvbnNfZW5kcG9pbnRcIl0pXG4gIGxpc3RQZXJtaXNzaW9ucyhvcHRpb25zPXt9KSB7XG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0ZSh7XG4gICAgICBwYXRoOiBlbmRwb2ludChcInBlcm1pc3Npb25zXCIpLFxuICAgICAgaGVhZGVyczogey4uLnRoaXMuZGVmYXVsdFJlcU9wdGlvbnMuaGVhZGVycywgLi4ub3B0aW9ucy5oZWFkZXJzfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgbGlzdCBvZiBidWNrZXRzLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zPXt9XSAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdFtdLCBFcnJvcj59XG4gICAqL1xuICBsaXN0QnVja2V0cyhvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcGF0aCA9IGVuZHBvaW50KFwiYnVja2V0XCIpO1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9nZXRSZXF1ZXN0T3B0aW9ucyhvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5wYWdpbmF0ZWRMaXN0KHBhdGgsIG9wdGlvbnMsIHJlcU9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYnVja2V0IG9uIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICBpZCAgICAgICAgICAgICAgICBUaGUgYnVja2V0IG5hbWUuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucz17fV0gICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59ICBbb3B0aW9ucy5kYXRhXSAgICBUaGUgYnVja2V0IGRhdGEgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgW29wdGlvbnMuc2FmZV0gICAgVGhlIHNhZmUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgW29wdGlvbnMuaGVhZGVyc10gVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIGNyZWF0ZUJ1Y2tldChpZCwgb3B0aW9ucz17fSkge1xuICAgIGlmICghaWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgYnVja2V0IGlkIGlzIHJlcXVpcmVkLlwiKTtcbiAgICB9XG4gICAgLy8gTm90ZSB0aGF0IHdlIHNpbXBseSBpZ25vcmUgYW55IFwiYnVja2V0XCIgb3B0aW9uIHBhc3NlZCBoZXJlLCBhcyB0aGUgb25lXG4gICAgLy8gd2UncmUgaW50ZXJlc3RlZCBpbiBpcyB0aGUgb25lIHByb3ZpZGVkIGFzIGEgcmVxdWlyZWQgYXJndW1lbnQuXG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuX2dldFJlcXVlc3RPcHRpb25zKG9wdGlvbnMpO1xuICAgIGNvbnN0IHsgZGF0YT17fSwgcGVybWlzc2lvbnMgfSA9IHJlcU9wdGlvbnM7XG4gICAgZGF0YS5pZCA9IGlkO1xuICAgIGNvbnN0IHBhdGggPSBlbmRwb2ludChcImJ1Y2tldFwiLCBpZCk7XG4gICAgcmV0dXJuIHRoaXMuZXhlY3V0ZShyZXF1ZXN0cy5jcmVhdGVSZXF1ZXN0KHBhdGgsIHsgZGF0YSwgcGVybWlzc2lvbnMgfSwgcmVxT3B0aW9ucykpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgYSBidWNrZXQgZnJvbSB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBAaWdub3JlXG4gICAqIEBwYXJhbSAge09iamVjdHxTdHJpbmd9IGJ1Y2tldCAgICAgICAgICAgICAgICAgIFRoZSBidWNrZXQgdG8gZGVsZXRlLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBbb3B0aW9ucz17fV0gICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59ICAgICAgIFtvcHRpb25zLnNhZmVdICAgICAgICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7TnVtYmVyfSAgICAgICAgW29wdGlvbnMubGFzdF9tb2RpZmllZF0gVGhlIGxhc3RfbW9kaWZpZWQgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgZGVsZXRlQnVja2V0KGJ1Y2tldCwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IGJ1Y2tldE9iaiA9IHRvRGF0YUJvZHkoYnVja2V0KTtcbiAgICBpZiAoIWJ1Y2tldE9iai5pZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBidWNrZXQgaWQgaXMgcmVxdWlyZWQuXCIpO1xuICAgIH1cbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJidWNrZXRcIiwgYnVja2V0T2JqLmlkKTtcbiAgICBjb25zdCB7IGxhc3RfbW9kaWZpZWQgfSA9IHsgYnVja2V0T2JqIH07XG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuX2dldFJlcXVlc3RPcHRpb25zKHsgbGFzdF9tb2RpZmllZCwgLi4ub3B0aW9ucyB9KTtcbiAgICByZXR1cm4gdGhpcy5leGVjdXRlKHJlcXVlc3RzLmRlbGV0ZVJlcXVlc3QocGF0aCwgcmVxT3B0aW9ucykpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgYWxsIGJ1Y2tldHMgb24gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQGlnbm9yZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucz17fV0gICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgICAgICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7TnVtYmVyfSAgW29wdGlvbnMubGFzdF9tb2RpZmllZF0gVGhlIGxhc3RfbW9kaWZpZWQgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgQHN1cHBvcnQoXCIxLjRcIiwgXCIyLjBcIilcbiAgZGVsZXRlQnVja2V0cyhvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuX2dldFJlcXVlc3RPcHRpb25zKG9wdGlvbnMpO1xuICAgIGNvbnN0IHBhdGggPSBlbmRwb2ludChcImJ1Y2tldFwiKTtcbiAgICByZXR1cm4gdGhpcy5leGVjdXRlKHJlcXVlc3RzLmRlbGV0ZVJlcXVlc3QocGF0aCwgcmVxT3B0aW9ucykpO1xuICB9XG59XG4iLCIvKipcbiAqIEV4cG9ydHMgYmF0Y2ggcmVzcG9uc2VzIGFzIGEgcmVzdWx0IG9iamVjdC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtICB7QXJyYXl9IHJlc3BvbnNlcyBUaGUgYmF0Y2ggc3VicmVxdWVzdCByZXNwb25zZXMuXG4gKiBAcGFyYW0gIHtBcnJheX0gcmVxdWVzdHMgIFRoZSBpbml0aWFsIGlzc3VlZCByZXF1ZXN0cy5cbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFnZ3JlZ2F0ZShyZXNwb25zZXM9W10sIHJlcXVlc3RzPVtdKSB7XG4gIGlmIChyZXNwb25zZXMubGVuZ3RoICE9PSByZXF1ZXN0cy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZXNwb25zZXMgbGVuZ3RoIHNob3VsZCBtYXRjaCByZXF1ZXN0cyBvbmUuXCIpO1xuICB9XG4gIGNvbnN0IHJlc3VsdHMgPSB7XG4gICAgZXJyb3JzOiAgICBbXSxcbiAgICBwdWJsaXNoZWQ6IFtdLFxuICAgIGNvbmZsaWN0czogW10sXG4gICAgc2tpcHBlZDogICBbXSxcbiAgfTtcbiAgcmV0dXJuIHJlc3BvbnNlcy5yZWR1Y2UoKGFjYywgcmVzcG9uc2UsIGluZGV4KSA9PiB7XG4gICAgY29uc3Qge3N0YXR1c30gPSByZXNwb25zZTtcbiAgICBpZiAoc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCA0MDApIHtcbiAgICAgIGFjYy5wdWJsaXNoZWQucHVzaChyZXNwb25zZS5ib2R5KTtcbiAgICB9IGVsc2UgaWYgKHN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICBhY2Muc2tpcHBlZC5wdXNoKHJlc3BvbnNlLmJvZHkpO1xuICAgIH0gZWxzZSBpZiAoc3RhdHVzID09PSA0MTIpIHtcbiAgICAgIGFjYy5jb25mbGljdHMucHVzaCh7XG4gICAgICAgIC8vIFhYWDogc3BlY2lmeWluZyB0aGUgdHlwZSBpcyBwcm9iYWJseSBzdXBlcmZsdW91c1xuICAgICAgICB0eXBlOiBcIm91dGdvaW5nXCIsXG4gICAgICAgIGxvY2FsOiByZXF1ZXN0c1tpbmRleF0uYm9keSxcbiAgICAgICAgcmVtb3RlOiByZXNwb25zZS5ib2R5LmRldGFpbHMgJiZcbiAgICAgICAgICAgICAgICByZXNwb25zZS5ib2R5LmRldGFpbHMuZXhpc3RpbmcgfHwgbnVsbFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFjYy5lcnJvcnMucHVzaCh7XG4gICAgICAgIHBhdGg6IHJlc3BvbnNlLnBhdGgsXG4gICAgICAgIHNlbnQ6IHJlcXVlc3RzW2luZGV4XSxcbiAgICAgICAgZXJyb3I6IHJlc3BvbnNlLmJvZHlcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gYWNjO1xuICB9LCByZXN1bHRzKTtcbn1cbiIsImltcG9ydCB7IHRvRGF0YUJvZHksIGlzT2JqZWN0LCBjYXBhYmxlIH0gZnJvbSBcIi4vdXRpbHNcIjtcbmltcG9ydCBDb2xsZWN0aW9uIGZyb20gXCIuL2NvbGxlY3Rpb25cIjtcbmltcG9ydCAqIGFzIHJlcXVlc3RzIGZyb20gXCIuL3JlcXVlc3RzXCI7XG5pbXBvcnQgZW5kcG9pbnQgZnJvbSBcIi4vZW5kcG9pbnRcIjtcblxuXG4vKipcbiAqIEFic3RyYWN0IHJlcHJlc2VudGF0aW9uIG9mIGEgc2VsZWN0ZWQgYnVja2V0LlxuICpcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQnVja2V0IHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yLlxuICAgKlxuICAgKiBAcGFyYW0gIHtLaW50b0NsaWVudH0gY2xpZW50ICAgICAgICAgICAgVGhlIGNsaWVudCBpbnN0YW5jZS5cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgIG5hbWUgICAgICAgICAgICAgIFRoZSBidWNrZXQgbmFtZS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgIFtvcHRpb25zPXt9XSAgICAgIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgICAgW29wdGlvbnMuc2FmZV0gICAgVGhlIHNhZmUgb3B0aW9uLlxuICAgKi9cbiAgY29uc3RydWN0b3IoY2xpZW50LCBuYW1lLCBvcHRpb25zPXt9KSB7XG4gICAgLyoqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xuICAgIC8qKlxuICAgICAqIFRoZSBidWNrZXQgbmFtZS5cbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgLyoqXG4gICAgICogVGhlIGRlZmF1bHQgb3B0aW9ucyBvYmplY3QuXG4gICAgICogQGlnbm9yZVxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICAvKipcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdGhpcy5faXNCYXRjaCA9ICEhb3B0aW9ucy5iYXRjaDtcbiAgfVxuXG4gIC8qKlxuICAgKiBNZXJnZXMgcGFzc2VkIHJlcXVlc3Qgb3B0aW9ucyB3aXRoIGRlZmF1bHQgYnVja2V0IG9uZXMsIGlmIGFueS5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucz17fV0gVGhlIG9wdGlvbnMgdG8gbWVyZ2UuXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICAgIFRoZSBtZXJnZWQgb3B0aW9ucy5cbiAgICovXG4gIF9idWNrZXRPcHRpb25zKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCBoZWFkZXJzID0ge1xuICAgICAgLi4udGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9ucy5oZWFkZXJzLFxuICAgICAgLi4ub3B0aW9ucy5oZWFkZXJzXG4gICAgfTtcbiAgICByZXR1cm4ge1xuICAgICAgLi4udGhpcy5vcHRpb25zLFxuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIGhlYWRlcnMsXG4gICAgICBidWNrZXQ6IHRoaXMubmFtZSxcbiAgICAgIGJhdGNoOiB0aGlzLl9pc0JhdGNoXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZWxlY3RzIGEgY29sbGVjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSAgbmFtZSAgICAgICAgICAgICAgVGhlIGNvbGxlY3Rpb24gbmFtZS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnM9e31dICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSBbb3B0aW9ucy5zYWZlXSAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAqL1xuICBjb2xsZWN0aW9uKG5hbWUsIG9wdGlvbnM9e30pIHtcbiAgICByZXR1cm4gbmV3IENvbGxlY3Rpb24odGhpcy5jbGllbnQsIHRoaXMsIG5hbWUsIHRoaXMuX2J1Y2tldE9wdGlvbnMob3B0aW9ucykpO1xuICB9XG5cblxuICAvKipcbiAgICogUmV0cmlldmVzIGJ1Y2tldCBkYXRhLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zPXt9XSAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgZ2V0RGF0YShvcHRpb25zPXt9KSB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmV4ZWN1dGUoe1xuICAgICAgcGF0aDogZW5kcG9pbnQoXCJidWNrZXRcIiwgdGhpcy5uYW1lKSxcbiAgICAgIGhlYWRlcnM6IHsuLi50aGlzLm9wdGlvbnMuaGVhZGVycywgLi4ub3B0aW9ucy5oZWFkZXJzfVxuICAgIH0pXG4gICAgLnRoZW4oKHJlcykgPT4gcmVzLmRhdGEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBidWNrZXQgZGF0YS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgZGF0YSAgICAgICAgICAgICAgICAgICAgVGhlIGJ1Y2tldCBkYXRhIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnM9e31dICAgICAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucy5oZWFkZXJzXSAgICAgICBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSBbb3B0aW9ucy5zYWZlXSAgICAgICAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnBhdGNoXSAgICAgICAgIFRoZSBwYXRjaCBvcHRpb24uXG4gICAqIEBwYXJhbSAge051bWJlcn0gIFtvcHRpb25zLmxhc3RfbW9kaWZpZWRdIFRoZSBsYXN0X21vZGlmaWVkIG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIHNldERhdGEoZGF0YSwgb3B0aW9ucz17fSkge1xuICAgIGlmICghaXNPYmplY3QoZGF0YSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgYnVja2V0IG9iamVjdCBpcyByZXF1aXJlZC5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgYnVja2V0ID0gey4uLmRhdGEsIGlkOiB0aGlzLm5hbWV9O1xuXG4gICAgLy8gRm9yIGRlZmF1bHQgYnVja2V0LCB3ZSBuZWVkIHRvIGRyb3AgdGhlIGlkIGZyb20gdGhlIGRhdGEgb2JqZWN0LlxuICAgIC8vIEJ1ZyBpbiBLaW50byA8IDMuMS4xXG4gICAgY29uc3QgYnVja2V0SWQgPSBidWNrZXQuaWQ7XG4gICAgaWYgKGJ1Y2tldC5pZCA9PT0gXCJkZWZhdWx0XCIpIHtcbiAgICAgIGRlbGV0ZSBidWNrZXQuaWQ7XG4gICAgfVxuXG4gICAgY29uc3QgcGF0aCA9IGVuZHBvaW50KFwiYnVja2V0XCIsIGJ1Y2tldElkKTtcbiAgICBjb25zdCB7IHBlcm1pc3Npb25zIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB7Li4udGhpcy5fYnVja2V0T3B0aW9ucyhvcHRpb25zKX07XG4gICAgY29uc3QgcmVxdWVzdCA9IHJlcXVlc3RzLnVwZGF0ZVJlcXVlc3QocGF0aCwge2RhdGE6IGJ1Y2tldCwgcGVybWlzc2lvbnN9LCByZXFPcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZXhlY3V0ZShyZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGxpc3Qgb2YgaGlzdG9yeSBlbnRyaWVzIGluIHRoZSBjdXJyZW50IGJ1Y2tldC5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucz17fV0gICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxBcnJheTxPYmplY3Q+LCBFcnJvcj59XG4gICAqL1xuICBAY2FwYWJsZShbXCJoaXN0b3J5XCJdKVxuICBsaXN0SGlzdG9yeShvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcGF0aCA9IGVuZHBvaW50KFwiaGlzdG9yeVwiLCB0aGlzLm5hbWUpO1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9idWNrZXRPcHRpb25zKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5wYWdpbmF0ZWRMaXN0KHBhdGgsIG9wdGlvbnMsIHJlcU9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgbGlzdCBvZiBjb2xsZWN0aW9ucyBpbiB0aGUgY3VycmVudCBidWNrZXQuXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnM9e31dICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8QXJyYXk8T2JqZWN0PiwgRXJyb3I+fVxuICAgKi9cbiAgbGlzdENvbGxlY3Rpb25zKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJjb2xsZWN0aW9uXCIsIHRoaXMubmFtZSk7XG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuX2J1Y2tldE9wdGlvbnMob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LnBhZ2luYXRlZExpc3QocGF0aCwgb3B0aW9ucywgcmVxT3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBjb2xsZWN0aW9uIGluIGN1cnJlbnQgYnVja2V0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd8dW5kZWZpbmVkfSAgaWQgICAgICAgICAgVGhlIGNvbGxlY3Rpb24gaWQuXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zPXt9XSAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgICAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zLmhlYWRlcnNdICAgICBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucy5wZXJtaXNzaW9uc10gVGhlIHBlcm1pc3Npb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMuZGF0YV0gICAgICAgIFRoZSBkYXRhIG9iamVjdC5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIGNyZWF0ZUNvbGxlY3Rpb24oaWQsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXFPcHRpb25zID0gdGhpcy5fYnVja2V0T3B0aW9ucyhvcHRpb25zKTtcbiAgICBjb25zdCB7IHBlcm1pc3Npb25zLCBkYXRhPXt9IH0gPSByZXFPcHRpb25zO1xuICAgIGRhdGEuaWQgPSBpZDtcbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJjb2xsZWN0aW9uXCIsIHRoaXMubmFtZSwgaWQpO1xuICAgIGNvbnN0IHJlcXVlc3QgPSByZXF1ZXN0cy5jcmVhdGVSZXF1ZXN0KHBhdGgsIHtkYXRhLCBwZXJtaXNzaW9uc30sIHJlcU9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHJlcXVlc3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlbGV0ZXMgYSBjb2xsZWN0aW9uIGZyb20gdGhlIGN1cnJlbnQgYnVja2V0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R8U3RyaW5nfSBjb2xsZWN0aW9uICAgICAgICAgICAgICBUaGUgY29sbGVjdGlvbiB0byBkZWxldGUuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIFtvcHRpb25zPXt9XSAgICAgICAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gICAgICAgW29wdGlvbnMuc2FmZV0gICAgICAgICAgVGhlIHNhZmUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICAgICAgICBbb3B0aW9ucy5sYXN0X21vZGlmaWVkXSBUaGUgbGFzdF9tb2RpZmllZCBvcHRpb24uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBkZWxldGVDb2xsZWN0aW9uKGNvbGxlY3Rpb24sIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCBjb2xsZWN0aW9uT2JqID0gdG9EYXRhQm9keShjb2xsZWN0aW9uKTtcbiAgICBpZiAoIWNvbGxlY3Rpb25PYmouaWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgY29sbGVjdGlvbiBpZCBpcyByZXF1aXJlZC5cIik7XG4gICAgfVxuICAgIGNvbnN0IHtpZCwgbGFzdF9tb2RpZmllZH0gPSBjb2xsZWN0aW9uT2JqO1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9idWNrZXRPcHRpb25zKHsgbGFzdF9tb2RpZmllZCwgLi4ub3B0aW9ucyB9KTtcbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJjb2xsZWN0aW9uXCIsIHRoaXMubmFtZSwgaWQpO1xuICAgIGNvbnN0IHJlcXVlc3QgPSByZXF1ZXN0cy5kZWxldGVSZXF1ZXN0KHBhdGgsIHJlcU9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHJlcXVlc3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgbGlzdCBvZiBncm91cHMgaW4gdGhlIGN1cnJlbnQgYnVja2V0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zPXt9XSAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPEFycmF5PE9iamVjdD4sIEVycm9yPn1cbiAgICovXG4gIGxpc3RHcm91cHMob3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHBhdGggPSBlbmRwb2ludChcImdyb3VwXCIsIHRoaXMubmFtZSk7XG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuX2J1Y2tldE9wdGlvbnMob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LnBhZ2luYXRlZExpc3QocGF0aCwgb3B0aW9ucywgcmVxT3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBncm91cCBpbiBjdXJyZW50IGJ1Y2tldC5cbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSBpZCAgICAgICAgICAgICAgICBUaGUgZ3JvdXAgaWQuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnM9e31dICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBnZXRHcm91cChpZCwgb3B0aW9ucz17fSkge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHtcbiAgICAgIHBhdGg6IGVuZHBvaW50KFwiZ3JvdXBcIiwgdGhpcy5uYW1lLCBpZCksXG4gICAgICBoZWFkZXJzOiB7Li4udGhpcy5vcHRpb25zLmhlYWRlcnMsIC4uLm9wdGlvbnMuaGVhZGVyc31cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGdyb3VwIGluIGN1cnJlbnQgYnVja2V0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd8dW5kZWZpbmVkfSAgaWQgICAgICAgICAgICAgICAgICAgIFRoZSBncm91cCBpZC5cbiAgICogQHBhcmFtICB7QXJyYXk8U3RyaW5nPn0gICAgIFttZW1iZXJzPVtdXSAgICAgICAgICBUaGUgbGlzdCBvZiBwcmluY2lwYWxzLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgICAgW29wdGlvbnM9e31dICAgICAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgICAgIFtvcHRpb25zLmRhdGFdICAgICAgICBUaGUgZGF0YSBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICAgICBbb3B0aW9ucy5wZXJtaXNzaW9uc10gVGhlIHBlcm1pc3Npb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gICAgICAgICAgIFtvcHRpb25zLnNhZmVdICAgICAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgICAgICBbb3B0aW9ucy5oZWFkZXJzXSAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIGNyZWF0ZUdyb3VwKGlkLCBtZW1iZXJzPVtdLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuX2J1Y2tldE9wdGlvbnMob3B0aW9ucyk7XG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgIC4uLm9wdGlvbnMuZGF0YSxcbiAgICAgIGlkLFxuICAgICAgbWVtYmVyc1xuICAgIH07XG4gICAgY29uc3QgcGF0aCA9IGVuZHBvaW50KFwiZ3JvdXBcIiwgdGhpcy5uYW1lLCBpZCk7XG4gICAgY29uc3Qge3Blcm1pc3Npb25zfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgcmVxdWVzdCA9IHJlcXVlc3RzLmNyZWF0ZVJlcXVlc3QocGF0aCwge2RhdGEsIHBlcm1pc3Npb25zfSwgcmVxT3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmV4ZWN1dGUocmVxdWVzdCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyBhbiBleGlzdGluZyBncm91cCBpbiBjdXJyZW50IGJ1Y2tldC5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgZ3JvdXAgICAgICAgICAgICAgICAgICAgVGhlIGdyb3VwIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnM9e31dICAgICAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucy5kYXRhXSAgICAgICAgICBUaGUgZGF0YSBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zLnBlcm1pc3Npb25zXSAgIFRoZSBwZXJtaXNzaW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgICAgICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7TnVtYmVyfSAgW29wdGlvbnMubGFzdF9tb2RpZmllZF0gVGhlIGxhc3RfbW9kaWZpZWQgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgdXBkYXRlR3JvdXAoZ3JvdXAsIG9wdGlvbnM9e30pIHtcbiAgICBpZiAoIWlzT2JqZWN0KGdyb3VwKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBncm91cCBvYmplY3QgaXMgcmVxdWlyZWQuXCIpO1xuICAgIH1cbiAgICBpZiAoIWdyb3VwLmlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBIGdyb3VwIGlkIGlzIHJlcXVpcmVkLlwiKTtcbiAgICB9XG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuX2J1Y2tldE9wdGlvbnMob3B0aW9ucyk7XG4gICAgY29uc3QgZGF0YSA9IHtcbiAgICAgIC4uLm9wdGlvbnMuZGF0YSxcbiAgICAgIC4uLmdyb3VwXG4gICAgfTtcbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJncm91cFwiLCB0aGlzLm5hbWUsIGdyb3VwLmlkKTtcbiAgICBjb25zdCB7cGVybWlzc2lvbnN9ID0gb3B0aW9ucztcbiAgICBjb25zdCByZXF1ZXN0ID0gcmVxdWVzdHMudXBkYXRlUmVxdWVzdChwYXRoLCB7ZGF0YSwgcGVybWlzc2lvbnN9LCByZXFPcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZXhlY3V0ZShyZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGVzIGEgZ3JvdXAgZnJvbSB0aGUgY3VycmVudCBidWNrZXQuXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdHxTdHJpbmd9IGdyb3VwICAgICAgICAgICAgICAgICAgIFRoZSBncm91cCB0byBkZWxldGUuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIFtvcHRpb25zPXt9XSAgICAgICAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gICAgICAgW29wdGlvbnMuc2FmZV0gICAgICAgICAgVGhlIHNhZmUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICAgICAgICBbb3B0aW9ucy5sYXN0X21vZGlmaWVkXSBUaGUgbGFzdF9tb2RpZmllZCBvcHRpb24uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBkZWxldGVHcm91cChncm91cCwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IGdyb3VwT2JqID0gdG9EYXRhQm9keShncm91cCk7XG4gICAgY29uc3Qge2lkLCBsYXN0X21vZGlmaWVkfSA9IGdyb3VwT2JqO1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9idWNrZXRPcHRpb25zKHtsYXN0X21vZGlmaWVkLCAuLi5vcHRpb25zfSk7XG4gICAgY29uc3QgcGF0aCA9IGVuZHBvaW50KFwiZ3JvdXBcIiwgdGhpcy5uYW1lLCBpZCk7XG4gICAgY29uc3QgcmVxdWVzdCA9IHJlcXVlc3RzLmRlbGV0ZVJlcXVlc3QocGF0aCwgcmVxT3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmV4ZWN1dGUocmVxdWVzdCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBsaXN0IG9mIHBlcm1pc3Npb25zIGZvciB0aGlzIGJ1Y2tldC5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucz17fV0gICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIGdldFBlcm1pc3Npb25zKG9wdGlvbnM9e30pIHtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZXhlY3V0ZSh7XG4gICAgICBwYXRoOiBlbmRwb2ludChcImJ1Y2tldFwiLCB0aGlzLm5hbWUpLFxuICAgICAgaGVhZGVyczogey4uLnRoaXMub3B0aW9ucy5oZWFkZXJzLCAuLi5vcHRpb25zLmhlYWRlcnN9XG4gICAgfSlcbiAgICAudGhlbigocmVzKSA9PiByZXMucGVybWlzc2lvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlcGxhY2VzIGFsbCBleGlzdGluZyBidWNrZXQgcGVybWlzc2lvbnMgd2l0aCB0aGUgb25lcyBwcm92aWRlZC5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgcGVybWlzc2lvbnMgICAgICAgICAgICAgVGhlIHBlcm1pc3Npb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnM9e31dICAgICAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0XG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgICAgICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMubGFzdF9tb2RpZmllZF0gVGhlIGxhc3RfbW9kaWZpZWQgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgc2V0UGVybWlzc2lvbnMocGVybWlzc2lvbnMsIG9wdGlvbnM9e30pIHtcbiAgICBpZiAoIWlzT2JqZWN0KHBlcm1pc3Npb25zKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSBwZXJtaXNzaW9ucyBvYmplY3QgaXMgcmVxdWlyZWQuXCIpO1xuICAgIH1cbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJidWNrZXRcIiwgdGhpcy5uYW1lKTtcbiAgICBjb25zdCByZXFPcHRpb25zID0gey4uLnRoaXMuX2J1Y2tldE9wdGlvbnMob3B0aW9ucyl9O1xuICAgIGNvbnN0IHtsYXN0X21vZGlmaWVkfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgZGF0YSA9IHtsYXN0X21vZGlmaWVkfTtcbiAgICBjb25zdCByZXF1ZXN0ID0gcmVxdWVzdHMudXBkYXRlUmVxdWVzdChwYXRoLCB7ZGF0YSwgcGVybWlzc2lvbnN9LCByZXFPcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZXhlY3V0ZShyZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBiYXRjaCBvcGVyYXRpb25zIGF0IHRoZSBjdXJyZW50IGJ1Y2tldCBsZXZlbC5cbiAgICpcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGZuICAgICAgICAgICAgICAgICAgIFRoZSBiYXRjaCBvcGVyYXRpb24gZnVuY3Rpb24uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucz17fV0gICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucy5oZWFkZXJzXSAgICBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgW29wdGlvbnMuc2FmZV0gICAgICAgVGhlIHNhZmUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgW29wdGlvbnMuYWdncmVnYXRlXSAgUHJvZHVjZXMgYSBncm91cGVkIHJlc3VsdCBvYmplY3QuXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBiYXRjaChmbiwgb3B0aW9ucz17fSkge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5iYXRjaChmbiwgdGhpcy5fYnVja2V0T3B0aW9ucyhvcHRpb25zKSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IHY0IGFzIHV1aWQgfSBmcm9tIFwidXVpZFwiO1xuXG5pbXBvcnQgeyBjYXBhYmxlLCB0b0RhdGFCb2R5LCBpc09iamVjdCB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgKiBhcyByZXF1ZXN0cyBmcm9tIFwiLi9yZXF1ZXN0c1wiO1xuaW1wb3J0IGVuZHBvaW50IGZyb20gXCIuL2VuZHBvaW50XCI7XG5cblxuLyoqXG4gKiBBYnN0cmFjdCByZXByZXNlbnRhdGlvbiBvZiBhIHNlbGVjdGVkIGNvbGxlY3Rpb24uXG4gKlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDb2xsZWN0aW9uIHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yLlxuICAgKlxuICAgKiBAcGFyYW0gIHtLaW50b0NsaWVudH0gIGNsaWVudCAgICAgICAgICAgIFRoZSBjbGllbnQgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSAge0J1Y2tldH0gICAgICAgYnVja2V0ICAgICAgICAgICAgVGhlIGJ1Y2tldCBpbnN0YW5jZS5cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgICAgICBuYW1lICAgICAgICAgICAgICBUaGUgY29sbGVjdGlvbiBuYW1lLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgIFtvcHRpb25zPXt9XSAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgICAgIFtvcHRpb25zLnNhZmVdICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGNsaWVudCwgYnVja2V0LCBuYW1lLCBvcHRpb25zPXt9KSB7XG4gICAgLyoqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xuICAgIC8qKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB0aGlzLmJ1Y2tldCA9IGJ1Y2tldDtcbiAgICAvKipcbiAgICAgKiBUaGUgY29sbGVjdGlvbiBuYW1lLlxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdGhpcy5uYW1lID0gbmFtZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBkZWZhdWx0IGNvbGxlY3Rpb24gb3B0aW9ucyBvYmplY3QsIGVtYmVkZGluZyB0aGUgZGVmYXVsdCBidWNrZXQgb25lcy5cbiAgICAgKiBAaWdub3JlXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICAuLi50aGlzLmJ1Y2tldC5vcHRpb25zLFxuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgLi4udGhpcy5idWNrZXQub3B0aW9ucyAmJiB0aGlzLmJ1Y2tldC5vcHRpb25zLmhlYWRlcnMsXG4gICAgICAgIC4uLm9wdGlvbnMuaGVhZGVyc1xuICAgICAgfVxuICAgIH07XG4gICAgLyoqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHRoaXMuX2lzQmF0Y2ggPSAhIW9wdGlvbnMuYmF0Y2g7XG4gIH1cblxuICAvKipcbiAgICogTWVyZ2VzIHBhc3NlZCByZXF1ZXN0IG9wdGlvbnMgd2l0aCBkZWZhdWx0IGJ1Y2tldCBhbmQgY29sbGVjdGlvbiBvbmVzLCBpZlxuICAgKiBhbnkuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnM9e31dIFRoZSBvcHRpb25zIHRvIG1lcmdlLlxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgICBUaGUgbWVyZ2VkIG9wdGlvbnMuXG4gICAqL1xuICBfY29sbE9wdGlvbnMob3B0aW9ucz17fSkge1xuICAgIGNvbnN0IGhlYWRlcnMgPSB7XG4gICAgICAuLi50aGlzLm9wdGlvbnMgJiYgdGhpcy5vcHRpb25zLmhlYWRlcnMsXG4gICAgICAuLi5vcHRpb25zLmhlYWRlcnNcbiAgICB9O1xuICAgIHJldHVybiB7XG4gICAgICAuLi50aGlzLm9wdGlvbnMsXG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgaGVhZGVycyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgdG90YWwgbnVtYmVyIG9mIHJlY29yZHMgaW4gdGhpcyBjb2xsZWN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zPXt9XSAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE51bWJlciwgRXJyb3I+fVxuICAgKi9cbiAgZ2V0VG90YWxSZWNvcmRzKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7IGhlYWRlcnMgfSA9IHRoaXMuX2NvbGxPcHRpb25zKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHtcbiAgICAgIG1ldGhvZDogXCJIRUFEXCIsXG4gICAgICBwYXRoOiBlbmRwb2ludChcInJlY29yZFwiLCB0aGlzLmJ1Y2tldC5uYW1lLCB0aGlzLm5hbWUpLFxuICAgICAgaGVhZGVyc1xuICAgIH0sIHtyYXc6IHRydWV9KVxuICAgICAgLnRoZW4oKHtoZWFkZXJzfSkgPT4gcGFyc2VJbnQoaGVhZGVycy5nZXQoXCJUb3RhbC1SZWNvcmRzXCIpLCAxMCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyBjb2xsZWN0aW9uIGRhdGEuXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnM9e31dICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBnZXREYXRhKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7IGhlYWRlcnMgfSA9IHRoaXMuX2NvbGxPcHRpb25zKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHtcbiAgICAgIHBhdGg6IGVuZHBvaW50KFwiY29sbGVjdGlvblwiLCB0aGlzLmJ1Y2tldC5uYW1lLCB0aGlzLm5hbWUpLFxuICAgICAgaGVhZGVyc1xuICAgIH0pXG4gICAgLnRoZW4ocmVzID0+IHJlcy5kYXRhKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgY29sbGVjdGlvbiBkYXRhLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgZGF0YSAgICAgICAgICAgICAgICAgICAgVGhlIGNvbGxlY3Rpb24gZGF0YSBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucz17fV0gICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucy5oZWFkZXJzXSAgICAgICBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgW29wdGlvbnMuc2FmZV0gICAgICAgICAgVGhlIHNhZmUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSAgW29wdGlvbnMucGF0Y2hdICAgICAgICAgVGhlIHBhdGNoIG9wdGlvbi5cbiAgICogQHBhcmFtICB7TnVtYmVyfSAgIFtvcHRpb25zLmxhc3RfbW9kaWZpZWRdIFRoZSBsYXN0X21vZGlmaWVkIG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIHNldERhdGEoZGF0YSwgb3B0aW9ucz17fSkge1xuICAgIGlmICghaXNPYmplY3QoZGF0YSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgY29sbGVjdGlvbiBvYmplY3QgaXMgcmVxdWlyZWQuXCIpO1xuICAgIH1cbiAgICBjb25zdCByZXFPcHRpb25zID0gdGhpcy5fY29sbE9wdGlvbnMob3B0aW9ucyk7XG4gICAgY29uc3QgeyBwZXJtaXNzaW9ucyB9ID0gcmVxT3B0aW9ucztcblxuICAgIGNvbnN0IHBhdGggPSBlbmRwb2ludChcImNvbGxlY3Rpb25cIiwgdGhpcy5idWNrZXQubmFtZSwgdGhpcy5uYW1lKTtcbiAgICBjb25zdCByZXF1ZXN0ID0gcmVxdWVzdHMudXBkYXRlUmVxdWVzdChwYXRoLCB7ZGF0YSwgcGVybWlzc2lvbnN9LCByZXFPcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZXhlY3V0ZShyZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIGxpc3Qgb2YgcGVybWlzc2lvbnMgZm9yIHRoaXMgY29sbGVjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucz17fV0gICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIGdldFBlcm1pc3Npb25zKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7IGhlYWRlcnMgfSA9IHRoaXMuX2NvbGxPcHRpb25zKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHtcbiAgICAgIHBhdGg6IGVuZHBvaW50KFwiY29sbGVjdGlvblwiLCB0aGlzLmJ1Y2tldC5uYW1lLCB0aGlzLm5hbWUpLFxuICAgICAgaGVhZGVyc1xuICAgIH0pXG4gICAgLnRoZW4ocmVzID0+IHJlcy5wZXJtaXNzaW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgYWxsIGV4aXN0aW5nIGNvbGxlY3Rpb24gcGVybWlzc2lvbnMgd2l0aCB0aGUgb25lcyBwcm92aWRlZC5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIHBlcm1pc3Npb25zICAgICAgICAgICAgIFRoZSBwZXJtaXNzaW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucz17fV0gICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3RcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgIFtvcHRpb25zLmhlYWRlcnNdICAgICAgIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59ICBbb3B0aW9ucy5zYWZlXSAgICAgICAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge051bWJlcn0gICBbb3B0aW9ucy5sYXN0X21vZGlmaWVkXSBUaGUgbGFzdF9tb2RpZmllZCBvcHRpb24uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBzZXRQZXJtaXNzaW9ucyhwZXJtaXNzaW9ucywgb3B0aW9ucz17fSkge1xuICAgIGlmICghaXNPYmplY3QocGVybWlzc2lvbnMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBIHBlcm1pc3Npb25zIG9iamVjdCBpcyByZXF1aXJlZC5cIik7XG4gICAgfVxuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9jb2xsT3B0aW9ucyhvcHRpb25zKTtcbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJjb2xsZWN0aW9uXCIsIHRoaXMuYnVja2V0Lm5hbWUsIHRoaXMubmFtZSk7XG4gICAgY29uc3QgZGF0YSA9IHsgbGFzdF9tb2RpZmllZDogb3B0aW9ucy5sYXN0X21vZGlmaWVkIH07XG4gICAgY29uc3QgcmVxdWVzdCA9IHJlcXVlc3RzLnVwZGF0ZVJlcXVlc3QocGF0aCwge2RhdGEsIHBlcm1pc3Npb25zfSwgcmVxT3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmV4ZWN1dGUocmVxdWVzdCk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHJlY29yZCBpbiBjdXJyZW50IGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gIHJlY29yZCAgICAgICAgICAgICAgICBUaGUgcmVjb3JkIHRvIGNyZWF0ZS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnM9e31dICAgICAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMuaGVhZGVyc10gICAgIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgICAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zLnBlcm1pc3Npb25zXSBUaGUgcGVybWlzc2lvbnMgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgY3JlYXRlUmVjb3JkKHJlY29yZCwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9jb2xsT3B0aW9ucyhvcHRpb25zKTtcbiAgICBjb25zdCB7IHBlcm1pc3Npb25zIH0gPSByZXFPcHRpb25zO1xuICAgIGNvbnN0IHBhdGggPSBlbmRwb2ludChcInJlY29yZFwiLCB0aGlzLmJ1Y2tldC5uYW1lLCB0aGlzLm5hbWUsIHJlY29yZC5pZCk7XG4gICAgY29uc3QgcmVxdWVzdCA9IHJlcXVlc3RzLmNyZWF0ZVJlcXVlc3QocGF0aCwge2RhdGE6IHJlY29yZCwgcGVybWlzc2lvbnN9LCByZXFPcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZXhlY3V0ZShyZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIGF0dGFjaG1lbnQgdG8gYSByZWNvcmQsIGNyZWF0aW5nIHRoZSByZWNvcmQgd2hlbiBpdCBkb2Vzbid0IGV4aXN0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICBkYXRhVVJMICAgICAgICAgICAgICAgICBUaGUgZGF0YSB1cmwuXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtyZWNvcmQ9e31dICAgICAgICAgICAgIFRoZSByZWNvcmQgZGF0YS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnM9e31dICAgICAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucy5oZWFkZXJzXSAgICAgICBUaGUgaGVhZGVycyBvYmplY3Qgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtCb29sZWFufSBbb3B0aW9ucy5zYWZlXSAgICAgICAgICBUaGUgc2FmZSBvcHRpb24uXG4gICAqIEBwYXJhbSAge051bWJlcn0gIFtvcHRpb25zLmxhc3RfbW9kaWZpZWRdIFRoZSBsYXN0X21vZGlmaWVkIG9wdGlvbi5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMucGVybWlzc2lvbnNdICAgVGhlIHBlcm1pc3Npb25zIG9wdGlvbi5cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgW29wdGlvbnMuZmlsZW5hbWVdICAgICAgRm9yY2UgdGhlIGF0dGFjaG1lbnQgZmlsZW5hbWUuXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICBAY2FwYWJsZShbXCJhdHRhY2htZW50c1wiXSlcbiAgYWRkQXR0YWNobWVudChkYXRhVVJJLCByZWNvcmQ9e30sIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXFPcHRpb25zID0gdGhpcy5fY29sbE9wdGlvbnMob3B0aW9ucyk7XG4gICAgY29uc3Qge3Blcm1pc3Npb25zfSA9IHJlcU9wdGlvbnM7XG4gICAgY29uc3QgaWQgPSByZWNvcmQuaWQgfHwgdXVpZC52NCgpO1xuICAgIGNvbnN0IHBhdGggPSBlbmRwb2ludChcImF0dGFjaG1lbnRcIiwgdGhpcy5idWNrZXQubmFtZSwgdGhpcy5uYW1lLCBpZCk7XG4gICAgY29uc3QgYWRkQXR0YWNobWVudFJlcXVlc3QgPSByZXF1ZXN0cy5hZGRBdHRhY2htZW50UmVxdWVzdChwYXRoLCBkYXRhVVJJLCB7XG4gICAgICBkYXRhOiByZWNvcmQsXG4gICAgICBwZXJtaXNzaW9uc1xuICAgIH0sIHJlcU9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKGFkZEF0dGFjaG1lbnRSZXF1ZXN0LCB7c3RyaW5naWZ5OiBmYWxzZX0pXG4gICAgICAudGhlbigoKSA9PiB0aGlzLmdldFJlY29yZChpZCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYW4gYXR0YWNobWVudCBmcm9tIGEgZ2l2ZW4gcmVjb3JkLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICByZWNvcmRJZCAgICAgICAgICAgICAgICBUaGUgcmVjb3JkIGlkLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICBbb3B0aW9ucz17fV0gICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zLmhlYWRlcnNdICAgICAgIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59IFtvcHRpb25zLnNhZmVdICAgICAgICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICogQHBhcmFtICB7TnVtYmVyfSAgW29wdGlvbnMubGFzdF9tb2RpZmllZF0gVGhlIGxhc3RfbW9kaWZpZWQgb3B0aW9uLlxuICAgKi9cbiAgQGNhcGFibGUoW1wiYXR0YWNobWVudHNcIl0pXG4gIHJlbW92ZUF0dGFjaG1lbnQocmVjb3JkSWQsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXFPcHRpb25zID0gdGhpcy5fY29sbE9wdGlvbnMob3B0aW9ucyk7XG4gICAgY29uc3QgcGF0aCA9IGVuZHBvaW50KFwiYXR0YWNobWVudFwiLCB0aGlzLmJ1Y2tldC5uYW1lLCB0aGlzLm5hbWUsIHJlY29yZElkKTtcbiAgICBjb25zdCByZXF1ZXN0ID0gcmVxdWVzdHMuZGVsZXRlUmVxdWVzdChwYXRoLCByZXFPcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZXhlY3V0ZShyZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIGEgcmVjb3JkIGluIGN1cnJlbnQgY29sbGVjdGlvbi5cbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSAgcmVjb3JkICAgICAgICAgICAgICAgICAgVGhlIHJlY29yZCB0byB1cGRhdGUuXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zPXt9XSAgICAgICAgICAgIFRoZSBvcHRpb25zIG9iamVjdC5cbiAgICogQHBhcmFtICB7T2JqZWN0fSAgW29wdGlvbnMuaGVhZGVyc10gICAgICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gW29wdGlvbnMuc2FmZV0gICAgICAgICAgVGhlIHNhZmUgb3B0aW9uLlxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICBbb3B0aW9ucy5sYXN0X21vZGlmaWVkXSBUaGUgbGFzdF9tb2RpZmllZCBvcHRpb24uXG4gICAqIEBwYXJhbSAge09iamVjdH0gIFtvcHRpb25zLnBlcm1pc3Npb25zXSAgIFRoZSBwZXJtaXNzaW9ucyBvcHRpb24uXG4gICAqIEByZXR1cm4ge1Byb21pc2U8T2JqZWN0LCBFcnJvcj59XG4gICAqL1xuICB1cGRhdGVSZWNvcmQocmVjb3JkLCBvcHRpb25zPXt9KSB7XG4gICAgaWYgKCFpc09iamVjdChyZWNvcmQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBIHJlY29yZCBvYmplY3QgaXMgcmVxdWlyZWQuXCIpO1xuICAgIH1cbiAgICBpZiAoIXJlY29yZC5pZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSByZWNvcmQgaWQgaXMgcmVxdWlyZWQuXCIpO1xuICAgIH1cbiAgICBjb25zdCByZXFPcHRpb25zID0gdGhpcy5fY29sbE9wdGlvbnMob3B0aW9ucyk7XG4gICAgY29uc3QgeyBwZXJtaXNzaW9ucyB9ID0gcmVxT3B0aW9ucztcbiAgICBjb25zdCBwYXRoID0gZW5kcG9pbnQoXCJyZWNvcmRcIiwgdGhpcy5idWNrZXQubmFtZSwgdGhpcy5uYW1lLCByZWNvcmQuaWQpO1xuICAgIGNvbnN0IHJlcXVlc3QgPSByZXF1ZXN0cy51cGRhdGVSZXF1ZXN0KHBhdGgsIHtkYXRhOiByZWNvcmQsIHBlcm1pc3Npb25zfSwgcmVxT3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmV4ZWN1dGUocmVxdWVzdCk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlcyBhIHJlY29yZCBmcm9tIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdHxTdHJpbmd9IHJlY29yZCAgICAgICAgICAgICAgICAgIFRoZSByZWNvcmQgdG8gZGVsZXRlLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBbb3B0aW9ucz17fV0gICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIFtvcHRpb25zLmhlYWRlcnNdICAgICAgIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEBwYXJhbSAge0Jvb2xlYW59ICAgICAgIFtvcHRpb25zLnNhZmVdICAgICAgICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICogQHBhcmFtICB7TnVtYmVyfSAgICAgICAgW29wdGlvbnMubGFzdF9tb2RpZmllZF0gVGhlIGxhc3RfbW9kaWZpZWQgb3B0aW9uLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgZGVsZXRlUmVjb3JkKHJlY29yZCwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlY29yZE9iaiA9IHRvRGF0YUJvZHkocmVjb3JkKTtcbiAgICBpZiAoIXJlY29yZE9iai5pZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQSByZWNvcmQgaWQgaXMgcmVxdWlyZWQuXCIpO1xuICAgIH1cbiAgICBjb25zdCB7aWQsIGxhc3RfbW9kaWZpZWR9ID0gcmVjb3JkT2JqO1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9jb2xsT3B0aW9ucyh7IGxhc3RfbW9kaWZpZWQsIC4uLm9wdGlvbnMgfSk7XG4gICAgY29uc3QgcGF0aCA9IGVuZHBvaW50KFwicmVjb3JkXCIsIHRoaXMuYnVja2V0Lm5hbWUsIHRoaXMubmFtZSwgaWQpO1xuICAgIGNvbnN0IHJlcXVlc3QgPSByZXF1ZXN0cy5kZWxldGVSZXF1ZXN0KHBhdGgsIHJlcU9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHJlcXVlc3QpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyBhIHJlY29yZCBmcm9tIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gaWQgICAgICAgICAgICAgICAgVGhlIHJlY29yZCBpZCB0byByZXRyaWV2ZS5cbiAgICogQHBhcmFtICB7T2JqZWN0fSBbb3B0aW9ucz17fV0gICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHJldHVybiB7UHJvbWlzZTxPYmplY3QsIEVycm9yPn1cbiAgICovXG4gIGdldFJlY29yZChpZCwgb3B0aW9ucz17fSkge1xuICAgIHJldHVybiB0aGlzLmNsaWVudC5leGVjdXRlKHtcbiAgICAgIHBhdGg6IGVuZHBvaW50KFwicmVjb3JkXCIsIHRoaXMuYnVja2V0Lm5hbWUsIHRoaXMubmFtZSwgaWQpLFxuICAgICAgLi4udGhpcy5fY29sbE9wdGlvbnMob3B0aW9ucyksXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogTGlzdHMgcmVjb3JkcyBmcm9tIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24uXG4gICAqXG4gICAqIFNvcnRpbmcgaXMgZG9uZSBieSBwYXNzaW5nIGEgYHNvcnRgIHN0cmluZyBvcHRpb246XG4gICAqXG4gICAqIC0gVGhlIGZpZWxkIHRvIG9yZGVyIHRoZSByZXN1bHRzIGJ5LCBwcmVmaXhlZCB3aXRoIGAtYCBmb3IgZGVzY2VuZGluZy5cbiAgICogRGVmYXVsdDogYC1sYXN0X21vZGlmaWVkYC5cbiAgICpcbiAgICogQHNlZSBodHRwOi8va2ludG8ucmVhZHRoZWRvY3MuaW8vZW4vc3RhYmxlL2FwaS8xLngvc29ydGluZy5odG1sXG4gICAqXG4gICAqIEZpbHRlcmluZyBpcyBkb25lIGJ5IHBhc3NpbmcgYSBgZmlsdGVyc2Agb3B0aW9uIG9iamVjdDpcbiAgICpcbiAgICogLSBge2ZpZWxkbmFtZTogXCJ2YWx1ZVwifWBcbiAgICogLSBge21pbl9maWVsZG5hbWU6IDQwMDB9YFxuICAgKiAtIGB7aW5fZmllbGRuYW1lOiBcIjEsMiwzXCJ9YFxuICAgKiAtIGB7bm90X2ZpZWxkbmFtZTogMH1gXG4gICAqIC0gYHtleGNsdWRlX2ZpZWxkbmFtZTogXCIwLDFcIn1gXG4gICAqXG4gICAqIEBzZWUgaHR0cDovL2tpbnRvLnJlYWR0aGVkb2NzLmlvL2VuL3N0YWJsZS9hcGkvMS54L2ZpbHRlcmluZy5odG1sXG4gICAqXG4gICAqIFBhZ2luYXRpbmcgaXMgZG9uZSBieSBwYXNzaW5nIGEgYGxpbWl0YCBvcHRpb24sIHRoZW4gY2FsbGluZyB0aGUgYG5leHQoKWBcbiAgICogbWV0aG9kIGZyb20gdGhlIHJlc29sdmVkIHJlc3VsdCBvYmplY3QgdG8gZmV0Y2ggdGhlIG5leHQgcGFnZSwgaWYgYW55LlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgW29wdGlvbnM9e31dICAgICAgICAgICAgICAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucy5oZWFkZXJzXSAgICAgICAgICAgICAgIFRoZSBoZWFkZXJzIG9iamVjdCBvcHRpb24uXG4gICAqIEBwYXJhbSAge09iamVjdH0gICBbb3B0aW9ucy5maWx0ZXJzPVtdXSAgICAgICAgICAgIFRoZSBmaWx0ZXJzIG9iamVjdC5cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIFtvcHRpb25zLnNvcnQ9XCItbGFzdF9tb2RpZmllZFwiXSBUaGUgc29ydCBmaWVsZC5cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIFtvcHRpb25zLmxpbWl0PW51bGxdICAgICAgICAgICAgVGhlIGxpbWl0IGZpZWxkLlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgW29wdGlvbnMucGFnZXM9MV0gICAgICAgICAgICAgICBUaGUgbnVtYmVyIG9mIHJlc3VsdCBwYWdlcyB0byBhZ2dyZWdhdGUuXG4gICAqIEBwYXJhbSAge051bWJlcn0gICBbb3B0aW9ucy5zaW5jZT1udWxsXSAgICAgICAgICAgIE9ubHkgcmV0cmlldmUgcmVjb3JkcyBtb2RpZmllZCBzaW5jZSB0aGUgcHJvdmlkZWQgdGltZXN0YW1wLlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgbGlzdFJlY29yZHMob3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHBhdGggPSBlbmRwb2ludChcInJlY29yZFwiLCB0aGlzLmJ1Y2tldC5uYW1lLCB0aGlzLm5hbWUpO1xuICAgIGNvbnN0IHJlcU9wdGlvbnMgPSB0aGlzLl9jb2xsT3B0aW9ucyhvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGllbnQucGFnaW5hdGVkTGlzdChwYXRoLCBvcHRpb25zLCByZXFPcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQZXJmb3JtcyBiYXRjaCBvcGVyYXRpb25zIGF0IHRoZSBjdXJyZW50IGNvbGxlY3Rpb24gbGV2ZWwuXG4gICAqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmbiAgICAgICAgICAgICAgICAgICBUaGUgYmF0Y2ggb3BlcmF0aW9uIGZ1bmN0aW9uLlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgW29wdGlvbnM9e31dICAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgW29wdGlvbnMuaGVhZGVyc10gICAgVGhlIGhlYWRlcnMgb2JqZWN0IG9wdGlvbi5cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gIFtvcHRpb25zLnNhZmVdICAgICAgIFRoZSBzYWZlIG9wdGlvbi5cbiAgICogQHBhcmFtICB7Qm9vbGVhbn0gIFtvcHRpb25zLmFnZ3JlZ2F0ZV0gIFByb2R1Y2VzIGEgZ3JvdXBlZCByZXN1bHQgb2JqZWN0LlxuICAgKiBAcmV0dXJuIHtQcm9taXNlPE9iamVjdCwgRXJyb3I+fVxuICAgKi9cbiAgYmF0Y2goZm4sIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXFPcHRpb25zID0gdGhpcy5fY29sbE9wdGlvbnMob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50LmJhdGNoKGZuLCB7XG4gICAgICAuLi5yZXFPcHRpb25zLFxuICAgICAgYnVja2V0OiB0aGlzLmJ1Y2tldC5uYW1lLFxuICAgICAgY29sbGVjdGlvbjogdGhpcy5uYW1lLFxuICAgIH0pO1xuICB9XG59XG4iLCIvKipcbiAqIEVuZHBvaW50cyB0ZW1wbGF0ZXMuXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5jb25zdCBFTkRQT0lOVFMgPSB7XG4gIHJvb3Q6ICgpID0+XG4gICAgXCIvXCIsXG4gIGJhdGNoOiAoKSA9PlxuICAgIFwiL2JhdGNoXCIsXG4gIHBlcm1pc3Npb25zOiAoKSA9PlxuICAgIFwiL3Blcm1pc3Npb25zXCIsXG4gIGJ1Y2tldDogKGJ1Y2tldCkgPT5cbiAgICBcIi9idWNrZXRzXCIgKyAoYnVja2V0ID8gYC8ke2J1Y2tldH1gIDogXCJcIiksXG4gIGhpc3Rvcnk6IChidWNrZXQpID0+XG4gICAgYCR7RU5EUE9JTlRTLmJ1Y2tldChidWNrZXQpfS9oaXN0b3J5YCxcbiAgY29sbGVjdGlvbjogKGJ1Y2tldCwgY29sbCkgPT5cbiAgICBgJHtFTkRQT0lOVFMuYnVja2V0KGJ1Y2tldCl9L2NvbGxlY3Rpb25zYCArIChjb2xsID8gYC8ke2NvbGx9YCA6IFwiXCIpLFxuICBncm91cDogKGJ1Y2tldCwgZ3JvdXApID0+XG4gICAgYCR7RU5EUE9JTlRTLmJ1Y2tldChidWNrZXQpfS9ncm91cHNgICsgKGdyb3VwID8gYC8ke2dyb3VwfWAgOiBcIlwiKSxcbiAgcmVjb3JkOiAoYnVja2V0LCBjb2xsLCBpZCkgPT5cbiAgICBgJHtFTkRQT0lOVFMuY29sbGVjdGlvbihidWNrZXQsIGNvbGwpfS9yZWNvcmRzYCArIChpZCA/IGAvJHtpZH1gIDogXCJcIiksXG4gIGF0dGFjaG1lbnQ6IChidWNrZXQsIGNvbGwsIGlkKSA9PlxuICAgIGAke0VORFBPSU5UUy5yZWNvcmQoYnVja2V0LCBjb2xsLCBpZCl9L2F0dGFjaG1lbnRgLFxufTtcblxuLyoqXG4gKiBSZXRyaWV2ZXMgYSBzZXJ2ZXIgZW5wb2ludCBieSBpdHMgbmFtZS5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtICB7U3RyaW5nfSAgICBuYW1lIFRoZSBlbmRwb2ludCBuYW1lLlxuICogQHBhcmFtICB7Li4uc3RyaW5nfSBhcmdzIFRoZSBlbmRwb2ludCBwYXJhbWV0ZXJzLlxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBlbmRwb2ludChuYW1lLCAuLi5hcmdzKSB7XG4gIHJldHVybiBFTkRQT0lOVFNbbmFtZV0oLi4uYXJncyk7XG59XG4iLCIvKipcbiAqIEtpbnRvIHNlcnZlciBlcnJvciBjb2RlIGRlc2NyaXB0b3JzLlxuICogQHR5cGUge09iamVjdH1cbiAqL1xuZXhwb3J0IGRlZmF1bHQge1xuICAxMDQ6IFwiTWlzc2luZyBBdXRob3JpemF0aW9uIFRva2VuXCIsXG4gIDEwNTogXCJJbnZhbGlkIEF1dGhvcml6YXRpb24gVG9rZW5cIixcbiAgMTA2OiBcIlJlcXVlc3QgYm9keSB3YXMgbm90IHZhbGlkIEpTT05cIixcbiAgMTA3OiBcIkludmFsaWQgcmVxdWVzdCBwYXJhbWV0ZXJcIixcbiAgMTA4OiBcIk1pc3NpbmcgcmVxdWVzdCBwYXJhbWV0ZXJcIixcbiAgMTA5OiBcIkludmFsaWQgcG9zdGVkIGRhdGFcIixcbiAgMTEwOiBcIkludmFsaWQgVG9rZW4gLyBpZFwiLFxuICAxMTE6IFwiTWlzc2luZyBUb2tlbiAvIGlkXCIsXG4gIDExMjogXCJDb250ZW50LUxlbmd0aCBoZWFkZXIgd2FzIG5vdCBwcm92aWRlZFwiLFxuICAxMTM6IFwiUmVxdWVzdCBib2R5IHRvbyBsYXJnZVwiLFxuICAxMTQ6IFwiUmVzb3VyY2Ugd2FzIGNyZWF0ZWQsIHVwZGF0ZWQgb3IgZGVsZXRlZCBtZWFud2hpbGVcIixcbiAgMTE1OiBcIk1ldGhvZCBub3QgYWxsb3dlZCBvbiB0aGlzIGVuZCBwb2ludCAoaGludDogc2VydmVyIG1heSBiZSByZWFkb25seSlcIixcbiAgMTE2OiBcIlJlcXVlc3RlZCB2ZXJzaW9uIG5vdCBhdmFpbGFibGUgb24gdGhpcyBzZXJ2ZXJcIixcbiAgMTE3OiBcIkNsaWVudCBoYXMgc2VudCB0b28gbWFueSByZXF1ZXN0c1wiLFxuICAxMjE6IFwiUmVzb3VyY2UgYWNjZXNzIGlzIGZvcmJpZGRlbiBmb3IgdGhpcyB1c2VyXCIsXG4gIDEyMjogXCJBbm90aGVyIHJlc291cmNlIHZpb2xhdGVzIGNvbnN0cmFpbnRcIixcbiAgMjAxOiBcIlNlcnZpY2UgVGVtcG9yYXJ5IHVuYXZhaWxhYmxlIGR1ZSB0byBoaWdoIGxvYWRcIixcbiAgMjAyOiBcIlNlcnZpY2UgZGVwcmVjYXRlZFwiLFxuICA5OTk6IFwiSW50ZXJuYWwgU2VydmVyIEVycm9yXCIsXG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBFUlJPUl9DT0RFUyBmcm9tIFwiLi9lcnJvcnNcIjtcblxuLyoqXG4gKiBFbmhhbmNlZCBIVFRQIGNsaWVudCBmb3IgdGhlIEtpbnRvIHByb3RvY29sLlxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSFRUUCB7XG4gIC8qKlxuICAgKiBEZWZhdWx0IEhUVFAgcmVxdWVzdCBoZWFkZXJzIGFwcGxpZWQgdG8gZWFjaCBvdXRnb2luZyByZXF1ZXN0LlxuICAgKlxuICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgKi9cbiAgc3RhdGljIGdldCBERUZBVUxUX1JFUVVFU1RfSEVBREVSUygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgXCJBY2NlcHRcIjogICAgICAgXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIERlZmF1bHQgb3B0aW9ucy5cbiAgICpcbiAgICogQHR5cGUge09iamVjdH1cbiAgICovXG4gIHN0YXRpYyBnZXQgZGVmYXVsdE9wdGlvbnMoKSB7XG4gICAgcmV0dXJuIHt0aW1lb3V0OiA1MDAwLCByZXF1ZXN0TW9kZTogXCJjb3JzXCJ9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdG9yLlxuICAgKlxuICAgKiBAcGFyYW0ge0V2ZW50RW1pdHRlcn0gZXZlbnRzICAgICAgICAgICAgICAgICAgICAgICBUaGUgZXZlbnQgaGFuZGxlci5cbiAgICogQHBhcmFtIHtPYmplY3R9ICAgICAgIFtvcHRpb25zPXt9fSAgICAgICAgICAgICAgICAgVGhlIG9wdGlvbnMgb2JqZWN0LlxuICAgKiBAcGFyYW0ge051bWJlcn0gICAgICAgW29wdGlvbnMudGltZW91dD01MDAwXSAgICAgICBUaGUgcmVxdWVzdCB0aW1lb3V0IGluIG1zIChkZWZhdWx0OiBgNTAwMGApLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gICAgICAgW29wdGlvbnMucmVxdWVzdE1vZGU9XCJjb3JzXCJdIFRoZSBIVFRQIHJlcXVlc3QgbW9kZSAoZGVmYXVsdDogYFwiY29yc1wiYCkuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihldmVudHMsIG9wdGlvbnM9e30pIHtcbiAgICAvLyBwdWJsaWMgcHJvcGVydGllc1xuICAgIC8qKlxuICAgICAqIFRoZSBldmVudCBlbWl0dGVyIGluc3RhbmNlLlxuICAgICAqIEB0eXBlIHtFdmVudEVtaXR0ZXJ9XG4gICAgICovXG4gICAgaWYgKCFldmVudHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGV2ZW50cyBoYW5kbGVyIHByb3ZpZGVkXCIpO1xuICAgIH1cbiAgICB0aGlzLmV2ZW50cyA9IGV2ZW50cztcblxuICAgIC8qKlxuICAgICAqIFRoZSByZXF1ZXN0IG1vZGUuXG4gICAgICogQHNlZSAgaHR0cHM6Ly9mZXRjaC5zcGVjLndoYXR3Zy5vcmcvI3JlcXVlc3Rtb2RlXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLnJlcXVlc3RNb2RlID0gb3B0aW9ucy5yZXF1ZXN0TW9kZSB8fCBIVFRQLmRlZmF1bHRPcHRpb25zLnJlcXVlc3RNb2RlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJlcXVlc3QgdGltZW91dC5cbiAgICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgICAqL1xuICAgIHRoaXMudGltZW91dCA9IG9wdGlvbnMudGltZW91dCB8fCBIVFRQLmRlZmF1bHRPcHRpb25zLnRpbWVvdXQ7XG4gIH1cblxuICAvKipcbiAgICogUGVyZm9ybXMgYW4gSFRUUCByZXF1ZXN0IHRvIHRoZSBLaW50byBzZXJ2ZXIuXG4gICAqXG4gICAqIFJlc29sdmVzIHdpdGggYW4gb2JqZXQgY29udGFpbmluZyB0aGUgZm9sbG93aW5nIEhUVFAgcmVzcG9uc2UgcHJvcGVydGllczpcbiAgICogLSBge051bWJlcn0gIHN0YXR1c2AgIFRoZSBIVFRQIHN0YXR1cyBjb2RlLlxuICAgKiAtIGB7T2JqZWN0fSAganNvbmAgICAgVGhlIEpTT04gcmVzcG9uc2UgYm9keS5cbiAgICogLSBge0hlYWRlcnN9IGhlYWRlcnNgIFRoZSByZXNwb25zZSBoZWFkZXJzIG9iamVjdDsgc2VlIHRoZSBFUzYgZmV0Y2goKSBzcGVjLlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHVybCAgICAgICAgICAgICAgIFRoZSBVUkwuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnM9e31dICAgICAgVGhlIGZldGNoKCkgb3B0aW9ucyBvYmplY3QuXG4gICAqIEBwYXJhbSAge09iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gVGhlIHJlcXVlc3QgaGVhZGVycyBvYmplY3QgKGRlZmF1bHQ6IHt9KVxuICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgKi9cbiAgcmVxdWVzdCh1cmwsIG9wdGlvbnM9e2hlYWRlcnM6e319KSB7XG4gICAgbGV0IHJlc3BvbnNlLCBzdGF0dXMsIHN0YXR1c1RleHQsIGhlYWRlcnMsIGhhc1RpbWVkb3V0O1xuICAgIC8vIEVuc3VyZSBkZWZhdWx0IHJlcXVlc3QgaGVhZGVycyBhcmUgYWx3YXlzIHNldFxuICAgIG9wdGlvbnMuaGVhZGVycyA9IHsuLi5IVFRQLkRFRkFVTFRfUkVRVUVTVF9IRUFERVJTLCAuLi5vcHRpb25zLmhlYWRlcnN9O1xuICAgIC8vIElmIGEgbXVsdGlwYXJ0IGJvZHkgaXMgcHJvdmlkZWQsIHJlbW92ZSBhbnkgY3VzdG9tIENvbnRlbnQtVHlwZSBoZWFkZXIgYXNcbiAgICAvLyB0aGUgZmV0Y2goKSBpbXBsZW1lbnRhdGlvbiB3aWxsIGFkZCB0aGUgY29ycmVjdCBvbmUgZm9yIHVzLlxuICAgIGlmIChvcHRpb25zLmJvZHkgJiYgdHlwZW9mIG9wdGlvbnMuYm9keS5hcHBlbmQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgZGVsZXRlIG9wdGlvbnMuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlID0gdGhpcy5yZXF1ZXN0TW9kZTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgX3RpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBoYXNUaW1lZG91dCA9IHRydWU7XG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJSZXF1ZXN0IHRpbWVvdXQuXCIpKTtcbiAgICAgIH0sIHRoaXMudGltZW91dCk7XG4gICAgICBmZXRjaCh1cmwsIG9wdGlvbnMpIC50aGVuKHJlcyA9PiB7XG4gICAgICAgIGlmICghaGFzVGltZWRvdXQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQoX3RpbWVvdXRJZCk7XG4gICAgICAgICAgcmVzb2x2ZShyZXMpO1xuICAgICAgICB9XG4gICAgICB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgICBpZiAoIWhhc1RpbWVkb3V0KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KF90aW1lb3V0SWQpO1xuICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KVxuICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgcmVzcG9uc2UgPSByZXM7XG4gICAgICAgIGhlYWRlcnMgPSByZXMuaGVhZGVycztcbiAgICAgICAgc3RhdHVzID0gcmVzLnN0YXR1cztcbiAgICAgICAgc3RhdHVzVGV4dCA9IHJlcy5zdGF0dXNUZXh0O1xuICAgICAgICB0aGlzLl9jaGVja0ZvckRlcHJlY2F0aW9uSGVhZGVyKGhlYWRlcnMpO1xuICAgICAgICB0aGlzLl9jaGVja0ZvckJhY2tvZmZIZWFkZXIoc3RhdHVzLCBoZWFkZXJzKTtcbiAgICAgICAgdGhpcy5fY2hlY2tGb3JSZXRyeUFmdGVySGVhZGVyKHN0YXR1cywgaGVhZGVycyk7XG4gICAgICAgIHJldHVybiByZXMudGV4dCgpO1xuICAgICAgfSlcbiAgICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgYSBib2R5OyBpZiBzbyBwYXJzZSBpdCBhcyBKU09OLlxuICAgICAgLnRoZW4odGV4dCA9PiB7XG4gICAgICAgIGlmICh0ZXh0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIC8vIE5vdGU6IHdlIGNhbid0IGNvbnN1bWUgdGhlIHJlc3BvbnNlIGJvZHkgdHdpY2UuXG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHRleHQpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihgSFRUUCAke3N0YXR1cyB8fCAwfTsgJHtlcnJ9YCk7XG4gICAgICAgIGVycm9yLnJlc3BvbnNlID0gcmVzcG9uc2U7XG4gICAgICAgIGVycm9yLnN0YWNrID0gZXJyLnN0YWNrO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pXG4gICAgICAudGhlbihqc29uID0+IHtcbiAgICAgICAgaWYgKGpzb24gJiYgc3RhdHVzID49IDQwMCkge1xuICAgICAgICAgIGxldCBtZXNzYWdlID0gYEhUVFAgJHtzdGF0dXN9ICR7anNvbi5lcnJvcnx8XCJcIn06IGA7XG4gICAgICAgICAgaWYgKGpzb24uZXJybm8gJiYganNvbi5lcnJubyBpbiBFUlJPUl9DT0RFUykge1xuICAgICAgICAgICAgY29uc3QgZXJybm9Nc2cgPSBFUlJPUl9DT0RFU1tqc29uLmVycm5vXTtcbiAgICAgICAgICAgIG1lc3NhZ2UgKz0gZXJybm9Nc2c7XG4gICAgICAgICAgICBpZiAoanNvbi5tZXNzYWdlICYmIGpzb24ubWVzc2FnZSAhPT0gZXJybm9Nc2cpIHtcbiAgICAgICAgICAgICAgbWVzc2FnZSArPSBgICgke2pzb24ubWVzc2FnZX0pYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVzc2FnZSArPSBzdGF0dXNUZXh0IHx8IFwiXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UudHJpbSgpKTtcbiAgICAgICAgICBlcnJvci5yZXNwb25zZSA9IHJlc3BvbnNlO1xuICAgICAgICAgIGVycm9yLmRhdGEgPSBqc29uO1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7c3RhdHVzLCBqc29uLCBoZWFkZXJzfTtcbiAgICAgIH0pO1xuICB9XG5cbiAgX2NoZWNrRm9yRGVwcmVjYXRpb25IZWFkZXIoaGVhZGVycykge1xuICAgIGNvbnN0IGFsZXJ0SGVhZGVyID0gaGVhZGVycy5nZXQoXCJBbGVydFwiKTtcbiAgICBpZiAoIWFsZXJ0SGVhZGVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBhbGVydDtcbiAgICB0cnkge1xuICAgICAgYWxlcnQgPSBKU09OLnBhcnNlKGFsZXJ0SGVhZGVyKTtcbiAgICB9IGNhdGNoKGVycikge1xuICAgICAgY29uc29sZS53YXJuKFwiVW5hYmxlIHRvIHBhcnNlIEFsZXJ0IGhlYWRlciBtZXNzYWdlXCIsIGFsZXJ0SGVhZGVyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc29sZS53YXJuKGFsZXJ0Lm1lc3NhZ2UsIGFsZXJ0LnVybCk7XG4gICAgdGhpcy5ldmVudHMuZW1pdChcImRlcHJlY2F0ZWRcIiwgYWxlcnQpO1xuICB9XG5cbiAgX2NoZWNrRm9yQmFja29mZkhlYWRlcihzdGF0dXMsIGhlYWRlcnMpIHtcbiAgICBsZXQgYmFja29mZk1zO1xuICAgIGNvbnN0IGJhY2tvZmZTZWNvbmRzID0gcGFyc2VJbnQoaGVhZGVycy5nZXQoXCJCYWNrb2ZmXCIpLCAxMCk7XG4gICAgaWYgKGJhY2tvZmZTZWNvbmRzID4gMCkge1xuICAgICAgYmFja29mZk1zID0gKG5ldyBEYXRlKCkuZ2V0VGltZSgpKSArIChiYWNrb2ZmU2Vjb25kcyAqIDEwMDApO1xuICAgIH0gZWxzZSB7XG4gICAgICBiYWNrb2ZmTXMgPSAwO1xuICAgIH1cbiAgICB0aGlzLmV2ZW50cy5lbWl0KFwiYmFja29mZlwiLCBiYWNrb2ZmTXMpO1xuICB9XG5cbiAgX2NoZWNrRm9yUmV0cnlBZnRlckhlYWRlcihzdGF0dXMsIGhlYWRlcnMpIHtcbiAgICBsZXQgcmV0cnlBZnRlciA9IGhlYWRlcnMuZ2V0KFwiUmV0cnktQWZ0ZXJcIik7XG4gICAgaWYgKCFyZXRyeUFmdGVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHJ5QWZ0ZXIgPSAobmV3IERhdGUoKS5nZXRUaW1lKCkpICsgKHBhcnNlSW50KHJldHJ5QWZ0ZXIsIDEwKSAqIDEwMDApO1xuICAgIHRoaXMuZXZlbnRzLmVtaXQoXCJyZXRyeS1hZnRlclwiLCByZXRyeUFmdGVyKTtcbiAgfVxufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmltcG9ydCBcImlzb21vcnBoaWMtZmV0Y2hcIjtcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gXCJldmVudHNcIjtcblxuaW1wb3J0IEtpbnRvQ2xpZW50QmFzZSBmcm9tIFwiLi9iYXNlXCI7XG5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgS2ludG9DbGllbnQgZXh0ZW5kcyBLaW50b0NsaWVudEJhc2Uge1xuICBjb25zdHJ1Y3RvcihyZW1vdGUsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCBldmVudHMgPSBvcHRpb25zLmV2ZW50cyB8fCBuZXcgRXZlbnRFbWl0dGVyKCk7XG5cbiAgICBzdXBlcihyZW1vdGUsIE9iamVjdC5hc3NpZ24oe2V2ZW50c30sIG9wdGlvbnMpKTtcbiAgfVxufVxuXG4vLyBUaGlzIGlzIGEgaGFjayB0byBhdm9pZCBCcm93c2VyaWZ5IHRvIGV4cG9zZSB0aGUgYWJvdmUgY2xhc3Ncbi8vIGF0IGBuZXcgS2ludG9DbGllbnQoKWAgaW5zdGVhZCBvZiBgbmV3IEtpbnRvQ2xpZW50LmRlZmF1bHQoKWAuXG4vLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL0tpbnRvL2tpbnRvLWh0dHAuanMvaXNzdWVzLzc3XG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIikge1xuICBtb2R1bGUuZXhwb3J0cyA9IEtpbnRvQ2xpZW50O1xufVxuIiwiaW1wb3J0IHsgb21pdCwgY3JlYXRlRm9ybURhdGEgfSBmcm9tIFwiLi91dGlsc1wiO1xuXG5cbmNvbnN0IHJlcXVlc3REZWZhdWx0cyA9IHtcbiAgc2FmZTogZmFsc2UsXG4gIC8vIGNoZWNrIGlmIHdlIHNob3VsZCBzZXQgZGVmYXVsdCBjb250ZW50IHR5cGUgaGVyZVxuICBoZWFkZXJzOiB7fSxcbiAgcGVybWlzc2lvbnM6IHVuZGVmaW5lZCxcbiAgZGF0YTogdW5kZWZpbmVkLFxuICBwYXRjaDogZmFsc2UsXG59O1xuXG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIHNhZmVIZWFkZXIoc2FmZSwgbGFzdF9tb2RpZmllZCkge1xuICBpZiAoIXNhZmUpIHtcbiAgICByZXR1cm4ge307XG4gIH1cbiAgaWYgKGxhc3RfbW9kaWZpZWQpIHtcbiAgICByZXR1cm4ge1wiSWYtTWF0Y2hcIjogYFwiJHtsYXN0X21vZGlmaWVkfVwiYH07XG4gIH1cbiAgcmV0dXJuIHtcIklmLU5vbmUtTWF0Y2hcIjogXCIqXCJ9O1xufVxuXG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZXF1ZXN0KHBhdGgsIHtkYXRhLCBwZXJtaXNzaW9uc30sIG9wdGlvbnM9e30pIHtcbiAgY29uc3QgeyBoZWFkZXJzLCBzYWZlIH0gPSB7XG4gICAgLi4ucmVxdWVzdERlZmF1bHRzLFxuICAgIC4uLm9wdGlvbnMsXG4gIH07XG4gIHJldHVybiB7XG4gICAgbWV0aG9kOiBkYXRhICYmIGRhdGEuaWQgPyBcIlBVVFwiIDogXCJQT1NUXCIsXG4gICAgcGF0aCxcbiAgICBoZWFkZXJzOiB7Li4uaGVhZGVycywgLi4uc2FmZUhlYWRlcihzYWZlKX0sXG4gICAgYm9keToge1xuICAgICAgZGF0YSxcbiAgICAgIHBlcm1pc3Npb25zXG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVSZXF1ZXN0KHBhdGgsIHtkYXRhLCBwZXJtaXNzaW9uc30sIG9wdGlvbnM9e30pIHtcbiAgY29uc3Qge1xuICAgIGhlYWRlcnMsXG4gICAgc2FmZSxcbiAgICBwYXRjaCxcbiAgfSA9IHsuLi5yZXF1ZXN0RGVmYXVsdHMsIC4uLm9wdGlvbnN9O1xuICBjb25zdCB7IGxhc3RfbW9kaWZpZWQgfSA9IHsgLi4uZGF0YSwgLi4ub3B0aW9ucyB9O1xuXG4gIGlmIChPYmplY3Qua2V5cyhvbWl0KGRhdGEsIFwiaWRcIiwgXCJsYXN0X21vZGlmaWVkXCIpKS5sZW5ndGggPT09IDApIHtcbiAgICBkYXRhID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBtZXRob2Q6IHBhdGNoID8gXCJQQVRDSFwiIDogXCJQVVRcIixcbiAgICBwYXRoLFxuICAgIGhlYWRlcnM6IHtcbiAgICAgIC4uLmhlYWRlcnMsXG4gICAgICAuLi5zYWZlSGVhZGVyKHNhZmUsIGxhc3RfbW9kaWZpZWQpXG4gICAgfSxcbiAgICBib2R5OiB7XG4gICAgICBkYXRhLFxuICAgICAgcGVybWlzc2lvbnNcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZVJlcXVlc3QocGF0aCwgb3B0aW9ucz17fSkge1xuICBjb25zdCB7aGVhZGVycywgc2FmZSwgbGFzdF9tb2RpZmllZH0gPSB7XG4gICAgLi4ucmVxdWVzdERlZmF1bHRzLFxuICAgIC4uLm9wdGlvbnNcbiAgfTtcbiAgaWYgKHNhZmUgJiYgIWxhc3RfbW9kaWZpZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJTYWZlIGNvbmN1cnJlbmN5IGNoZWNrIHJlcXVpcmVzIGEgbGFzdF9tb2RpZmllZCB2YWx1ZS5cIik7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICBtZXRob2Q6IFwiREVMRVRFXCIsXG4gICAgcGF0aCxcbiAgICBoZWFkZXJzOiB7Li4uaGVhZGVycywgLi4uc2FmZUhlYWRlcihzYWZlLCBsYXN0X21vZGlmaWVkKX1cbiAgfTtcbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRkQXR0YWNobWVudFJlcXVlc3QocGF0aCwgZGF0YVVSSSwge2RhdGEsIHBlcm1pc3Npb25zfT17fSwgb3B0aW9ucz17fSkge1xuICBjb25zdCB7aGVhZGVycywgc2FmZX0gPSB7Li4ucmVxdWVzdERlZmF1bHRzLCAuLi5vcHRpb25zfTtcbiAgY29uc3Qge2xhc3RfbW9kaWZpZWR9ID0gey4uLmRhdGEsIC4uLm9wdGlvbnMgfTtcbiAgaWYgKHNhZmUgJiYgIWxhc3RfbW9kaWZpZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJTYWZlIGNvbmN1cnJlbmN5IGNoZWNrIHJlcXVpcmVzIGEgbGFzdF9tb2RpZmllZCB2YWx1ZS5cIik7XG4gIH1cblxuICBjb25zdCBib2R5ID0ge2RhdGEsIHBlcm1pc3Npb25zfTtcbiAgY29uc3QgZm9ybURhdGEgPSBjcmVhdGVGb3JtRGF0YShkYXRhVVJJLCBib2R5LCBvcHRpb25zKTtcblxuICByZXR1cm4ge1xuICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgcGF0aCxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAuLi5oZWFkZXJzLFxuICAgICAgLi4uc2FmZUhlYWRlcihzYWZlLCBsYXN0X21vZGlmaWVkKSxcbiAgICB9LFxuICAgIGJvZHk6IGZvcm1EYXRhXG4gIH07XG59XG4iLCIvKipcbiAqIENodW5rcyBhbiBhcnJheSBpbnRvIG4gcGllY2VzLlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0gIHtBcnJheX0gIGFycmF5XG4gKiBAcGFyYW0gIHtOdW1iZXJ9IG5cbiAqIEByZXR1cm4ge0FycmF5fVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFydGl0aW9uKGFycmF5LCBuKSB7XG4gIGlmIChuIDw9IDApIHtcbiAgICByZXR1cm4gYXJyYXk7XG4gIH1cbiAgcmV0dXJuIGFycmF5LnJlZHVjZSgoYWNjLCB4LCBpKSA9PiB7XG4gICAgaWYgKGkgPT09IDAgfHwgaSAlIG4gPT09IDApIHtcbiAgICAgIGFjYy5wdXNoKFt4XSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFjY1thY2MubGVuZ3RoIC0gMV0ucHVzaCh4KTtcbiAgICB9XG4gICAgcmV0dXJuIGFjYztcbiAgfSwgW10pO1xufVxuXG4vKipcbiAqIE1hcHMgYSBsaXN0IHRvIHByb21pc2VzIHVzaW5nIHRoZSBwcm92aWRlZCBtYXBwaW5nIGZ1bmN0aW9uLCBleGVjdXRlcyB0aGVtXG4gKiBzZXF1ZW50aWFsbHkgdGhlbiByZXR1cm5zIGEgUHJvbWlzZSByZXNvbHZpbmcgd2l0aCBvcmRlcmVkIHJlc3VsdHMgb2J0YWluZWQuXG4gKiBUaGluayBvZiB0aGlzIGFzIGEgc2VxdWVudGlhbCBQcm9taXNlLmFsbC5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtICB7QXJyYXl9ICAgIGxpc3QgVGhlIGxpc3QgdG8gbWFwLlxuICogQHBhcmFtICB7RnVuY3Rpb259IGZuICAgVGhlIG1hcHBpbmcgZnVuY3Rpb24uXG4gKiBAcmV0dXJuIHtQcm9taXNlfVxuICovXG5leHBvcnQgZnVuY3Rpb24gcE1hcChsaXN0LCBmbikge1xuICBsZXQgcmVzdWx0cyA9IFtdO1xuICByZXR1cm4gbGlzdC5yZWR1Y2UoKHByb21pc2UsIGVudHJ5KSA9PiB7XG4gICAgcmV0dXJuIHByb21pc2UudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZuKGVudHJ5KSlcbiAgICAgICAgLnRoZW4ocmVzdWx0ID0+IHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChyZXN1bHQpKTtcbiAgICB9KTtcbiAgfSwgUHJvbWlzZS5yZXNvbHZlKCkpLnRoZW4oKCkgPT4gcmVzdWx0cyk7XG59XG5cbi8qKlxuICogVGFrZXMgYW4gb2JqZWN0IGFuZCByZXR1cm5zIGEgY29weSBvZiBpdCB3aXRoIHRoZSBwcm92aWRlZCBrZXlzIG9taXR0ZWQuXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSAge09iamVjdH0gICAgb2JqICBUaGUgc291cmNlIG9iamVjdC5cbiAqIEBwYXJhbSAgey4uLlN0cmluZ30ga2V5cyBUaGUga2V5cyB0byBvbWl0LlxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5leHBvcnQgZnVuY3Rpb24gb21pdChvYmosIC4uLmtleXMpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaikucmVkdWNlKChhY2MsIGtleSkgPT4ge1xuICAgIGlmIChrZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHtcbiAgICAgIGFjY1trZXldID0gb2JqW2tleV07XG4gICAgfVxuICAgIHJldHVybiBhY2M7XG4gIH0sIHt9KTtcbn1cblxuLyoqXG4gKiBBbHdheXMgcmV0dXJucyBhIHJlc291cmNlIGRhdGEgb2JqZWN0IGZyb20gdGhlIHByb3ZpZGVkIGFyZ3VtZW50LlxuICpcbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0gIHtPYmplY3R8U3RyaW5nfSByZXNvdXJjZVxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9EYXRhQm9keShyZXNvdXJjZSkge1xuICBpZiAoaXNPYmplY3QocmVzb3VyY2UpKSB7XG4gICAgcmV0dXJuIHJlc291cmNlO1xuICB9XG4gIGlmICh0eXBlb2YgcmVzb3VyY2UgPT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4ge2lkOiByZXNvdXJjZX07XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBhcmd1bWVudC5cIik7XG59XG5cbi8qKlxuICogVHJhbnNmb3JtcyBhbiBvYmplY3QgaW50byBhbiBVUkwgcXVlcnkgc3RyaW5nLCBzdHJpcHBpbmcgb3V0IGFueSB1bmRlZmluZWRcbiAqIHZhbHVlcy5cbiAqXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5leHBvcnQgZnVuY3Rpb24gcXNpZnkob2JqKSB7XG4gIGNvbnN0IGVuY29kZSA9ICh2KSA9PiBlbmNvZGVVUklDb21wb25lbnQodHlwZW9mIHYgPT09IFwiYm9vbGVhblwiID8gU3RyaW5nKHYpIDogdik7XG4gIGNvbnN0IHN0cmlwVW5kZWZpbmVkID0gKG8pID0+IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobykpO1xuICBjb25zdCBzdHJpcHBlZCA9IHN0cmlwVW5kZWZpbmVkKG9iaik7XG4gIHJldHVybiBPYmplY3Qua2V5cyhzdHJpcHBlZCkubWFwKChrKSA9PiB7XG4gICAgY29uc3Qga3MgPSBlbmNvZGUoaykgKyBcIj1cIjtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShzdHJpcHBlZFtrXSkpIHtcbiAgICAgIHJldHVybiBrcyArIHN0cmlwcGVkW2tdLm1hcCgodikgPT4gZW5jb2RlKHYpKS5qb2luKFwiLFwiKTsgXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBrcyArIGVuY29kZShzdHJpcHBlZFtrXSk7XG4gICAgfVxuICB9KS5qb2luKFwiJlwiKTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYSB2ZXJzaW9uIGlzIHdpdGhpbiB0aGUgcHJvdmlkZWQgcmFuZ2UuXG4gKlxuICogQHBhcmFtICB7U3RyaW5nfSB2ZXJzaW9uICAgIFRoZSB2ZXJzaW9uIHRvIGNoZWNrLlxuICogQHBhcmFtICB7U3RyaW5nfSBtaW5WZXJzaW9uIFRoZSBtaW5pbXVtIHN1cHBvcnRlZCB2ZXJzaW9uIChpbmNsdXNpdmUpLlxuICogQHBhcmFtICB7U3RyaW5nfSBtYXhWZXJzaW9uIFRoZSBtaW5pbXVtIHN1cHBvcnRlZCB2ZXJzaW9uIChleGNsdXNpdmUpLlxuICogQHRocm93cyB7RXJyb3J9IElmIHRoZSB2ZXJzaW9uIGlzIG91dHNpZGUgb2YgdGhlIHByb3ZpZGVkIHJhbmdlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tWZXJzaW9uKHZlcnNpb24sIG1pblZlcnNpb24sIG1heFZlcnNpb24pIHtcbiAgY29uc3QgZXh0cmFjdCA9IChzdHIpID0+IHN0ci5zcGxpdChcIi5cIikubWFwKHggPT4gcGFyc2VJbnQoeCwgMTApKTtcbiAgY29uc3QgW3Zlck1ham9yLCB2ZXJNaW5vcl0gPSBleHRyYWN0KHZlcnNpb24pO1xuICBjb25zdCBbbWluTWFqb3IsIG1pbk1pbm9yXSA9IGV4dHJhY3QobWluVmVyc2lvbik7XG4gIGNvbnN0IFttYXhNYWpvciwgbWF4TWlub3JdID0gZXh0cmFjdChtYXhWZXJzaW9uKTtcbiAgY29uc3QgY2hlY2tzID0gW1xuICAgIHZlck1ham9yIDwgbWluTWFqb3IsXG4gICAgdmVyTWFqb3IgPT09IG1pbk1ham9yICYmIHZlck1pbm9yIDwgbWluTWlub3IsXG4gICAgdmVyTWFqb3IgPiBtYXhNYWpvcixcbiAgICB2ZXJNYWpvciA9PT0gbWF4TWFqb3IgJiYgdmVyTWlub3IgPj0gbWF4TWlub3IsXG4gIF07XG4gIGlmIChjaGVja3Muc29tZSh4ID0+IHgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBWZXJzaW9uICR7dmVyc2lvbn0gZG9lc24ndCBzYXRpc2Z5IGAgK1xuICAgICAgICAgICAgICAgICAgICBgJHttaW5WZXJzaW9ufSA8PSB4IDwgJHttYXhWZXJzaW9ufWApO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgZGVjb3JhdG9yIGZ1bmN0aW9uIGVuc3VyaW5nIGEgdmVyc2lvbiBjaGVjayBpcyBwZXJmb3JtZWQgYWdhaW5zdFxuICogdGhlIHByb3ZpZGVkIHJlcXVpcmVtZW50cyBiZWZvcmUgZXhlY3V0aW5nIGl0LlxuICpcbiAqIEBwYXJhbSAge1N0cmluZ30gbWluIFRoZSByZXF1aXJlZCBtaW4gdmVyc2lvbiAoaW5jbHVzaXZlKS5cbiAqIEBwYXJhbSAge1N0cmluZ30gbWF4IFRoZSByZXF1aXJlZCBtYXggdmVyc2lvbiAoaW5jbHVzaXZlKS5cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5leHBvcnQgZnVuY3Rpb24gc3VwcG9ydChtaW4sIG1heCkge1xuICByZXR1cm4gZnVuY3Rpb24odGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpIHtcbiAgICBjb25zdCBmbiA9IGRlc2NyaXB0b3IudmFsdWU7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3Qgd3JhcHBlZE1ldGhvZCA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgLy8gXCJ0aGlzXCIgaXMgdGhlIGN1cnJlbnQgaW5zdGFuY2Ugd2hpY2ggaXRzIG1ldGhvZCBpcyBkZWNvcmF0ZWQuXG4gICAgICAgICAgY29uc3QgY2xpZW50ID0gXCJjbGllbnRcIiBpbiB0aGlzID8gdGhpcy5jbGllbnQgOiB0aGlzO1xuICAgICAgICAgIHJldHVybiBjbGllbnQuZmV0Y2hIVFRQQXBpVmVyc2lvbigpXG4gICAgICAgICAgICAudGhlbih2ZXJzaW9uID0+IGNoZWNrVmVyc2lvbih2ZXJzaW9uLCBtaW4sIG1heCkpXG4gICAgICAgICAgICAudGhlbigoKSA9PiBmbi5hcHBseSh0aGlzLCBhcmdzKSk7XG4gICAgICAgIH07XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBrZXksIHtcbiAgICAgICAgICB2YWx1ZTogd3JhcHBlZE1ldGhvZCxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB3cmFwcGVkTWV0aG9kO1xuICAgICAgfVxuICAgIH07XG4gIH07XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgZGVjb3JhdG9yIGZ1bmN0aW9uIGVuc3VyaW5nIHRoYXQgdGhlIHNwZWNpZmllZCBjYXBhYmlsaXRpZXMgYXJlXG4gKiBhdmFpbGFibGUgb24gdGhlIHNlcnZlciBiZWZvcmUgZXhlY3V0aW5nIGl0LlxuICpcbiAqIEBwYXJhbSAge0FycmF5PFN0cmluZz59IGNhcGFiaWxpdGllcyBUaGUgcmVxdWlyZWQgY2FwYWJpbGl0aWVzLlxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYXBhYmxlKGNhcGFiaWxpdGllcykge1xuICByZXR1cm4gZnVuY3Rpb24odGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpIHtcbiAgICBjb25zdCBmbiA9IGRlc2NyaXB0b3IudmFsdWU7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3Qgd3JhcHBlZE1ldGhvZCA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgLy8gXCJ0aGlzXCIgaXMgdGhlIGN1cnJlbnQgaW5zdGFuY2Ugd2hpY2ggaXRzIG1ldGhvZCBpcyBkZWNvcmF0ZWQuXG4gICAgICAgICAgY29uc3QgY2xpZW50ID0gXCJjbGllbnRcIiBpbiB0aGlzID8gdGhpcy5jbGllbnQgOiB0aGlzO1xuICAgICAgICAgIHJldHVybiBjbGllbnQuZmV0Y2hTZXJ2ZXJDYXBhYmlsaXRpZXMoKVxuICAgICAgICAgICAgLnRoZW4oYXZhaWxhYmxlID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbWlzc2luZyA9IGNhcGFiaWxpdGllcy5maWx0ZXIoYyA9PiAhYXZhaWxhYmxlLmhhc093blByb3BlcnR5KGMpKTtcbiAgICAgICAgICAgICAgaWYgKG1pc3NpbmcubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgY2FwYWJpbGl0aWVzICR7bWlzc2luZy5qb2luKFwiLCBcIil9IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm5vdCBwcmVzZW50IG9uIHNlcnZlclwiKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKCgpID0+IGZuLmFwcGx5KHRoaXMsIGFyZ3MpKTtcbiAgICAgICAgfTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIGtleSwge1xuICAgICAgICAgIHZhbHVlOiB3cmFwcGVkTWV0aG9kLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHdyYXBwZWRNZXRob2Q7XG4gICAgICB9XG4gICAgfTtcbiAgfTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBkZWNvcmF0b3IgZnVuY3Rpb24gZW5zdXJpbmcgYW4gb3BlcmF0aW9uIGlzIG5vdCBwZXJmb3JtZWQgZnJvbVxuICogd2l0aGluIGEgYmF0Y2ggcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IG1lc3NhZ2UgVGhlIGVycm9yIG1lc3NhZ2UgdG8gdGhyb3cuXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vYmF0Y2gobWVzc2FnZSkge1xuICByZXR1cm4gZnVuY3Rpb24odGFyZ2V0LCBrZXksIGRlc2NyaXB0b3IpIHtcbiAgICBjb25zdCBmbiA9IGRlc2NyaXB0b3IudmFsdWU7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIGdldCgpIHtcbiAgICAgICAgY29uc3Qgd3JhcHBlZE1ldGhvZCA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgICAgLy8gXCJ0aGlzXCIgaXMgdGhlIGN1cnJlbnQgaW5zdGFuY2Ugd2hpY2ggaXRzIG1ldGhvZCBpcyBkZWNvcmF0ZWQuXG4gICAgICAgICAgaWYgKHRoaXMuX2lzQmF0Y2gpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9O1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCB7XG4gICAgICAgICAgdmFsdWU6IHdyYXBwZWRNZXRob2QsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgIHdyaXRhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gd3JhcHBlZE1ldGhvZDtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIHZhbHVlIGlzIGFuIG9iamVjdCAoaS5lLiBub3QgYW4gYXJyYXkgbm9yIG51bGwpLlxuICogQHBhcmFtICB7T2JqZWN0fSB0aGluZyBUaGUgdmFsdWUgdG8gaW5zcGVjdC5cbiAqIEByZXR1cm4ge2Jvb2x9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc09iamVjdCh0aGluZykge1xuICByZXR1cm4gdHlwZW9mIHRoaW5nID09PSBcIm9iamVjdFwiICYmIHRoaW5nICE9PSBudWxsICYmICFBcnJheS5pc0FycmF5KHRoaW5nKTtcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBkYXRhIHVybC5cbiAqIEBwYXJhbSAge1N0cmluZ30gZGF0YVVSTCBUaGUgZGF0YSB1cmwuXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZURhdGFVUkwoZGF0YVVSTCkge1xuICBjb25zdCByZWdleCA9IC9eZGF0YTooLiopO2Jhc2U2NCwoLiopLztcbiAgY29uc3QgbWF0Y2ggPSBkYXRhVVJMLm1hdGNoKHJlZ2V4KTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBkYXRhLXVybDogJHtTdHJpbmcoZGF0YVVSTCkuc3Vic3RyKDAsIDMyKX0uLi5gKTtcbiAgfVxuICBjb25zdCBwcm9wcyA9IG1hdGNoWzFdO1xuICBjb25zdCBiYXNlNjQgPSBtYXRjaFsyXTtcbiAgY29uc3QgW3R5cGUsIC4uLnJhd1BhcmFtc10gPSBwcm9wcy5zcGxpdChcIjtcIik7XG4gIGNvbnN0IHBhcmFtcyA9IHJhd1BhcmFtcy5yZWR1Y2UoKGFjYywgcGFyYW0pID0+IHtcbiAgICBjb25zdCBba2V5LCB2YWx1ZV0gPSBwYXJhbS5zcGxpdChcIj1cIik7XG4gICAgcmV0dXJuIHsuLi5hY2MsIFtrZXldOiB2YWx1ZX07XG4gIH0sIHt9KTtcbiAgcmV0dXJuIHsuLi5wYXJhbXMsIHR5cGUsIGJhc2U2NH07XG59XG5cbi8qKlxuICogRXh0cmFjdHMgZmlsZSBpbmZvcm1hdGlvbiBmcm9tIGEgZGF0YSB1cmwuXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGRhdGFVUkwgVGhlIGRhdGEgdXJsLlxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEZpbGVJbmZvKGRhdGFVUkwpIHtcbiAgY29uc3Qge25hbWUsIHR5cGUsIGJhc2U2NH0gPSBwYXJzZURhdGFVUkwoZGF0YVVSTCk7XG4gIGNvbnN0IGJpbmFyeSA9IGF0b2IoYmFzZTY0KTtcbiAgY29uc3QgYXJyYXkgPSBbXTtcbiAgZm9yKGxldCBpID0gMDsgaSA8IGJpbmFyeS5sZW5ndGg7IGkrKykge1xuICAgIGFycmF5LnB1c2goYmluYXJ5LmNoYXJDb2RlQXQoaSkpO1xuICB9XG4gIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXSwge3R5cGV9KTtcbiAgcmV0dXJuIHtibG9iLCBuYW1lfTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgRm9ybURhdGEgaW5zdGFuY2UgZnJvbSBhIGRhdGEgdXJsIGFuZCBhbiBleGlzdGluZyBKU09OIHJlc3BvbnNlXG4gKiBib2R5LlxuICogQHBhcmFtICB7U3RyaW5nfSBkYXRhVVJMICAgICAgICAgICAgVGhlIGRhdGEgdXJsLlxuICogQHBhcmFtICB7T2JqZWN0fSBib2R5ICAgICAgICAgICAgICAgVGhlIHJlc3BvbnNlIGJvZHkuXG4gKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zPXt9XSAgICAgICBUaGUgb3B0aW9ucyBvYmplY3QuXG4gKiBAcGFyYW0gIHtPYmplY3R9IFtvcHRpb25zLmZpbGVuYW1lXSBGb3JjZSBhdHRhY2htZW50IGZpbGUgbmFtZS5cbiAqIEByZXR1cm4ge0Zvcm1EYXRhfVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRm9ybURhdGEoZGF0YVVSTCwgYm9keSwgb3B0aW9ucz17fSkge1xuICBjb25zdCB7ZmlsZW5hbWU9XCJ1bnRpdGxlZFwifSA9IG9wdGlvbnM7XG4gIGNvbnN0IHtibG9iLCBuYW1lfSA9IGV4dHJhY3RGaWxlSW5mbyhkYXRhVVJMKTtcbiAgY29uc3QgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgZm9ybURhdGEuYXBwZW5kKFwiYXR0YWNobWVudFwiLCBibG9iLCBuYW1lIHx8IGZpbGVuYW1lKTtcbiAgZm9yIChjb25zdCBwcm9wZXJ0eSBpbiBib2R5KSB7XG4gICAgaWYgKHR5cGVvZiBib2R5W3Byb3BlcnR5XSAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgZm9ybURhdGEuYXBwZW5kKHByb3BlcnR5LCBKU09OLnN0cmluZ2lmeShib2R5W3Byb3BlcnR5XSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZm9ybURhdGE7XG59XG4iXX0=
