var parse = require('./parse');
var run = require('./run');
var Par = require('./zeparser2/par.js').Par;

var constants = require('./constants');
var macros = require('./macros');

var tests = require('./tests');

var targetTestIndex = -1;
if (targetTestIndex >= 0) console.warn('only running test', targetTestIndex);

for (var i=0; i<tests.length; ++i) {
  if (targetTestIndex < 0 || targetTestIndex === i) {
    one(tests[i], i);
  }
}

function one(testCase, testIndex) {
  var rule = testCase[0];
  var input = testCase[1];
  var expect = testCase[2];
  var desc = testCase[3];

  var funcCode = undefined;
  var output = undefined;

  try {
    funcCode = parse(rule, constants, macros);
  } catch (e) {
    err('failed rule parse', testIndex, rule, e);
  }
  try {
    Par.parse(funcCode, {saveTokens:true});
  } catch (e) {
    err('zeparser rejected the generated rule code', testIndex, rule, e, funcCode);
  }
  try {
    var tokens = Par.parse(input, {saveTokens:true});
  } catch (e) {
    err('zeparser rejected the initial input', testIndex, rule, e, funcCode, input);
  }

  function antiCatch() {
    run(tokens.whites, funcCode, function(){
      calledback = true;

      var args = Array.prototype.slice.call(arguments, 0);
//      console.log('callback('+args.map(function(t){return t.white;})+')');
//      console.log('callback('+args+')');
      if (args[0]) args[0].value = '@';
      if (args[1]) args[1].value = '$';
      for (var i=2; i<args.length; ++i) args[i].value = '#';

      output = tokens.whites.map(function(t){ return t.value; }).join('');
    }, 'once');
  }

  var calledback = false;
  if (false) antiCatch();
  else try { antiCatch(); } catch (e) { console.log('disable antiCatch to trap error in browser'); err('failed to run', testIndex, rule, e, funcCode, input, expect, output); }

  var failed = expect !== (calledback ? output : input);
  if (failed) {
    if (window.document && document.write) document.write('<div style="font-weight: bold;">['+testIndex+'] FAIL: '+rule+' <small style="color:grey;">('+(desc||'no desc')+')</small></div>');
    console.warn('--- test ' + testIndex + ' failed' + (calledback ? '' : ' (did not trigger callback but expected to)'));
  } else {
    if (window.document && document.write) document.write('<div>['+testIndex+'] PASS: '+rule+'</div>');
  }

  if (failed || targetTestIndex >= 0) {
    log(rule, funcCode, input, expect, output);
  }
}
function err(reason, testIndex, rule, e, funcCode, input, expect, output) {
  console.error(reason+' [test '+testIndex+']');
  log(rule, funcCode, input, expect, output);
  console.error(e.stack || e);

  throw 'permanent error';
}
function log(rule, funcCode, input, expect, output) {
  console.log('- rule: '+rule);

  if (output === undefined) output = '<none>';

  if (input) console.log('- input : %o',input.replace(/\n/g, '\u23CE'));
  if (expect) console.log('- expect: %o',expect.replace(/\n/g, '\u23CE'));
  if (output) console.log('- output: %o',output.replace(/\n/g, '\u23CE'));

  if (funcCode) console.log(funcCode);
//  if (funcCode) console.log(funcCode.replace(/true && /g, ''));
}
