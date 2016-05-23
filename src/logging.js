(function(exports) {
  var VERBOSE = true;
  var VERBOSEMAX = 5000;
  var LOG_FUNC = null; // function(level:{'log','warn','error'}, ...args) to proxy console.log stuff. unused if empty.

  function ds(level) {
    var can = level !== undefined ? VERBOSE >= level : VERBOSE;
    if (can && --VERBOSEMAX < 0) {
      can = VERBOSE = false;
      console.log('DEAD MANS SWITCH ACTIVATED, FURTHER LOGGING SQUASHED');
    }
    return can;
  }

  var logging = {
    setMode: function(mode) {
      VERBOSE = mode;
    },
    setMax: function(max) {
      VERBOSEMAX = max;
    },
    setExternalLogging: function(func) {
      LOG_FUNC = func;
    },

    HI: function () {
      if (ds(1)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
    },

    MED: function () {
      if (ds(2)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
    },

    LOW: function () {
      if (ds(3)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
    },

    LOG: function () {
      if (ds(3)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
    },

    WARN: function () {
      if (ds(1)) console.warn.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['warn'], arguments)));
    },

    ERROR: function () {
      if (ds(1)) console.error.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['error'], arguments)));
    },

    GROPEN: function () {
      if (ds(3)) (console.group || console.log).apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['gropen'], arguments)));
    },

    GRCLOSE: function () {
      if (ds(3)) (console.groupEnd || console.log).apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['grclose'], arguments)));
    },

    DESC: function (current, value, desc) {
      if (ds(3)) console.log(desc, '(result) ->', value, '(called with) ->', current);
      return value;
    },
  };

  exports.logging = logging;
})(typeof module === 'object' ? module.exports : window.Drew);
