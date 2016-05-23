var drewTxt = require('../src/drew_txt');

var tokens = drewTxt(
  'You can blackbox your logging script in dev tools so your deferred console logs don\'t all originate from "logging.js" :)',
  '[!IS_BLACK] {/[a-z]/}=0',
  function(token) {
    console.log('match!', token);
    token.value = token.value.toUpperCase();
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

tokens = drewTxt(
  'You can blackbox your logging script in dev tools so your deferred console logs don\'t all originate from "logging.js" :)',
  '[!IS_BLACK] {/[a-z]/}=0',
  function(tokens, token) {
    console.log('match!', token);
    token.value = token.value.toUpperCase();
  },
  {
    verboseMode: 1,
    repeatMode: 'after',
    curryTokens: true,
  }
);

console.log('####');
console.log('Result:', tokens.map(function (t) { return t.value; }).join(''));
console.log('####');
