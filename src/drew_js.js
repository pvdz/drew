var drew = require('./drew').drew;
var zeparser2 = require('../lib/zeparser2/par').Par;

/**
 * Apply drew to JS (ES5) source with built-in presets
 *
 * @param {string} input
 * @param {string} query
 * @param {Function} callback
 * @param {Object} [options={}] See also the options for drew()
 * @property {Object} [macros={}] Additional macros, will set IS_BLACK and IS_NEWLINE on this only if not already set
 * @property {Object} [constants={}] Additional constants, will set IS_BLACK and IS_NEWLINE on this only if not already set
 * @returns {Object[]} The tokens
 */
function drewJs(input, query, callback, options) {
  if (!options) options = {};
  var macros = options.macros || {};
  var constants = options.constants || {};

  // make sure the IS_BLACK and IS_NEWLINE macros are defined at least
  if (!macros.IS_BLACK && !constants.IS_BLACK) {
    constants.IS_BLACK = 'current().type !== '+zeparser2.WHITE;
  }
  if (!macros.IS_NEWLINE && !constants.IS_NEWLINE) {
    macros.IS_NEWLINE = '`\\x0A` | `\\x0D` | `\\x0A\\x0D` | `\\u2028` | `\\u2029`';
  }

  // special to JS: allows you to jump between special pairs
  if (!constants.JUMP_TO_RHC) constants.JUMP_TO_RHC = 'current().rhc && seekTo(current().rhc.white)';
  if (!constants.JUMP_TO_RHS) constants.JUMP_TO_RHS = 'current().rhs && seekTo(current().white)';
  if (!constants.JUMP_TO_RHP) constants.JUMP_TO_RHP = 'current().rhp && seekTo(current().rhp.white)';
  // skip from current curly to after the next (group because param assignments are a problem otherwise)
  if (!macros.CURLY_PAIR) macros.CURLY_PAIR = '(CURLY_OPEN & JUMP_TO_RHC)';
  if (!macros.SQUARE_PAIR) macros.SQUARE_PAIR = '(SQUARE_OPEN & JUMP_TO_RHS)';
  if (macros.PAREN_PAIR) macros.PAREN_PAIR = '(PAREN_OPEN & JUMP_TO_RHP)';

  var tokens = zeparser2.parse(input, {saveTokens: true}).whites;
  drew(tokens, query, macros, constants, callback, options);

  return tokens;
}

module.exports = drewJs;
