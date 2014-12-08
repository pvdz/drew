module.exports = run;

var DEBUG = true;

function run(tokens, queryCode, handler, mode, first, last){
  if (!first) first = 0;
  if (!last) last = tokens.length-2;
//  console.log('######');

  var index = first;
  var max = last; // dont start at EOF token, it's artificial
  var check = compile(queryCode, tokens, mode);
  var count = 0;

  if (DEBUG) console.group('Applying query to input: %o', tokens.map(function(t){ return t.value; }).join(''));

  while (index <= max) {
    if (DEBUG) console.group('Applying query starting at token '+index+' / '+max+':', tokens[index]);
    var lastIndex = check(index, handler);

    if (mode === 'once') {
      if (lastIndex) {
        if (DEBUG) console.warn('Found match ['+lastIndex+'], stopping search because mode=once');
        if (DEBUG) console.groupEnd();
        break;
      } else {
        if (DEBUG) console.warn('No match ['+lastIndex+']['+mode+']');
        ++index;
      }
    } else if (mode === 'after') {
      if (index === lastIndex) {
        if (DEBUG) console.warn('No match ['+lastIndex+']['+mode+']');
        ++index;
      } else {
        if (DEBUG) console.warn('Found match ['+lastIndex+'], jumping to after match because mode=after');
        index = lastIndex + 1;
      }
    } else if (mode === 'every') {
      if (lastIndex) if (DEBUG) console.warn('Found match ['+lastIndex+'], starting with next token because mode='+mode);
      else if (DEBUG) console.warn('No match ['+lastIndex+']['+mode+']');
      ++index;
    } else {
      throw 'unknown mode: '+mode;
    }
    if (DEBUG) console.groupEnd();
  }
  if (DEBUG) console.groupEnd();
}

function compile(queryCode, tokens, mode) {
//  console.log(queryCode);

  var STRING = 10;
  var NUMBER = 7;
  var REGEX = 8;
  var PUNCTUATOR = 9;
  var IDENTIFIER = 13;
  var EOF = 14;
  var ASI = 15;
  var ERROR = 16;
  var WHITE = 18;

  var NORMAL_CALL = 0;
  var REPEAT_CALL = 1;
  var COLLECT_CALL = 2;

  var EARLY_CALL = -1;

  var index = 0;
  var from = 0;
  var symbolStarts = [];
  var queryFunction = eval('('+queryCode+');'); // direct eval woop
  var nonIntKeys = false; // have we seen args that are not ints?

  var argStack = []; // args set while parsing, in array so we can drop them for trackbacks in ORs. the stack is filled in pairs (<arg name:index>)
  var argPointers = []; // marks starts of current conditional group on argStack

  var tokensMatched = []; // starts of each symw and symb
  var tokensMatchGroupPointers = []; // allows to remove all match starts when a token group fails to match (gets rid of multiple partial matches)

  var callStack = []; // callback queue
  var callPointers = []; // in case we have to undo a callback in case of a failed future

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
//      if (from === index) return false; // wait till first token is black before actually matching
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
    if (DEBUG) console.group('white token', argStack.slice(0));
    updateSymbStarts();
    symbolStarts.push(index);
    if (argStack.length === 0) argStack.push('0', index); // set default 0 key to first black
    tokensMatched.push(index);
    return true;
  }
  function checkTokenWhite(matches, startKey, stopKey, loopCount, repeatedCall, minCall) {
    var s = symbolStarts.pop();
    if (DEBUG) console.log('## checkTokenWhite: matches='+!!matches+', loopCount='+loopCount);
    if (matches) {
      next();
      queueArgs(s, startKey, stopKey, loopCount);
      queueRepeatCalls(repeatedCall, startKey, s);
    }
    if (!matches || loopCount === 0) {
      tokensMatched.pop();
    }
    if (DEBUG) console.log('argStack:', argStack.slice(0));
    if (DEBUG) console.log('tokensMatched:', tokensMatched.slice(0));
    if (DEBUG) console.groupEnd();
    return matches;
  }

  function symb() {
    if (DEBUG) console.group('black token', argStack.slice(0));
    if (!seek()) return false;
    updateSymbStarts();
    symbolStarts.push(index);
    if (argStack.length === 0) argStack.push('0', index); // set default 0 key to first black
    tokensMatched.push(index);
    return true;
  }
  function checkTokenBlack(matches, startKey, stopKey, loopCount, repeatedCall, minCall) {
    var s = symbolStarts.pop();
    if (DEBUG) console.log('## checkTokenBlack: matches='+!!matches+', loopCount='+loopCount);
    if (matches) {
      next();
      queueArgs(s, startKey, stopKey, loopCount);
      queueRepeatCalls(repeatedCall, startKey, s);
    }
    if (!matches || loopCount === 0) {
      tokensMatched.pop();
    }
    if (DEBUG) console.log('argStack:', argStack.slice(0));
    if (DEBUG) console.log('tokensMatched:', tokensMatched.slice(0));
    if (DEBUG) console.groupEnd();
    return matches;
  }

  function symgt() {
    argPointers.push(argStack.length);
    callPointers.push(callStack.length);
    tokensMatchGroupPointers.push(tokensMatched.length);
    symbolStarts.push(-1);
    // at start of symb and symw this list should be scanned for -1 and any encountered (can have
    // multiple with nested groups) should be replaced with the current index. Can't do it before
    // because a group can start at either the next white or black token and we can't know at compile time.
    if (DEBUG) console.group('token group start');
  }
  function checkTokenGroup(matches, consumed, startKey, stopKey, loopCount, repeatedCall, minCall) {
    var s = symbolStarts.pop();
    var argPointer = argPointers.pop();
    if (argStack.length < argPointer) console.warn('assertion fail: arg stack is smaller than at start of group');
    var callPointer = callPointers.pop();
    if (callPointers.length < callPointer) console.warn('assertion fail: call stack is smaller than at start of group');
    if (DEBUG) console.log('## checkTokenGroup: '+!!matches)
    if (matches) {
      if (consumed) { // was any token consumed?
        queueArgs(s, startKey, stopKey, loopCount);
        queueRepeatCalls(repeatedCall, startKey, s, stopKey, index-1);
      }
      tokensMatchGroupPointers.pop();
    } else {
      argStack.length = argPointer;
      callStack.length = callPointer;
      tokensMatched.length = tokensMatchGroupPointers.pop();
    }
    if (DEBUG) console.log('argStack:', argStack.slice(0));
    if (DEBUG) console.log('tokensMatched:', tokensMatched.slice(0));
    if (DEBUG) console.groupEnd();
    return matches;
  }

  function updateSymbStarts() {
    // search top for -1 occurrences
    // replace each of them with the current index
    var symbolPos = symbolStarts.length;
    while (symbolStarts[symbolPos-1] === -1) {
      symbolStarts[--symbolPos] = index;
    }
  }

  function symgc() {
    symbolStarts.push(index); // TOFIX: why?
    return true;
  }
  function checkConditionGroup(matches, startKey, stopKey) {
    var s = symbolStarts.pop();
    if (matches) queueArgs(s, startKey, stopKey);
    return matches;
  }

  function queueArgs(startIndex, startKey, stopKey, loopCount) {
    // if loopCount is given, this is quantified and we must not update start more than once (starts with 0)
    if (startKey && (loopCount === undefined || loopCount === 1)) argStack.push(startKey, startIndex);
    if (stopKey) argStack.push(stopKey, index-1);
  }
  function flushArgs(theseArgs) {
    // there was a match. all relevant args are in the queue. flush it (in pairs!)
    if (!theseArgs.length) return null;
    if (theseArgs.length % 2) throw new Error('Assertion error: argStack must have has an even number of arguments');

//    console.group('flushArgs(',theseArgs,')');
    var args = {length:0}; // fake array, may be passed on as is if there are any non-int keys. // TOFIX: improve perf here. we can do better than this :)

    var intsOnly = true;
    while (theseArgs.length) {
      // last recorded value for a key wins, process stack bottom to top (shift vs pop)
      var key = theseArgs.shift();
      var value = theseArgs.shift();
//console.log('key:', key, ', value:', value);
      if (intsOnly) {
        var n = parseInt(key, 10);
        intsOnly = String(key) === String(n);
        if (intsOnly) args.length = Math.max(n+1, args.length);
        else delete args.length; // allows for a user to call its arg `length` (I suppose not a rare case)
      }

      // set afterwards because of the `length` case
      args[key] = token(Math.min(tokens.length-1, Math.max(0, value)));
    }

//    console.log('args -> ', args);
//    console.groupEnd();
    return args;
  }

  function queueRepeatCalls(repeatedCall, startKey, repeatStart, stopKey, repeatStop) {
    if (repeatedCall) {
      var theseArgs = argStack.slice(0);
      // make sure start key starts at last repeated part, not entire repeated part
      if (startKey) theseArgs.push(startKey, repeatStart);
      queueCall(theseArgs);
    }
  }
  function queueCall(argStack) {
    callStack.push(argStack);
    tokensMatched.push(EARLY_CALL); // to detect whether query ended in early call to suppress an implicit call
  }
  function queueEarlyCall(name) {
    queueCall(argStack.slice(0));
    argStack.length = 0;
  }

  return function check(start, handler) {
    index = start;
    from = start;
    nonIntKeys = false;

    if (argStack.length !== 0) throw new Error('Expect argStack to be empty before query check ['+argStack+'] ['+argPointers+']');
    if (argPointers.length !== 0) throw new Error('Expect argPointers to be empty before query check ['+argStack+'] ['+argPointers+']');
    if (callStack.length !== 0) throw new Error('Expect queuedCalls to be empty before query check ['+callStack+'] ['+callPointers+']');
    if (callPointers.length !== 0) throw new Error('Expect callPointers to be empty before query check ['+callStack+'] ['+callPointers+']');
    if (tokensMatched.length !== 0) throw new Error('Expect tokensMatched to be empty before query check ['+tokensMatched+']');

    var matched = queryFunction();

    if (argPointers.length !== 0) throw 'Expecting argPointers to be emtpy after a query';
    if (callPointers.length !== 0) throw 'Expecting callPointers to be emtpy after a query';

    var returnValue = true;
    if (matched) {
      if (DEBUG) console.log('Queue implicit match call?', tokensMatched.slice(0),'->',tokensMatched[tokensMatched.length-1] !== EARLY_CALL);
      if (tokensMatched[tokensMatched.length-1] !== EARLY_CALL) {
        queueCall(argStack.slice(0));
      }

      callStack.forEach(function(args){
        // TOFIX: %
        var args = flushArgs(args); // may return null

        if (!args) handler(token(start));
        else if (nonIntKeys) handler(args);
        else handler.apply(undefined, args);
      });

      // last token evaluated by query
      if (mode === 'after') returnValue = Math.max(start, index - 1);
    } else {
      // continue as usual
      if (mode === 'after') returnValue = start;
      else returnValue = false;
    }

    argStack.length = 0;
    callStack.length = 0;
    tokensMatched.length = 0;

    if (mode === 'once' || mode === 'after' || mode === 'every') return returnValue;
    throw 'unknown mode: '+mode;
  }
}
