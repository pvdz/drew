module.exports = run;

function run(tokens, ruleCode, handler, mode){
//  console.log('######');

  var index = 0;
  var max = tokens.length - 1; // dont start at EOF token, it's artificial
  var check = compile(ruleCode, tokens, mode);
  var count = 0;

//  console.log('Running on '+tokens.length+' tokens...');
//  console.log('######')

  while (index < max) {
    var lastIndex = check(index, handler);

    if (mode === 'once') break;

    if (mode === 'after') index = lastIndex+1;
    else ++index;
  }
}

function compile(ruleCode, tokens, mode) {
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

  var multiCall = null;

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
    updateSymbStarts();
    symbolStarts.push(index);
    return true;
  }
  function checkToken(matches, startKey, stopKey, loopCount, repeatedCall) {
    var s = symbolStarts.pop();
    if (matches) {
      next();
      queueArgs(s, startKey, stopKey, loopCount);
      queueRepeatCalls(repeatedCall, startKey, s);
    }
    return matches;
  }

  function symb() {
    if (!seek()) return false;
    updateSymbStarts();
    symbolStarts.push(index);
    return true;
  }
  function checkTokenBlack(matches, startKey, stopKey, loopCount, repeatedCall) {
    var s = symbolStarts.pop();
    if (matches) {
      next();
      queueArgs(s, startKey, stopKey, loopCount);
      queueRepeatCalls(repeatedCall, startKey, s);
    }
    return matches;
  }

  function symgt() {
    argPointers.push(argStack.length);
    symbolStarts.push(-1);
    // at start of symb and symw this list should be scanned for -1 and any encountered (can have
    // multiple with nested groups) should be replaced with the current index. Can't do it before
    // because a group can start at either the next white or black token and we can't know at compile time.
  }
  function checkTokenGroup(matches, startKey, stopKey, loopCount, repeatedCall, repeatStart) {
    var s = symbolStarts.pop();
    var argPointer = argPointers.pop();
    if (argStack.length < argPointer) console.warn('assertion fail: arg stack is smaller than at start of group');
    if (matches) {
      queueArgs(s, startKey, stopKey, loopCount);
      queueRepeatCalls(repeatedCall, startKey, s);
    } else {
      argStack.length = argPointer;
    }
    return matches;
  }

  function updateSymbStarts() {
    // search top for -1 occurrences
    // replace each of them with the current index
    var symbolPos = symbolStarts.length;
    while (symbolStarts[symbolPos-1] === -1)
      symbolStarts[--symbolPos] = index
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

  function queueArgs(startIndex, startKey, stopKey, loopCount) {
    // if loopCount is given, this is quantified and we must not update start more than once (starts with 0)
    if (startKey && !loopCount) argStack.push(startKey, startIndex);
    if (stopKey) argStack.push(stopKey, index-1);
  }

  function queueRepeatCalls(repeatedCall, startKey, repeatStart) {
    if (repeatedCall) {
      if (!multiCall) multiCall = [];
      var theseArgs = argStack.slice(0);
      // make sure start key starts at last repeated part, not entire repeated part
      if (startKey) theseArgs.push(startKey, repeatStart);
      multiCall.push(theseArgs);
    }
  }

  function flushArgs(theseArgs) {
    if (theseArgs === undefined) theseArgs = argStack;

    // there was a match. all relevant args are in the queue. flush it (in pairs!)
    if (!theseArgs.length) return null;

    var args = {length:0}; // fake array, may be passed on as is if there are any non-int keys. // TOFIX: improve perf here. we can do better than this :)

    if (theseArgs.length % 2) throw new Error('Assertion error: argStack has an uneven number of arguments');
    while (theseArgs.length) {
      // go left to right to update quantified values (-> shift vs pop)
      var key = theseArgs.shift();
      var value = theseArgs.shift();
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
    multiCall = null;

    if (argStack.length !== 0) throw new Error('Expect argStack to be empty before rule check ['+argStack+'] ['+argPointers+']');
    if (argPointers.length !== 0) throw new Error('Expect argPointers to be empty before rule check ['+argStack+'] ['+argPointers+']');

    var matched = ruleFunction();

    if (multiCall) {
      multiCall.forEach(function(list, i){
        var args = flushArgs(list); // may return null

        if (!seenZero && args) {
          args[0] = token(start);
          args.length = Math.max(args.length, 1);
        }
        if (!args) handler(token(start));
        else if (nonIntKeys) handler(args);
        else handler.apply(undefined, args);
      });

      argStack.length = 0;

      if (mode === 'once') return true;
      if (mode === 'after') return index-1; // last token evaluated by rule
      return;
    } else if (matched) {
      // apply all args currently in the stack
      var args = flushArgs(); // may return null

      if (!seenZero && args) {
        args[0] = token(start);
        args.length = Math.max(args.length, 1);
      }
      if (!args) handler(token(start));
      else if (nonIntKeys) handler(args);
      else handler.apply(undefined, args);

      if (mode === 'once') return true;
      if (mode === 'after') return index-1; // last token evaluated by rule
      return;
    } else {
      argStack.length = 0;

      if (mode === 'once') return false;
      if (mode === 'after') return start; // continue as usual
      return;
    }
  }
}
