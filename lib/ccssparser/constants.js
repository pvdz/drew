/** https://github.com/qfox/gssparser */

var Constants = (typeof module === 'undefined' ? {} : module).exports = (function(){
  var VERBOSE = false;

  var LOG = function(){ if (VERBOSE) console.log.apply(console, arguments); };
  var WARN = function(){ if (VERBOSE) console.warn.apply(console, arguments); };
  var ERROR = function(){ if (VERBOSE) console.error.apply(console, arguments); };





  // ### END_OF_HEADER ###





  var TOKEN_NONE = 0;
  var TOKEN_INCLUDES = 1;
  var TOKEN_DASHMATCH = 2;
  var TOKEN_PREFIXMATCH = 3;
  var TOKEN_SUFFIXMATCH = 4;
  var TOKEN_SUBSTRINGMATCH = 5;
  var TOKEN_IDENT = 6;
  var TOKEN_STRING = 7;
  var TOKEN_FUNCTION = 8;
  var TOKEN_NUMBER = 9;
  var TOKEN_HASH = 10;
  var TOKEN_PLUS = 11;
  var TOKEN_GREATER = 12;
  var TOKEN_COMMA = 13;
  var TOKEN_TILDE = 14;
  var TOKEN_COLON = 15;
  var TOKEN_AT = 16;
  var TOKEN_INVALID = 17;
  var TOKEN_PERCENTAGE = 18;
  var TOKEN_DASH = 19;
  var TOKEN_CDO = 20;
  var TOKEN_CDC = 21;
  var TOKEN_WHITESPACE = 22;
  var TOKEN_EOF = 23;
  var TOKEN_ERROR = 24;
  var TOKEN_COMMENT = 25;
  var TOKEN_NEWLINE = 27;
  var TOKEN_DOT = 28;
  var TOKEN_PUNCTUATOR = 29;
  var TOKEN_URL = 30;
  var TOKEN_BAD_URL = 31;

  var Constants = {};

  // do export the token constants, even in the build
  Constants[Constants.TOKEN_NONE = TOKEN_NONE] = 'NONE';
  Constants[Constants.TOKEN_INCLUDES = TOKEN_INCLUDES] = 'INCLUDES';
  Constants[Constants.TOKEN_DASHMATCH = TOKEN_DASHMATCH] = 'DASHMATCH';
  Constants[Constants.TOKEN_PREFIXMATCH = TOKEN_PREFIXMATCH] = 'PREFIXMATCH';
  Constants[Constants.TOKEN_SUFFIXMATCH = TOKEN_SUFFIXMATCH] = 'SUFFIXMATCH';
  Constants[Constants.TOKEN_SUBSTRINGMATCH = TOKEN_SUBSTRINGMATCH] = 'SUBSTRINGMATCH';
  Constants[Constants.TOKEN_IDENT = TOKEN_IDENT] = 'IDENT';
  Constants[Constants.TOKEN_STRING = TOKEN_STRING] = 'STRING';
  Constants[Constants.TOKEN_FUNCTION = TOKEN_FUNCTION] = 'FUNCTION';
  Constants[Constants.TOKEN_NUMBER = TOKEN_NUMBER] = 'NUMBER';
  Constants[Constants.TOKEN_HASH = TOKEN_HASH] = 'HASH';
  Constants[Constants.TOKEN_PLUS = TOKEN_PLUS] = 'PLUS';
  Constants[Constants.TOKEN_GREATER = TOKEN_GREATER] = 'GREATER';
  Constants[Constants.TOKEN_COMMA = TOKEN_COMMA] = 'COMMA';
  Constants[Constants.TOKEN_TILDE = TOKEN_TILDE] = 'TILDE';
  Constants[Constants.TOKEN_COLON = TOKEN_COLON] = 'COLON';
  Constants[Constants.TOKEN_AT = TOKEN_AT] = 'ATKEYWORD';
  Constants[Constants.TOKEN_INVALID = TOKEN_INVALID] = 'INVALID';
  Constants[Constants.TOKEN_PERCENTAGE = TOKEN_PERCENTAGE] = 'PERCENTAGE';
  Constants[Constants.TOKEN_DASH = TOKEN_DASH] = 'DASH';
  Constants[Constants.TOKEN_CDO = TOKEN_CDO] = 'CDO';
  Constants[Constants.TOKEN_CDC = TOKEN_CDC] = 'CDC';
  Constants[Constants.TOKEN_EOF = TOKEN_EOF] = 'EOF';
  Constants[Constants.TOKEN_ERROR = TOKEN_ERROR] = 'ERROR';
  Constants[Constants.TOKEN_COMMENT = TOKEN_COMMENT] = 'COMMENT';
  Constants[Constants.TOKEN_WHITESPACE = TOKEN_WHITESPACE] = 'WHITESPACE';
  Constants[Constants.TOKEN_NEWLINE = TOKEN_NEWLINE] = 'NEWLINE';
  Constants[Constants.TOKEN_DOT = TOKEN_DOT] = 'DOT';
  Constants[Constants.TOKEN_PUNCTUATOR = TOKEN_PUNCTUATOR] = 'PUNCTUATOR';
  Constants[Constants.TOKEN_URL = TOKEN_URL] = 'URL';
  Constants[Constants.TOKEN_BAD_URL = TOKEN_BAD_URL] = 'BAD_URL';
  // but dont expose other constants if they're not relevant







  // ### START_OF_FOOTER ###







  Constants.LOG = LOG;
  Constants.WARN = WARN;
  Constants.ERROR = ERROR;

  return Constants
})();
