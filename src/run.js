module.exports = run;

var VERBOSE = true;
var VERBOSEMAX = 5000;
function ds() { if (VERBOSE && ++VERBOSE > VERBOSEMAX) VERBOSE = false, console.log('DEAD MANS SWITCH ACTIVATED, FURTHER LOGGING SQUASHED'); return VERBOSE; }
function LOG(){ if (ds()) console.log.apply(console, arguments); }
function WARN(){ if (ds()) console.warn.apply(console, arguments); }
function ERROR(){ if (ds()) console.error.apply(console, arguments); }
function GROPEN(){ if (ds()) console.group.apply(console, arguments); }
function GRCLOSE(){ if (ds()) console.groupEnd.apply(console, arguments); }

function run(tokens, queryCode, handler, repeatMode, copyInputMode, startTokenIndex, stopTokenIndex){
  LOG('run(<tokens>, <queryCode>, <handler>, '+[repeatMode, copyInputMode, startTokenIndex, stopTokenIndex].join()+')');
  if (!startTokenIndex) startTokenIndex = 0;
  if (!stopTokenIndex) stopTokenIndex = tokens.length-2;
  if (!repeatMode) repeatMode = 'once'; // once, after, every
  if (!copyInputMode) copyInputMode = 'nocopy'; // copy, nocopy

  var index = startTokenIndex;
  var max = stopTokenIndex; // dont start at EOF token, it's artificial

  var copiedInput;
  switch (copyInputMode) {
    case 'copy':
      LOG('inputMode=copy: Copying original input to local array');
      WARN('Drew will cache the original <token>.value and not use your changes when applying the query');
      copiedInput = Array(max+1-index); // we know how large the array will be
      for (var i=index; i<=max; ++i) copiedInput[i] = tokens[i].value;
      LOG('clone:', copiedInput);
      break;
    case 'nocopy':
      WARN('inputMode=nocopy: Drew will use actual values in <token>.value and use your changes when applying the query');
      break;
    default:
      throw 'Assertion error: inputMode should be one of a fixed set';
  }

  switch (repeatMode) {
    case 'once':
      WARN('repeatMode=once: Drew will exit immediately after the first match');
      break;
    case 'after':
      WARN('repeatMode=after: After a match Drew will continue with the first token _after_ the last match');
      break;
    case 'every':
      WARN('repeatMode=every: After a match Drew will continue with the token after the last start');
      break;
    default:
      throw 'Assertion error: repeatMode should be one of a fixed set';
  }

  var check = compile(queryCode, tokens, repeatMode, copiedInput);

  WARN('Applying query to '+(copiedInput?'(c) ':'')+'input token %d to %d: %o ->', startTokenIndex, stopTokenIndex, (copiedInput ? copiedInput[startTokenIndex] : tokens[startTokenIndex].value), tokens[startTokenIndex]);

  while (index <= max) {
    GROPEN('Applying query starting at '+(copiedInput?'(c) ':'')+'token %d / %d: %o ->', index, stopTokenIndex, (copiedInput ? copiedInput[index] : tokens[index].value), tokens[index]);
    var lastIndex = check(index, handler, copiedInput);

    if (lastIndex === true && copyInputMode === 'copy') WARN('Callback returned true but input mode is copy so not restarting from same');

    if (lastIndex === true && copyInputMode === 'nocopy') {
      // handler return true at least once, restart from same index if input mode is nocopy
      // (if copyInputMode=copy, starting from the same token would most likely mean loop)
      WARN('Callback returned true at least once, restarting from same token');
    } else if (!repeatMode || repeatMode === 'once') {
      if (lastIndex) {
        WARN('Found match ['+lastIndex+'], stopping search because repeatMode=once');
        GRCLOSE();
        break;
      } else {
        WARN('No match ['+lastIndex+']['+repeatMode+']');
        ++index;
      }
    } else if (repeatMode === 'after') {
      if (index === lastIndex) {
        WARN('No match ['+lastIndex+']['+repeatMode+']');
        ++index;
      } else {
        WARN('Found match ['+lastIndex+'], jumping to after match because repeatMode=after');
        index = lastIndex + 1;
      }
    } else if (repeatMode === 'every') {
      if (lastIndex) WARN('Found match ['+lastIndex+'], starting with next token because repeatMode='+repeatMode);
      else WARN('No match ['+lastIndex+']['+repeatMode+']');
      ++index;
    } else {
      throw 'unknown repeatMode: '+repeatMode;
    }
    GRCLOSE();
  }
  GRCLOSE();
}

function compile(queryCode, tokens, repeatMode, _copiedInput) {
//  LOG(queryCode);

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

  function is(str) {
    LOG('is(): %o === %o -> %o', str, value(0), value(0) === str);
    return str === value(0);
  }
  function isi(str) {
    var a = String(str).toLowerCase();
    var b = String(value(0)).toLowerCase();
    LOG('isi(): %o === %o -> %o', a, b, b === a);
    return a === b;
  }
  function value(delta) {
    var target = index + (delta|0);
    LOG('value('+delta+'): copied=%o, target=%o', !!_copiedInput, target + '/' + (tokens.length-1), '->', (_copiedInput ? _copiedInput[target] : tokens[target]));
    if (_copiedInput) return _copiedInput[target] || '';
    var t = tokens[target];
    return t && t.value || '';
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
    var v = value(delta);
    return v === '\x0A' || v === '\x0D' || v === '\x0A\x0D' || v === '\u2028' || v === '\u2029';
  }
  function isSpaceTabComment() {
    var c = tokens[index];
    var v = value(0);
    // TOFIX: better comment handling... this is crap and very non-generic.
    // TOFIX: find generic solution to do stuff like ASI here as well.
    var ASI = 15;
    return v === ' ' || v === '\t' || (v[0] === '/' && (v[1] === '/' || v[1] === '*') || c.type === ASI);
  }
  function next() { // unless EOF always consumes at least one token
    if (index < tokens.length) LOG('(next)', index, '->', index+1, tokens[index+1]), ++index;
  }
  function consumeToBlack() { // only consumes if current is white
    LOG('consumeToBlack() (move to next black token if not already)');
    if (isWhite()) {
//      if (from === index) return false; // wait till first token is black before actually matching
      skipOneThenUpToNextBlack();
    }
    return !isWhite();
  }
  function isWhite() {
    var t = tokens[index];
    return t && (t.type === WHITE || t.type === EOF);
  }
  function skipTo(newIndex) {
    index = newIndex;
    return true;
  }
  function skipOneThenUpToNextBlack() { // unless EOF always consumes at least one token
    var t = tokens[index];
    do LOG('(skipOneThenUpToNextBlack)', index, '->', index+1, tokens[index+1]), ++index;
    while (isWhite() && t && t.type !== EOF);
  }
  function rewindToBlack() { // move back the pointer until it points to a black token (may not move at all)
    LOG('rewindToBlack', index);
    while (isWhite() && index) {
      --index;
    }
    LOG('- to', index, tokens[index]);
  }

  function symw() {
    GROPEN('white token', argStack.slice(0), 'index='+index, tokens[index]);
    updateSymbStarts();
    symbolStarts.push(index);
    if (argStack.length === 0) argStack.push('0', index); // set default 0 key to first black
    tokensMatched.push(index);
    return true;
  }
  function checkTokenWhite(matches, startKey, stopKey, loopCount, repeatedCall, minCall) {
    var s = symbolStarts.pop();
    LOG('## checkTokenWhite: matches='+!!matches+', loopCount='+loopCount);
    if (matches) {
      next();
      queueArgs(s, startKey, stopKey, loopCount);
      queueRepeatCalls(repeatedCall, startKey, s);
    }
    if (!matches || loopCount === 0) {
      tokensMatched.pop();
    }
    LOG('argStack:', argStack.slice(0));
    LOG('tokensMatched:', tokensMatched.slice(0));
    GRCLOSE();
    return matches;
  }

  function symb() {
    GROPEN('black token', argStack.slice(0), tokens[index]);
    if (!consumeToBlack()) return false;
    updateSymbStarts();
    symbolStarts.push(index);
    if (argStack.length === 0) argStack.push('0', index); // set default 0 key to first black
    tokensMatched.push(index);
    return true;
  }
  function checkTokenBlack(matches, startKey, stopKey, loopCount, repeatedCall, minCall) {
    var s = symbolStarts.pop();
    LOG('## checkTokenBlack: matches='+!!matches+', loopCount='+loopCount);
    if (matches) {
      next();
      queueArgs(s, startKey, stopKey, loopCount);
      queueRepeatCalls(repeatedCall, startKey, s);
    }
    if (!matches || loopCount === 0) {
      tokensMatched.pop();
    }
    LOG('argStack:', argStack.slice(0));
    LOG('tokensMatched:', tokensMatched.slice(0));
    GRCLOSE();
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
    GROPEN('token group start', tokens[index]);
  }
  function checkTokenGroup(matches, consumed, startKey, stopKey, loopCount, repeatedCall, minCall) {
    var s = symbolStarts.pop();
    var argPointer = argPointers.pop();
    if (argStack.length < argPointer) WARN('assertion fail: arg stack is smaller than at start of group');
    var callPointer = callPointers.pop();
    if (callPointers.length < callPointer) WARN('assertion fail: call stack is smaller than at start of group');
    LOG('## checkTokenGroup: matches='+!!matches)
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
    LOG('argStack:', argStack.slice(0));
    LOG('tokensMatched:', tokensMatched.slice(0));
    GRCLOSE();
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

    var args = {length:0}; // fake array, may be passed on as is if there are any non-int keys. // TOFIX: improve perf here. we can do better than this :)

    var intsOnly = true;
    while (theseArgs.length) {
      // last recorded value for a key wins, process stack bottom to top (shift vs pop)
      var key = theseArgs.shift();
      var value = theseArgs.shift();
      if (intsOnly) {
        var n = parseInt(key, 10);
        intsOnly = String(key) === String(n);
        if (intsOnly) args.length = Math.max(n+1, args.length);
        else delete args.length; // allows for a user to call its arg `length` (I suppose not a rare case)
      }

      // set afterwards because of the `length` case
      args[key] = token(Math.min(tokens.length-1, Math.max(0, value)));
    }

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
    LOG('queueEarlyCall('+name+')');
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

    var explicitTrue = false;

    var returnValue = true;
    if (matched) {
      LOG('Queue implicit match call?', tokensMatched.slice(0),'->',tokensMatched[tokensMatched.length-1] !== EARLY_CALL);
      if (tokensMatched[tokensMatched.length-1] !== EARLY_CALL) {
        queueCall(argStack.slice(0));
      }

      callStack.forEach(function(args){
        // TOFIX: %
        var args = flushArgs(args); // may return null

        // if the handler returns `true`, the next match should start on the same index regardless
        if (!args) {
          if (handler(token(start)) === true) explicitTrue = true;
        } else if (nonIntKeys) {
          if (handler(args) === true) explicitTrue = true;
        } else {
          if (handler.apply(undefined, args) === true) explicitTrue = true;
        }
      });

      // last token evaluated by query
      if (repeatMode === 'after') returnValue = Math.max(start, index - 1);
    } else {
      // continue as usual
      if (repeatMode === 'after') returnValue = start;
      else returnValue = false;
    }

    argStack.length = 0;
    callStack.length = 0;
    tokensMatched.length = 0;

    if (explicitTrue) return true;
    if (repeatMode === 'once' || repeatMode === 'after' || repeatMode === 'every') return returnValue;
    throw 'unknown repeatMode: '+repeatMode;
  }
}
