var drewJs = require('../src/drew_js');

var tokens = drewJs(
  'if(foo)\nbar;',
  '{`)`}[!IS_BLACK & !IS_NEWLINE]*[IS_NEWLINE]=0{!`{`}',
  function(token) {
    console.log('match!', token);
    token.value = ' ';
  },
  {
    verboseMode: 2,
    repeatMode: 'after',
  }
);

console.log('####');
console.log('Result:', tokens.map(function (t) { return t.value; }).join(''));
console.log('####');
console.log('');

tokens = drewJs(
  'if(foo)\nbar;',
  '{`)`}[!IS_BLACK & !IS_NEWLINE]*[IS_NEWLINE]=0{!`{`}',
  function(tokens, token) {
    console.log('match!', token);
    token.value = ' ';
  },
  {
    verboseMode: 2,
    repeatMode: 'after',
    curryTokens: true,
  }
);

console.log('####');
console.log('Result:', tokens.map(function (t) { return t.value; }).join(''));
console.log('####');
