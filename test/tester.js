var parse = require('./../src/parse');
var run = require('./../src/run');
var Par = require('./../lib/zeparser2/par.js').Par;

var constants = require('./../src/constants');
var macros = require('./../src/macros');

var tests = require('./tests');

var targetTestIndex = '';
//var targetTestIndex = 'plain text 1';
//var targetTestIndex = 'js 1';
if (targetTestIndex) VERBOSE = true, console.warn('only running test', targetTestIndex);
else VERBOSE = false;

function jsInputParser(input){
  try {
    return Par.parse(input, {saveTokens:true}).whites;
  } catch (e) {
    err('ZeParser rejected the initial test input:', e, input);
    return 'Input parser threw:' + String(e);
  }
}

for (var i=0; i<tests.txt.length; ++i) {
  one(tests.txt[i], 'plain text '+i);
}
document.body.appendChild(document.createElement('hr'));
for (var i=0; i<tests.js.length; ++i) {
  one(tests.js[i], 'js '+i, jsInputParser);
}

function defaultTestCallback(token0, token1){
  // note: callback is either mapped to args by index, or given as an object if at least one key is non-positive-int
  // this tester callback replaces the token in first arg with '@', second with '$', other args with '#'

  var args = Array.prototype.slice.call(arguments, 0);
//      console.log('callback('+args.map(function(t){return t.white;})+')');
//      console.log('callback('+args+')');
  if (token0) token0.value = '@';
  if (token1) token1.value = '$';
  for (var i=2; i<args.length; ++i) args[i].value = '#';
}

function one(testCase, testIndex, inputParser) {
  if (targetTestIndex && targetTestIndex !== testIndex) return;

  var rule = testCase[0];
  var input = testCase[1];
  var expect = testCase[2];
  var desc = testCase[3];
  var repeatMode = testCase[4] || 'once';
  var inputMode = testCase[5] || 'nocopy';
  var handler = testCase[6] || defaultTestCallback;

  var funcCode = undefined;
  var output = undefined;
  var E;

  var div = document.createElement('div');
  div.innerHTML =
    '<div>['+testIndex+':'+repeatMode+':'+inputMode+'] <i>'+esc(desc||'')+'</i></div>'+
    '<div>Query: <code>'+esc(rule)+'</code></div>'+
    (typeof handler === 'string' ? '<div>Replc: <code>'+esc(handler)+'</code></div>' : '') +
    '<div>Input: <code>'+esc(input)+'</code></div>'+
    '<div>Expect:<code>'+esc(expect)+'</code></div>'+
    '<div>Parsing query...</div>';

  document.body.appendChild(div);
  var outdiv = div.querySelectorAll('div')[4];

  div.setAttribute('style', 'background: orange; border-bottom: 1px solid black;');

  try {
    funcCode = parse(rule, constants, macros);
    div.querySelectorAll('div')[1].style.backgroundColor = 'yellow';
    if (targetTestIndex) console.log('generated code:\n'+funcCode);
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

  if (!inputParser) var tokens = input; // use built-in text parser
  else if (!E) {
    outdiv.innerHTML = 'Parsing test input';
    var tokens = inputParser(input);
    if (typeof tokens === 'string') {
      E = tokens;
      tokens = undefined;
      div.querySelectorAll('div')[2].style.backgroundColor = 'red';
    } else {
      div.querySelectorAll('div')[2].style.backgroundColor = 'lightgreen';
    }
  }

  function antiCatch() {
    // resultTokens will be equal to tokens unless tokens is a string
    var resultTokens = run(tokens, funcCode, typeof handler === 'string' ? handler : function callbackWrapper(token0, token1){
      // note: callback is either mapped to args by index, or given as an object if at least one key is non-positive-int
      // this tester callback replaces the token in first arg with '@', second with '$', other args with '#'

      calledback = true;

      var v = handler.apply(this, arguments);

      if (targetTestIndex) console.error('OK! Test callback called!', arguments);

      return v;
    }, repeatMode, inputMode);

    output = resultTokens.map(function(t){ return t.value; }).join('');
  }

  outdiv.innerHTML = 'Running query against input...';
  var calledback =  typeof handler === 'string'; // if not a string, the wrapper should set this to true
  if (E) {}
  else if (targetTestIndex) {
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

  if (targetTestIndex) {
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