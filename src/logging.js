(function(exports) {

  // BODY-START

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

  function setMode(mode) {
    VERBOSE = mode;
  }

  function setMax(max) {
    VERBOSEMAX = max;
  }
  function setExternalLogging(func) {
    LOG_FUNC = func;
  }

  function HI() {
    if (ds(1)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
  }

  function MED() {
    if (ds(2)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
  }

  function LOW() {
    if (ds(3)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
  }

  function LOG() {
    if (ds(3)) console.log.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['log'], arguments)));
  }

  function WARN() {
    if (ds(1)) console.warn.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['warn'], arguments)));
  }

  function ERROR() {
    if (ds(1)) console.error.apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['error'], arguments)));
  }

  function GROPEN() {
    if (ds(3)) (console.group || console.log).apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['gropen'], arguments)));
  }

  function GRCLOSE() {
    if (ds(3)) (console.groupEnd || console.log).apply(console, arguments), (LOG_FUNC && LOG_FUNC.apply(undefined, [].concat.apply(['grclose'], arguments)));
  }

  function DESC(current, value, desc) {
    if (ds(3)) console.log(desc, '(result) ->', value, '(called with) ->', current);
    return value;
  }

  var logging = {
    setMode: setMode,
    setMax: setMax,
    setExternalLogging: setExternalLogging,
    HI: HI,
    MED: MED,
    LOW: LOW,
    LOG: LOG,
    WARN: WARN,
    ERROR: ERROR,
    GROPEN: GROPEN,
    GRCLOSE: GRCLOSE,
    DESC: DESC,
  };

  // BODY-STOP

  exports.logging = logging;
})(typeof module === 'object' ? module.exports : window.Drew);
