var parse = require('./parse');
var run = require('./run');
var Par = require('./zeparser2/par.js').Par;

var constants = require('./constants');
var macros = require('./macros');

var tests = require('./tests');

var targetTestIndex = -1;
//var targetTestIndex = 130;
if (targetTestIndex >= 0) VERBOSE = true, console.warn('only running test', targetTestIndex);
else VERBOSE = false;

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
  var E;

  var div = document.createElement('div');
  div.innerHTML =
    '<div>['+testIndex+'] <i>'+esc(desc||'')+'</i></div>'+
    '<div>Query: <code>'+esc(rule)+'</code></div>'+
    '<div>Input: <code>'+esc(input)+'</code></div>'+
    '<div>Expect:<code>'+esc(expect)+'</code></div>'+
    '<div>Parsing query...</div>';

  document.body.appendChild(div);
  var outdiv = div.querySelectorAll('div')[4];

  div.setAttribute('style', 'background: orange; border-bottom: 1px solid black;');

  try {
    funcCode = parse(rule, constants, macros);
    div.querySelectorAll('div')[1].style.backgroundColor = 'yellow';
    if (targetTestIndex >= 0) console.log('generated code:\n'+funcCode);
  } catch (e) {
    err('failed rule parse', testIndex, rule, e);
    E = 'Query parser:' + String(e);
  }
  outdiv.innerHTML = 'Parsing generated func';
  if (!E) try {
    Par.parse(funcCode, {saveTokens:true});
    div.querySelectorAll('div')[1].style.backgroundColor = 'lightgreen';
  } catch (e) {
    E = 'Func parser:' + String(e);
    err('zeparser rejected the generated rule code', testIndex, rule, e, funcCode);
  }
  outdiv.innerHTML = 'Parsing test input';
  if (!E) try {
    var tokens = Par.parse(input, {saveTokens:true});
    div.querySelectorAll('div')[2].style.backgroundColor = 'lightgreen';
  } catch (e) {
    E = 'Input parser:' + String(e);
    err('zeparser rejected the initial input', testIndex, rule, e, funcCode, input);
  }

  function antiCatch() {
    // note: callback is either mapped to args by index, or given as an object if at least one key is non-positive-int
    // this tester callback replaces the token in first arg with '@', second with '$', other args with '#'
    run(tokens.whites, funcCode, function(token0, token1){
      calledback = true;

      var args = Array.prototype.slice.call(arguments, 0);
//      console.log('callback('+args.map(function(t){return t.white;})+')');
//      console.log('callback('+args+')');
      if (args[0]) args[0].value = '@';
      if (args[1]) args[1].value = '$';
      for (var i=2; i<args.length; ++i) args[i].value = '#';

      output = tokens.whites.map(function(t){ return t.value; }).join('');
      if (targetTestIndex >= 0) console.error('OK! Test callback called!', args);
    }, 'once');
  }

  outdiv.innerHTML = 'Running query against input...';
  var calledback = false;
  if (E) {}
  else if (targetTestIndex >= 0) {
    antiCatch();
  }
  else try { antiCatch(); } catch (e) {
    E = 'Runner:' + String(e);
    console.log('disable antiCatch to trap error in browser'); err('failed to run', testIndex, rule, e, funcCode, input, expect, output);
  }

  var result = (calledback ? output : input);
  var failed = expect !== result;
  if (failed || E) {
    div.style.backgroundColor = 'tomato';
    outdiv.innerHTML =
      '<b>FAIL</b> : <code>'+esc(result)+'</code> <small style="color:white;">('+esc(E||'expected output not matching actual result')+')</small>';
    console.warn('--- test ' + testIndex + ' failed' + (calledback ? '' : ' (did not trigger callback but expected to)'));
  } else {
    div.style.backgroundColor = 'lightgreen';
    outdiv.innerHTML =
      '<b>PASS</b>';
  }

  if (targetTestIndex >= 0) {
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

//  if (funcCode) console.log(funcCode.replace(/true && /g, ''));
}

function esc(s) {
  return nou(nonl(sans(s)));
}
function sans(s) {
  if (!s) return s;
  if (s instanceof Array) return '['+s.join(', ')+']';
  s += '';
  return nonl(s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'));
}
function nonl(s) {
  if (!s) return s;
  return s.replace(/[\u000a\u000c\u000d\u2028\u2029]/g, '\u21b5');
}
function nou(s) {
  if (!s) return s;
  return s.replace(/[\u007f-\u0080]/, '\u00bf');
}