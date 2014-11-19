module.exports = run;

function run(tokens, ruleCode, handler){
//  console.log('######');

  var index = 0;
  var max = tokens.length - 1; // dont start at EOF token, it's artificial
  var check = compile(ruleCode, tokens);

//  console.log('Running on '+tokens.length+' tokens...');
//  console.log('######')

  while (index < max) {
    check(index, handler);
    // TODO: support some way of skipping the matched part, configurable from the rule
    ++index;
  }
}

function compile(ruleCode, tokens) {
//  console.log(ruleCode);

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

  var argStack = []; // args set while parsing, in array so we can drop them for trackbacks in ORs. the stack is filled in pairs (<arg name:index>)
  var argPointers = []; // marks starts of current conditional group on argStack

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
  function isNewline(delta) {
    var token = tokens[index+delta];
    return token.value === '\x0A' || token.value === '\x0D' || token.value === '\x0A\x0D' || token.value === '\u2028' || token.value === '\u2029';
  }
  function next() {
    ++index;
  }
  function seek() {
    var t = tokens[index];
    var isWhite = t && (t.type === WHITE || t.type === EOF);

    if (isWhite) {
      if (from === index) return false; // wait till first token is black before actually matching
      nextBlack();
    }
    return true;
  }
  function skipTo(newIndex) {
    index = newIndex;
    return true;
  }
  function nextBlack() {
    do {
      var t = tokens[++index];
    } while (t && (t.type === WHITE || t.type === EOF));
  }
  function symw() {
    symbolStarts.push(index);
    return true;
  }
  function checkToken(matches, startKey, stopKey) {
    var s = symbolStarts.pop();
    if (matches) {
      next();
      queueArgs(s, startKey, stopKey);
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
      queueArgs(s, startKey, stopKey);
    }
    return matches;
  }

  function symgt() {
    argPointers.push(argStack.length);
    symbolStarts.push(index);
  }
  function checkTokenGroup(matches, startKey, stopKey) {
    var s = symbolStarts.pop();
    var argPointer = argPointers.pop();
    if (argStack.length < argPointer) console.warn('assertion fail: arg stack is smaller than at start of group');
    if (matches) {
      queueArgs(s, startKey, stopKey);
    } else {
      argStack.length = argPointer;
    }
    return matches;
  }

  function symgc() {
    symbolStarts.push(index);
    return true;
  }
  function checkConditionGroup(matches, startKey, stopKey) {
    var s = symbolStarts.pop();
    if (matches) queueArgs(s, startKey, stopKey);
    return matches;
  }

  function queueArgs(startIndex, startKey, stopKey) {
    if (startKey) argStack.push(startKey, startIndex);
    if (stopKey) argStack.push(stopKey, index-1);
  }

  function flushArgs() {
    // there was a match. all relevant args are in the queue. flush it (in pairs!)
    if (!argStack.length) return null;

    var args = {length:0}; // fake array, may be passed on as is if there are any non-int keys. // TOFIX: improve perf here. we can do better than this :)

    if (argStack.length % 2) throw new Error('Assertion error: argStack has an uneven number of arguments');
    while (argStack.length) {
      var value = argStack.pop();
      var key = argStack.pop();
      setArg(args, key, value);
    }

    return args;
  }
  function setArg(args, name, index) {
    var n = parseInt(name, 10);
    if (String(n) === name) {
      args.length = Math.max(n+1, args.length);
      if (n === 0) seenZero = true;
    } else if (!nonIntKeys) {
      nonIntKeys = true;
      delete args.length; // allows for a user to call its arg `length` (I suppose not a rare case)
    }

    // set afterwards because of the `length` case
    args[name] = token(Math.min(tokens.length-1, Math.max(0, index)));
  }

  return function check(start, handler) {
    index = start;
    from = start;
    seenZero = false;
    nonIntKeys = false;

    if (argStack.length !== 0) throw new Error('Expect argStack to be empty before rule check ['+argStack+'] ['+argPointers+']');
    if (argPointers.length !== 0) throw new Error('Expect argPointers to be empty before rule check ['+argStack+'] ['+argPointers+']');

    var matched = ruleFunction();

    if (matched) {
      // apply all args currently in the stack
      var args = flushArgs(); // may return null

      if (!seenZero && args) {
        args[0] = token(start);
        args.length = Math.max(args.length, 1);
      }

      if (!args) handler(token(start));
      else if (nonIntKeys) handler(args);
      else handler.apply(undefined, args);
    } else {
      argStack.length = 0;
    }
  }
}
