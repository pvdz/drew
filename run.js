module.exports = run;

function run(tokens, ruleCode, handler){
//  console.log('######');

  tokens[-1] = {type:-1, value:''}; // hack to get SOL to work. needs to consume a token even though there is none... // TODO: make sure this token is never actually returned

  var index = -1;
  var check = compile(ruleCode, tokens);

//  console.log('Running on '+tokens.length+' tokens...');
//  console.log('######')

  while (index < tokens.length) {
    check(index, handler);
    // TODO: support some way of skipping the matched part, configurable from the rule
    ++index;
  }
}

function compile(ruleCode, tokens) {
//  console.log(ruleCode);

  var SOL = -1;
  var STRING = 10;
  var NUMBER = 7;
  var REGEX = 8;
  var PUNCTUATOR = 9;
  var IDENTIFIER = 13;
  var EOF = 14;
  var ASI = 15;
  var ERROR = 16;
  var WHITE = 18;

  var index = 0;
  var from = 0;
  var symbolStarts = [];
  var ruleFunction = eval('('+ruleCode+');'); // direct eval woop
  var seenZero = false; // have we seen `=0` yet? if not, puts start at arg 0 when a rule matches
  var nonIntKeys = false; // have we seen args that are not ints?
  var args = null; // object to send to handler

  function value(str) {
    var s = tokens[index] && tokens[index].value;
    if (str) return s === str;
    return s;
  }
  function token(overrideIndex) {
    return tokens[Math.max(0, typeof overrideIndex === 'number' ? overrideIndex : index)];
  }
  function type(type) {
    if (!tokens[index]) return 0;
    if (type) return tokens[index].type === type;
    return tokens[index].type;
  }
  function next() {
    ++index;
  }
  function seek() {
    var t = tokens[index];
    var isWhite = t && (t.type === WHITE || t.type === SOL);

    if (isWhite) {
      if (from === index) return false; // wait till first token is black before actually matching
      nextBlack();
    }
    return true;
  }
  function nextBlack() {
    do {
      var t = tokens[++index];
    } while (t && (t.type === WHITE || t.type === SOL));
  }
//  function nextAfter(token) {
//    index = token.white + 1;
//
//    return true; // just for transformed rules
//  }
  function setArg(name, index) {
    if (!name) return;

    args[name] = token(index);

    var n = parseInt(name, 10);
    if (String(n) === name) {
      args.length = Math.max(n+1, args.length);
      if (n === 0) seenZero = true;
    } else {
      nonIntKeys = true;
    }
  }
  function symw() {
    symbolStarts.push(index);
    return true;
  }
  function checkToken(matches, startKey, stopKey) {
    var s = symbolStarts.pop();
    if (matches) {
      next();
      updateArgs(s, startKey, stopKey);
    }
    return matches;
  }

  function symb() {
    if (!seek()) return false;
    symbolStarts.push(index);
    return true;
  }
  function checkTokenBlack(matches, startKey, stopKey) {
    var s = symbolStarts.pop();
    if (matches) {
      next();
      updateArgs(s, startKey, stopKey);
    }
    return matches;
  }

  function symg() {
    symbolStarts.push(index);
    return true;
  }
  function checkGroup(matches, startKey, stopKey) {
//    console.log('checkgrtoup', index, matches, startKey, stopKey, symbolStarts.slice(0), token(symbolStarts[0]).value)
    var s = symbolStarts.pop();
    if (matches) updateArgs(s, startKey, stopKey);
    return matches;
  }

  function updateArgs(startIndex, startKey, stopKey) {
    setArg(startKey, startIndex);
    setArg(stopKey, index-1);
  }

  return function check(start, handler) {
    index = start;
    from = start;
    seenZero = false;
    args = {length:0}; // fake array, may be passed on as is if there are any non-int keys. // TOFIX: improve perf here. we can do better than this :)
    nonIntKeys = false;

    if (ruleFunction()) {
      if (!seenZero) {
        args[0] = token(start);
        args.length = Math.max(args.length, 1);
      }
      if (nonIntKeys) handler(args);
      else handler.apply(undefined, args);
    }
  }
}
