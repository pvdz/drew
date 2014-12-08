module.exports = parse;

// TODO: drop `length` from args object as soon as we encounter one non-int key

function parse(query, hardcoded, macros) {
  var DEBUG = true;

  var pos = 0;
  var inputQuery = query;
  var lastAtomStart = 0;

  var TOPLEVEL = true;
  var NOT_TOPLEVEL = false;
  var INSIDE_TOKEN = true;
  var OUTSIDE_TOKEN = false;

  var counter = 0;
  var tokenCounter = 0;
  var logCounter = 1000;

  function white(c) {
    return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\r\n';
  }

  function consume() {
    var c = query[pos++];

    while (white(query[pos])) ++pos;

    return c;
  }
  function peek(c) {
    var d = query[pos];
    if (c) return c === d;
    return d;
  }
  function assert(c) {
    if (c !== query[pos]) reject('fail, expecting ['+c+'] at ['+pos+'] in ['+query+'], found ['+query[pos]+']');
    consume();
  }
  function reject(m){
    throw new Error(m);
  }

  function parseQuery() {
    var currentGroup = counter++;
    var s = 'var group'+currentGroup+' = false;\n';
    if (DEBUG) s += 'console.group("root start");\n';
    do {
      s += toplevelPart(currentGroup);

      if (peek('|')) {
        consume();
        if (DEBUG) s += 'console.groupEnd();\n';
        if (DEBUG) s += 'console.group("root OR start");\n';
        if (DEBUG) s += 'if (group'+currentGroup+') console.log("Last part matched, no need to check rest");\n';
        // previous part did not match so we basically start from scratch
        s += 'if (!group'+currentGroup+
          ' && !void(tokensMatched.length = 0)' +
          ' && !void(callStack.length = 0)' +
          ' && !void(argStack.length = 0)' +
        ') ';
      } else {
        break;
      }
    } while(true);
    if (DEBUG) s += 'console.groupEnd();\n';

    return s;
  }

  function toplevelPart(currentGroup) {
    var s = '';
    var atom;
    var first = true;
    while (atom = parseAtomMaybe(TOPLEVEL, OUTSIDE_TOKEN, currentGroup, first)) {
      if (atom) {
        if (!first) s += 'if (group0) ';
        s += atom + '\n';
        first = false;
      }
    }

    return s;
  }

  function parseAtoms() {
    var s = '';
    return s;
  }

  function parseAtomMaybe(top, insideToken, tokenGroupNumber, noCurlies, invert){
    lastAtomStart = pos;
    var currentCounter = counter++;

    var beforeQuantifier = '';
    var afterQuantifier = '';
    var result;

    if (peek('[')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      if (noCurlies) beforeQuantifier += '{ // parseAtomMaybe '+currentCounter+' for white token [\n';
      beforeQuantifier += '// white token '+currentCounter+':'+(tokenCounter++)+'\n';
      beforeQuantifier += 'group'+tokenGroupNumber+' = checkTokenWhite(symw()' + parseWhiteToken();

      afterQuantifier += ');\n';
      if (noCurlies) afterQuantifier += '} // ] '+currentCounter+' for white token\n';

      result = parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter);
    } else if (peek('{')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      if (noCurlies) beforeQuantifier += '{ // parseAtomMaybe '+currentCounter+' for black token {\n';
      beforeQuantifier += '// black token '+currentCounter+':'+(tokenCounter++)+'\n';
      beforeQuantifier += 'group'+tokenGroupNumber+' = checkTokenBlack(symb()' + parseBlackToken();

      afterQuantifier += ');\n';
      if (noCurlies) afterQuantifier += '} // } '+currentCounter+' for black token\n';

      result = parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter);
    } else if (peek('(')) {
      if (insideToken) {
        beforeQuantifier += ' && ' + (invert ? '!' : '') + 'checkConditionGroup(symgc()' + parseGroup(INSIDE_TOKEN) + ')';

        result = parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter, insideToken);
      } else {
        beforeQuantifier += '{ // parseAtomMaybe ' + currentCounter + ' for token group (\n';
        beforeQuantifier += '// start group ' + currentCounter + '\n';
        beforeQuantifier += 'var group' + currentCounter + ' = false;\n';
        beforeQuantifier += 'var groupStart' + currentCounter + ' = index;\n';
        beforeQuantifier += 'symgt(); // ' + currentCounter + '\n';
        beforeQuantifier += parseGroup(OUTSIDE_TOKEN, currentCounter);
        beforeQuantifier += 'checkTokenGroup(';
        beforeQuantifier += 'group' + currentCounter;
        beforeQuantifier += ', index - groupStart' + currentCounter;

        afterQuantifier += ');\n';
        afterQuantifier += 'if (!group' + currentCounter + ') index = groupStart' + currentCounter + ';\n';
        afterQuantifier += 'group' + tokenGroupNumber + ' = group' + currentCounter + '\n';
        afterQuantifier += '// end group ' + currentCounter + '\n';
        afterQuantifier += '} // ) ' + currentCounter + ' for token group\n';

        var ALWAYS_FILL_PARAMS = true;
        result = parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter);
      }
    } else if (peek('#')) {
      if (insideToken) reject('Cannot trigger early callback inside a token');

      var id = parseDesignator();
      if (!id) id = 0;

      parseColonComment();

      result = 'queueEarlyCall("'+id+'");\n';
    } else {
      return false;
    }

    return result;
  }

  function parseWhiteToken() {
    assert('[');
    var s = parseMatchConditions(INSIDE_TOKEN);
    assert(']');
    return s;
  }
  function parseBlackToken() {
    assert('{');
    var s = parseMatchConditions(INSIDE_TOKEN);
    assert('}');
    return s;
  }
  function parseGroup(insideToken, tokenGroupIndex) {
    assert('(');
    var s = '';
    if (!insideToken) s += 'tokensMatchGroupPointers.push(tokensMatched.length);\n';
    var startOfChain = 1;
    while (true) {
      if (peek(')')) break;
      else if (peek('[')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if (group'+tokenGroupIndex+') ';
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, startOfChain);
      } else if (peek('{')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if (group'+tokenGroupIndex+') ';
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, startOfChain);
      } else if (peek('(')) {
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex);
      } else if (peek('|')) {
        consume();
        if (insideToken) reject('Expecting ors to be caught in parseMatchConditions');
        startOfChain = 2; // first is immediately dec'ed, 2 makes sure it survives one loop
        if (!insideToken) {
          s += 'if (!group'+tokenGroupIndex+') {\n' +
            // reset stacks to the start of group state
            '  tokensMatched.length = tokensMatchGroupPointers[tokensMatchGroupPointers.length-1];\n' +
            '  callStack.length = callPointers[callPointers.length-1];\n' +
            '  argStack.length = argPointers[argPointers.length-1];\n' +
          '}\n';
        }
        s += 'if (!group'+tokenGroupIndex+') ';
      } else if (peek('&')) {
        consume();
        if (insideToken) reject('Expecting ands to be caught in parseMatchConditions');
        else reject('No need to put & between tokens (just omit them), only allowed between match conditions');
      } else {
//        if (!insideToken) s += 'group'+tokenGroupIndex+' = (group'+tokenGroupIndex;
        s += parseMatchConditions(insideToken, tokenGroupIndex);
//        if (!insideToken) s += ');\n'; // not sure about this...
      }
      if (startOfChain) startOfChain--;
    }
    if (!insideToken) s += 'if (!group'+tokenGroupIndex+') tokensMatched.length = tokensMatchGroupPointers.pop();\n';
    if (!insideToken) s += 'else tokensMatchGroupPointers.pop();\n';

    assert(')');
    return s;
  }

  function parseMatchConditions(insideToken, tokenGroupIndex, invert){
    var s = parseMatchParticle(insideToken, tokenGroupIndex, invert);
    while (peek('|') || peek('&')) {
      var d = consume();

      s = ' && (true' + s + ' ' + d + d + ' (true' + parseMatchParticle(insideToken, tokenGroupIndex) + '))';
    }

    return s;
  }

  function parseMatchParticle(insideToken, tokenGroupIndex, invert) {
    if (peek('!')) {
      assert('!');
      invert = !invert;
    }
    if (peek('`')) {
      if (!insideToken) reject('Trying to parse a literal while not inside a tag');
      return parseLiteral(invert);
    }
    if (peek('*')) {
      if (!insideToken) reject('Unit test: inconsistent; is this star a quantifier or condition?');
      return parseStarCondition(invert);
    }
    if (peek('(')) {
      return parseAtomMaybe(NOT_TOPLEVEL, insideToken, undefined, undefined, invert);
    }
    var peeked = peek();
    if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked === '$' || peeked === '_')) {
      return parseSymbol(insideToken, tokenGroupIndex, invert);
    }
    if (pos >= query.length) {
      return true;
    }

    reject(new Error('Unexpected state [index='+pos+'][peek='+peek()+'][query='+query+']'));
  }

  function parseLiteral(invert) {
    // take care with consume() in this function; it skips whitespace, even in literals.
    ++pos; // dont consume (skips whites)
    var s = '';
    var protection = 100000;
    while (--protection > 0) {
      var peeked = peek();
      if (peeked === '`') break;

      if (peeked === '\\') {
        s += query[pos++];

        if (query[pos+1].toLowerCase() === 'u') {
          var a = query[pos+2].toLowerCase();
          if ((a < '0' || a > '9') && (a < 'a' || a > 'f')) reject('Unicode escape must be 0-9a-f, was ['+a+']');
          var b = query[pos+3].toLowerCase();
          if ((b < '0' || b > '9') && (b < 'a' || b > 'f')) reject('Unicode escape must be 0-9a-f, was ['+b+']');
          var c = query[pos+4].toLowerCase();
          if ((c < '0' || c > '9') && (c < 'a' || c > 'f')) reject('Unicode escape must be 0-9a-f, was ['+c+']');
          var d = query[pos+5].toLowerCase();
          if ((d < '0' || d > '9') && (d < 'a' || d > 'f')) reject('Unicode escape must be 0-9a-f, was ['+d+']');

          s += 'u'+a+b+c+d;
        } else if (query[pos+1].toLowerCase() === 'x') {
          var a = query[pos+2].toLowerCase();
          if ((a < '0' || a > '9') && (a < 'a' || a > 'f')) reject('Unicode escape must be 0-9a-f, was ['+a+']');
          var b = query[pos+3].toLowerCase();
          if ((b < '0' || b > '9') && (b < 'a' || b > 'f')) reject('Unicode escape must be 0-9a-f, was ['+b+']');

          s += 'x'+a+b;
        } else {
          s += query[pos++];
        }
      } else {
        s += query[pos++];
      }
    }
    if (protection <= 0) {debugger; throw 'loop protection'; }
    assert('`');

    var r = s.replace(/'/g, '\\\'');
    var t = ' && '+(invert?'!':'')+'value(\'' + r + '\')';

    var q = '';
    if (DEBUG) q = ' && !void console.log("# '+(++logCounter)+' start of literal [`'+ r.replace(/"/g,'\"')+'`] at '+pos+' in query to token "+index+":", token())';

    return q + t;
  }

  function parseStarCondition(invert) {
    assert('*');

    return ' && '+(invert?'':'!')+'!token()';
  }

  function parseSymbol(insideToken, tokenGroupIndex, invert) {
    var start = pos;
    var s = consume();

    while (true) {
      var peeked = peek();
      if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_') {
        s += consume();
      }
      else break;
    }

    var t = '';
    if (DEBUG && insideToken) t += ' && !void ';
    if (DEBUG) t += 'console.log("# '+(++logCounter)+' start of symbol ['+ s.replace(/"/g,'\"')+'] at '+pos+' in query to token "+index+":", token())';
    if (DEBUG && !insideToken) t += ';\n';

    if (hardcoded[s]) {
      if (insideToken) t += ' && ';
      else t += 'if (!group'+tokenGroupIndex+') group1 = ';
      t += (invert?'!':'') + '('+hardcoded[s]+')';
      if (DEBUG && !insideToken) t += ';\n';
      return t;
    } // TOFIX: detect token state and report?
    if (macros[s]) {
      t += injectMacro(macros[s], start, pos, insideToken, tokenGroupIndex, invert);
      return t;
    }

    reject('Unknown constant: ['+s+']');
  }

  function parseAssignments(forced) {
    // forced -> must always return two params, use undefined if a param is not requested
    var assignmentString = '';
    if (peek('=')) {
      assert('='); // take =, skip whitespace

      if (peek(',')) { // [foo]=,1
        assignmentString += ', undefined';
      } else {
        assignmentString += parseAssignmentKey();
        parseColonComment();
      }

      if (peek() === ',') {
        assert(',');
        assignmentString += parseAssignmentKey();
        parseColonComment();
      } else if (forced) {
        assignmentString += ', undefined';
      }
    } else if (forced) {
      assignmentString += ', undefined, undefined';
    }

    return assignmentString;
  }
  function parseColonComment() {
    if (peek(':')) {
      assert(':');
      var consumed = false;
      var peeked = peek();
      // whitespace is done implicitly by consume...
      while ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_' || peeked === '$' || peeked === '-') {
        consume();
        consumed = true;
        peeked = peek();
      }
      if (!consumed) reject('Colon comment must contain at least some comment...');
    }
  }
  function parseAssignmentKey() {
    var name = parseDesignator();
    if (!name) reject('Missing valid var name after equal sign');
    return ', \'' + name + '\'';
  }
  function parseDesignator() {
    var name = '';
    while (true) {
      var peeked = query[pos];
      if (peeked && (peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_') {
        name += peeked;
        ++pos;
      }
      else break;
    }
    // skip whitespace after name...
    --pos;
    consume();

    return name;
  }

  function injectMacro(macro, from, to, insideToken, tokenGroupIndex, invert) {
    // remove lastAtomStart...pos and replace it with macro
    // then reset pos and parse atom again
    var s = '';

    query = query.slice(0, from) + macro + query.slice(to);
    if (DEBUG) console.warn('Extrapolated query:', query);
    pos = from;
    if (peek('[') || peek('{') || peek('(')) return s + parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, undefined, invert);
    return s + parseMatchConditions(insideToken, tokenGroupIndex, invert);
  }

  function parseQuantifiers(beforeAssignments, afterAssignments, tokenGroupNumber, currentCounter, insideToken) {
    // [foo] 1
    // [foo] 1...
    // [foo] 1..2

    var FORCE_PARAMFILL = true;

    var min = 0;
    var max = 0; // 0=infinite upper bound

    var peeked = peek();

    if (peeked === '+') {
      min = 1;
      consume();
    } else if (peeked === '?') {
      max = 1;
      consume();
    } else if (peeked === '*') {
      // 0:0 is good.
      consume();
    } else if (peeked === undefined) {
      // EOF
      return beforeAssignments + parseAssignments() + afterAssignments;
    } else if (peeked < '0' || peeked > '9') {
      // no quantifier. dont wrap string.
      return beforeAssignments + parseAssignments() + afterAssignments;
    } else {
      min = parseNumbers();

      if (!peek('.')) {
        max = min;
      } else {
        // note: this allows the dots to be spaced, but who cares. this doesn't allow ambiguity and I couldnt care less.
        assert('.');
        assert('.');
        peeked = peek();
        if (peeked === '.') {
          assert('.');
          max = 0;
        } else if (peeked < '0' || peeked > '9') {
          reject('expecting number after double dot');
        } else {
          max = parseNumbers();
        }
      }
    }

    if (insideToken) {
      throw 'Parse error: found quantifier for non-token or non-token-group. You can only quantify tokens.';
    }

    var NORMAL_CALL = 0;
    var REPEAT_CALL = 1;
    var COLLECT_CALL = 2;

    var callbackMode = NORMAL_CALL;

    // quantifier callback modifiers
    if (peek('@')) {
      assert('@');
      // match for each individual (repeated) match
      callbackMode = REPEAT_CALL;
    } else if (peek('%')) {
      assert('%');
      // pass on start/end tokens for each match in an array
      // either one array as pairs if only one var assignment
      // or starts in start and stops in stop parameter if two
      callbackMode = COLLECT_CALL;
    }

    var innerCounter = counter++;

    var result =
      '{ // parseQuantifiers '+currentCounter+':'+tokenGroupNumber+'\n' +
        'var loopProtection'+currentCounter+' = 10000;\n' +
        'var min'+currentCounter+' = '+min+';\n' +
        'var max'+currentCounter+' = '+max+';\n' +
        'var count'+currentCounter+' = 0;\n' +
        'var startIndex'+currentCounter+' = index;\n' +
        'do { // parseQuantifiers '+currentCounter+':'+tokenGroupNumber+'\n' +
        '  var startIndex'+innerCounter+' = index;\n' +
          beforeAssignments +
            parseAssignments(FORCE_PARAMFILL) +
            ', count'+currentCounter+'+1' +
            ', ' + callbackMode +
            ', min'+currentCounter +
          afterAssignments +
          // restore index if this group did not match ("backtracking")
        '  if (!group'+tokenGroupNumber+') index = startIndex'+innerCounter+';\n' +
        '} while(group'+tokenGroupNumber+' && --loopProtection'+currentCounter+' > 0 && (++count'+currentCounter+' < max'+currentCounter+' || !max'+currentCounter+'));\n' +
        'if (loopProtection'+currentCounter+' <= 0) throw "Loop protection!";\n' +
        // only check lower bound since upper bound is forced by the loop condition (`s` will override current value of group, but it was true at the start of the loop)
        'group'+tokenGroupNumber+' = count'+currentCounter+' >= min'+currentCounter+';\n' +
        'if (!group'+tokenGroupNumber+') index = startIndex'+currentCounter+';\n' +
      '}\n' +
      '';

    return result;
  }
  function parseNumbers() {
    var s = '';
    var p = query[pos];
    while (p >= '0' && p <= '9') {
      s += p;
      p = query[++pos];
    }
    --pos;
    consume();

    return parseInt(s, 10);
  }

  if (DEBUG) console.warn('Parsing query   :', query);
  var code = parseQuery();

  return (
    'function query(){\n'+
    '  // input query: '+inputQuery+'\n' +
    '  // final query: '+query+'\n' +
//  '  if(index===2)debugger;'+
    '  // query start..\n' +
       code+'\n' +
    '  // query end..\n' +
//  '  if(index===0)debugger;'+
    '  return group0;\n' +
    '}\n'
    );
}
