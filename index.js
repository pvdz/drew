var parse = require('./parse');
var run = require('./run');
var Par = require('./zeparser2/par.js').Par;

var constants = require('./constants');
var macros = require('./macros');

var input = 'var a = 20;';
var rule = '[SPACE | TAB]';

rule = '^[`b`]=5[`;`]=foo';
input = 'a;\nb;';

console.log('Target input:', [input]);
console.log('Target rule :', [rule]);


var funcCode = parse(rule, constants, macros);
var tokens = Par.parse(input, {saveTokens:true});
console.log(funcCode);

run(tokens.whites, funcCode, function(){
  console.error('OK! ## rule matched!:', [].slice.call(arguments, 0));
}, 'once');

console.log(tokens.whites.map(function(t){ return t.value; }).join(''));

