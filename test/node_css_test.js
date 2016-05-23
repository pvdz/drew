var drewCss = require('../src/drew_css');

var tokens = drewCss(
  '.foo {\n  color: red;\n  border: 1px solid orange;\n}',
  '{`{`}[!IS_BLACK & !IS_NEWLINE]*[IS_NEWLINE]=nl',
  function(obj) {
    console.log('match!', obj.nl);
    obj.nl.value = ' ';
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

tokens = drewCss(
  '.foo {\n  color: red;\n  border: 1px solid orange;\n}',
  '{`{`}[!IS_BLACK & !IS_NEWLINE]*[IS_NEWLINE]=nl',
  function(tokens, obj) {
    console.log('match!', obj.nl);
    obj.nl.value = ' ';
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
