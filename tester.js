var parse = require('./parse');
var run = require('./run');
var Par = require('./zeparser2/par.js').Par;

var constants = require('./constants');
var macros = require('./macros');

var tests = require('./tests');

var targetTestIndex = -1;
if (targetTestIndex >= 0) console.warn('only running test', targetTestIndex);

for (var i=0; i<tests.length; ++i) {
  if (targetTestIndex >= 0 && targetTestIndex !== i) continue;

  var test = tests[i];

  var rule = test[0];
  var input = test[1];
  var expect = test[2];
  var funcCode = undefined;

  try {
    funcCode = parse(rule, constants, macros);
  } catch (e) {
    console.error('failed rule parse '+i);
    console.log('- rule: '+rule);
    console.log('- input: '+input.replace(/\n/g, '\u23CE'));
    console.log('- expect:'+expect.replace(/\n/g, '\u23CE'));
//    console.log(funcCode);
//    console.log(funcCode.replace(/true && /g, ''));
    console.error(e.stack);

    throw 'permanent error';
  }
  try {
    var tokens = Par.parse(input, {saveTokens:true});
  } catch (e) {
    console.error('failed input parse '+i);
    console.log('- rule: '+rule);
    console.log('- input: '+input.replace(/\n/g, '\u23CE'));
    console.log('- expect:'+expect.replace(/\n/g, '\u23CE'));
    console.log(funcCode);
    console.log(funcCode.replace(/true && /g, ''));
    console.error(e.stack);

    throw 'permanent error';
  }

  try {
    run(tokens.whites, funcCode, function(){
      var args = Array.prototype.slice.call(arguments, 0);
      if (args[0]) args[0].value = '@';
      if (args[1]) args[1].value = '$';
      for (var i=2; i<args.length; ++i) {
        args[i].value = '#';
      }
    });
  } catch (e) {
    console.error('failed run '+i);
    console.log('- rule: '+rule);
    console.log('- input: '+input.replace(/\n/g, '\u23CE'));
    console.log('- expect:'+expect.replace(/\n/g, '\u23CE'));
    console.log(funcCode);
    console.log(funcCode.replace(/true && /g, ''));
    console.error(e.stack);

    throw 'permanent error';
  }

  var output = tokens.whites.map(function(t){ return t.value; }).join('');

  if (expect !== output) {
    console.warn('--- test ' + i + ' failed');
    if (window.document && document.write) document.write('<div>['+i+'] FAIL: '+rule+'</div>');
  } else {
    if (window.document && document.write) document.write('<div>['+i+'] PASS: '+rule+'</div>');
  }

  if (expect !== output || targetTestIndex >= 0) {
    console.log('- rule: '+rule);
    console.log('- input: '+input.replace(/\n/g, '\u23CE'));
    console.log('- expect:'+expect.replace(/\n/g, '\u23CE'));
    console.log('- output:'+output.replace(/\n/g, '\u23CE'));
    console.log(funcCode);
    console.log(funcCode.replace(/true && /g, ''));
    console.log('');
  }
}
