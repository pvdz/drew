var drew = require('./drew').drew;
var splitter = require('../lib/splitter');

function drewTxt(input, query, callback, options) {
  if (!options) options = {};

  // make sure the IS_BLACK and IS_NEWLINE macros are defined at least
  var macros = options.macros || {};
  var constants = options.constants || {};
  if (!macros.IS_BLACK && !constants.IS_BLACK) {
    macros.IS_BLACK = '!(` ` | `\t` | IS_NEWLINE)';
  }
  if (!macros.IS_NEWLINE && !constants.IS_NEWLINE) {
    macros.IS_NEWLINE = '`\\x0A` | `\\x0D`';
  }

  var tokens = splitter(input);
  drew(tokens, query, macros, constants, callback, options);

  return tokens;
}

module.exports = drewTxt;
