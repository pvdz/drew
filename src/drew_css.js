var drew = require('./drew').drew;
var CssParser = require('../lib/ccssparser/csspar');
var CssConstants = require('../lib/ccssparser/constants');

/**
 * Apply drew to CSS source with built-in presets
 *
 * @param {string} input
 * @param {string} query
 * @param {Function} callback
 * @param {Object} [options={}] See also the options for drew()
 * @property {Object} [macros={}] Additional macros, will set IS_BLACK and IS_NEWLINE on this only if not already set
 * @property {Object} [constants={}] Additional constants, will set IS_BLACK and IS_NEWLINE on this only if not already set
 * @returns {Object[]} The tokens
 */
function drewCss(input, query, callback, options) {
  if (!options) options = {};
  var macros = options.macros || {};
  var constants = options.constants || {};

  // make sure the IS_BLACK and IS_NEWLINE macros are defined at least
  if (!macros) macros = {};
  if (!constants) constants = {};
  if (!macros.IS_BLACK && !constants.IS_BLACK) {
    constants.IS_BLACK = 'current().type !== '+CssConstants.TOKEN_WHITESPACE;
  }
  if (!macros.IS_NEWLINE && !constants.IS_NEWLINE) {
    constants.IS_NEWLINE = 'current().type === '+CssConstants.TOKEN_NEWLINE;
  }

  CssParser.parse(input);
  var tokens= CssParser.getAllTokens();
  drew(tokens, query, macros, constants, callback, options);

  return tokens;
}

module.exports = drewCss;