// simple example
var Drew = require('drew'); // npm install drew

// setup inputs

var input = 'hello, world!';
var query = '^^[/[a-z]/]'; // "at the start of the input" "match a lower case letter"
function callback(token) {
  token.value = token.value.toUpperCase();
}
// these are required (though we don't really need them in this example)
var textMacros = {
  IS_BLACK: '!(` ` | `\t` | IS_NEWLINE)',
  IS_NEWLINE: '`\\x0A` | `\\x0D`',
};
var textConstants = {}; // none needed

// and to run:

var tokens = input.split('').map(function(s){ return {value: s}; });
Drew.drew(tokens, query, textMacros, textConstants, callback, {verboseMode: 0});
console.log(tokens.map(function (t) { return t.value; }).join(''));
// -> 'Hello, world!'
