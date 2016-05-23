var drew = require('../src/drew');
var splitter = require('../lib/splitter');

// always must define macro or constant for IS_BLACK and IS_NEWLINE
var textMacros = {
  IS_BLACK: '!(` ` | `\t` | IS_NEWLINE)',
  LF: '`\\x0A`',
  CR: '`\\x0D`',
  IS_NEWLINE: 'LF | CR',
};
var textConstants = {}; // none needed

var tokens = splitter('hello, world!');
console.log('tokens', tokens);

drew(tokens, '^^[/\w/]', textMacros, textConstants, function(token) {
  token.value = token.value.toUpperCase();
});

console.log('Result:', tokens.map(function (t) { return t.value; }).join(''));
