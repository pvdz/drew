module.exports = parse;

// TODO: drop `length` from args object as soon as we encounter one non-int key

var VERBOSE = true;
function parse(query, hardcoded, macros) {
  var pos = 0;
  var inputQuery = query;
  var lastAtomStart = 0;

  var TOPLEVEL = true;
  var NOT_TOPLEVEL = false;
  var INSIDE_TOKEN = true;
  var OUTSIDE_TOKEN = false;
  var OPTIONAL = true;

  var counter = 0;
  var tokenCounter = 0;
  var logCounter = 1000;

  function LOG(){ if (VERBOSE) console.log.apply(console, arguments); }
  function WARN(){ if (VERBOSE) console.warn.apply(console, arguments); }
  function ERROR(){ if (VERBOSE) console.error.apply(console, arguments); }
  function GROPEN(){ if (VERBOSE) console.group.apply(console, arguments); }
  function GRCLOSE(){ if (VERBOSE) console.groupEnd.apply(console, arguments); }

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
  function over(c) {
    var d = query[pos+1];
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
    s += 'matchedSomething = false;\n';
    if (VERBOSE) s += 'GROPEN("root start");\n';
    s += '{\n'; // this way we can close and open a bracket when we encounter a | and dont worry about brackets in result.
    do {
      s += parseTopLevelAtom(currentGroup);

      if (peek('|')) {
        consume();
        if (VERBOSE) s += 'GRCLOSE();\n';
        s += '}\n';
        s += 'if (group'+currentGroup+') {\n';
        if (VERBOSE) s += 'LOG("Last part of top level matched, no need to check rest after OR");\n';
        s += '} else {\n';
        if (VERBOSE) s += 'GROPEN("root OR start");\n';
        s += 'matchedSomething = false;\n';
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
    if (VERBOSE) s += 'GRCLOSE();\n';
    s += '}\n';

    return s;
  }

  function parseTopLevelAtom(currentGroup) {
    var s = '';
    var atom;
    var first = true;
    var n = 0;
    while (atom = parseAtomMaybe(TOPLEVEL, OUTSIDE_TOKEN, currentGroup, first)) {
      ++n;
      s += atom + '\n';
      first = false;
    }

    return s;
  }

  function parseAtoms() {
    var s = '';
    return s;
  }

  function parseAtomMaybe(top, insideToken, tokenGroupNumber, isTopLevelStart, invert){
    lastAtomStart = pos;
    var currentCounter = counter++;

    var beforeQuantifier = '';
    var afterQuantifier = '';
    var result = '\n//#parseAtomMaybe\n';

    if (!isTopLevelStart && !insideToken) result += 'if (group'+tokenGroupNumber+') // parseAtomMaybe, not first on top level query\n';

    if (peek('[')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      if (isTopLevelStart) beforeQuantifier += '{ // parseAtomMaybe '+currentCounter+' for a white token `[`\n';
      beforeQuantifier += '// white token '+currentCounter+':'+(tokenCounter++)+'\n';
      beforeQuantifier += 'group'+tokenGroupNumber+' = checkTokenWhite(symw()' + parseWhiteToken();

      afterQuantifier += ');\n';
      if (isTopLevelStart) afterQuantifier += '} // `]` '+currentCounter+' for a white token\n';

      result += (insideToken?'&&':'{\n') + '(matchedSomething = true)' + (insideToken?'':';\n');
      result += parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter);
      result += (insideToken?'':'}\n');
    } else if (peek('{')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      if (isTopLevelStart) beforeQuantifier += '{ // parseAtomMaybe '+currentCounter+' for black token `{`\n';
      beforeQuantifier += '// black token '+currentCounter+':'+(tokenCounter++)+'\n';
      beforeQuantifier += 'group'+tokenGroupNumber+' = checkTokenBlack(symb()' + parseBlackToken();

      afterQuantifier += ');\n';
      if (isTopLevelStart) afterQuantifier += '} // `}` '+currentCounter+' for black token\n';

      result += (insideToken?'&&':'{\n') + '(matchedSomething = true)' + (insideToken?'':';\n');
      result += parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter);
      result += (insideToken?'':'}\n');
    } else if (peek('(')) {
      if (insideToken) {
        beforeQuantifier += ' && ' + (invert ? '!' : '') + 'checkConditionGroup(symgc()' + parseGroup(INSIDE_TOKEN, tokenGroupNumber, false) + ')';

        result += (insideToken?'&&':'{\n') + '(matchedSomething = true)' + (insideToken?'':';\n');
        result += parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter, insideToken);
        result += (insideToken?'':'}\n');
      } else {

        beforeQuantifier += '{ // parseAtomMaybe ' + currentCounter + ' for a token group `(`\n';
        beforeQuantifier += '// start group ' + currentCounter + '\n';
        beforeQuantifier += 'var group' + currentCounter + ' = true;\n'; // inside a group, init to true
        beforeQuantifier += 'var groupStart' + currentCounter + ' = index;\n';
        beforeQuantifier += 'symgt(); // ' + currentCounter + '\n';
        beforeQuantifier += parseGroup(OUTSIDE_TOKEN, currentCounter, isTopLevelStart);
        beforeQuantifier += 'checkTokenGroup(';
        beforeQuantifier += 'group' + currentCounter;
        beforeQuantifier += ', index - groupStart' + currentCounter;

        afterQuantifier += ');\n';
        afterQuantifier += 'if (!group' + currentCounter + ') index = groupStart' + currentCounter + ';\n';
        afterQuantifier += 'group' + tokenGroupNumber + ' = group' + currentCounter + '\n';
        afterQuantifier += '// end group ' + currentCounter + '\n';
        afterQuantifier += '} // `)` ' + currentCounter + ' for token group\n';

        result += parseQuantifiers(beforeQuantifier, afterQuantifier, tokenGroupNumber, currentCounter);
      }
    } else if (peek('#')) {
      assert('#');
      if (insideToken) reject('Cannot trigger early callback inside a token');

      var id = parseDesignator();
      if (!id) id = 0;

      parseColonComment();

      result = 'queueEarlyCall("' + id + '");\n';
    } else {

      // at this point it must be a top level ^ ^^ $ $$ or ~, or nothing.
      var r = parseLineStuff(insideToken, tokenGroupNumber, OPTIONAL);
      return r ? result + r : r;
    }

    result += '// parseAtomMaybe end\n';
    return result;
  }

  function parseLineStuff(insideToken, tokenGroupNumber, optional) {
    var result = '';

    if (peek('~')) {
      assert('~');
      if (insideToken) reject('Tilde (~) only allowed outside of tokens');

      result +=
        '{\n'+
        '  '+
        // note: before matching anything we wont seek and prevent the whole query preemptively
        '// dont seek for leading ~, just wait for a non-spacy token\n'+
        'if (' +
        'GROPEN("~ seek"),'+
        'LOG("~ seek() past spaces and tabs at all?", "matchedSomething=", matchedSomething, "start=", index),'+
        'matchedSomething) {\n' +
          '  '+
          'if (isSpaceTabComment()) {\n'+
            '    '+
            'LOG("~ skipping spaces and tabs");\n'+
            '    '+
            'do LOG("skipping", tokens[index]),++index;\n' +
            '    '+
            'while (isSpaceTabComment());'+
            ' // ~' +
            '\n'+
          '  '+
          '}\n'+
          '  ' +
          'LOG(group'+tokenGroupNumber+'?"~ passed":"~ failed", "index="+index);\n'+
          'GRCLOSE();\n'+
        '}\n'+
        'else GRCLOSE();\n' +
        'group'+tokenGroupNumber+' = true; // the ~ seek passes regardless, there is no valid condition for failing\n'+
        '}\n'+
      '';
    } else if (peek('^')) {
      // start of line, or start of file if another ^ follows
      if (insideToken) reject('Caret (^) only allowed outside of tokens');
      result += '{\n';
      result += 'GROPEN("^ or ^^");\n';
      if (over('^')) { // no space between
        assert('^');
        assert('^');
        result += 'LOG("^^ start of file?", !index);';
        result += 'group' + tokenGroupNumber + ' = !index;';
        result += ' // ^^\n';
      } else {
        assert('^');
        result += 'LOG("^ start of line?", !index, index && isNewline(-1), "->", !index || isNewline(-1));\n';
        result += 'group' + tokenGroupNumber + ' = (!index || isNewline(-1));';
        result += ' // ^\n';
      }
      result += '(matchedSomething = true);\n';
      result += 'GRCLOSE();\n';
      result += '}\n';
    } else if (peek('$')) {
      // end of line, or end of file if another $ follows
      if (insideToken) reject('Dollar ($) only allowed outside of tokens');
      result += '{\n';
      result += 'GROPEN("$ or $$");\n';
      if (over('$')) { // no space between
        assert('$');
        assert('$');
        result += 'LOG(tokens[index]);\n';
        result += 'LOG("$$ end of file?", index, ">=", tokens.length-1, "->", index >= tokens.length-1);\n';
        // TOFIX: we need to improve the EOF check. this will crap out generically
        result += 'group' + tokenGroupNumber + ' = index >= tokens.length-1;';
        result += ' // $$\n'
      } else {
        assert('$');
        result += 'LOG("$ end of line?", "eol=", index < tokens.length-1 && isNewline(0), "eof=", index >= tokens.length-1);\n';
        result += '(group' + tokenGroupNumber + ' = (index >= tokens.length-1 || isNewline(0)));';
        result += ' // $\n';
      }
      result += '(matchedSomething = true);\n';
      result += 'GRCLOSE();\n';
      result += '}\n';
    } else if (optional) {
      return false;
    } else {
      throw 'unable to parse line stuff, and it is not optional';
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
  function parseGroup(insideToken, tokenGroupIndex, first) {
    assert('(');
    var s = '';
    s += '// parseGroup, first='+first+'\n';
    if (!insideToken) {
      s += '{\n'; // for the |
      s += 'group' + tokenGroupIndex + ' = true;\n'; // init to true for group
      s += 'tokensMatchGroupPointers.push(tokensMatched.length); // parseGroup; store pointer to current matches so we can drop new matches in case the group fails\n';
    }
    var startOfChain = 1;
    var noLongerFirst = first; // "pointer" so we can reset to initial value when we encounter a pipe...
    while (true) {
      if (peek(')')) break;
      else if (peek('[')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if (group'+tokenGroupIndex+')\n';
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, noLongerFirst);
        noLongerFirst = false;
      } else if (peek('{')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if (group'+tokenGroupIndex+')\n';
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, noLongerFirst);
        noLongerFirst = false;
      } else if (peek('(')) {
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, noLongerFirst);
        noLongerFirst = false;
      } else if (peek('|')) {
        noLongerFirst = first; // reset to what it was at the call
        assert('|');
        if (insideToken) reject('Expecting ors to be caught in parseMatchConditions');
        startOfChain = 2; // first is immediately dec'ed, 2 makes sure it survives one loop
        s +=
          'GRCLOSE();\n'+
          '}\n'+
          'GROPEN("grouped OR");\n'+
          'if (group'+tokenGroupIndex+') {\n' +
            'LOG("group'+tokenGroupIndex+' passed, skipping OR");\n'+
            'GRCLOSE();\n'+
          '} else {\n'+
          // reset stacks to the start of group state
          '  tokensMatched.length = tokensMatchGroupPointers[tokensMatchGroupPointers.length-1];\n' +
          '  callStack.length = callPointers[callPointers.length-1];\n' +
          '  argStack.length = argPointers[argPointers.length-1];\n' +
          '  group'+tokenGroupIndex+' = true; // init to true because inside a group\n'+
        '';
      } else if (peek('#')) {
        assert('#');
        if (insideToken) reject('Cannot trigger early callback inside a token');

        var id = parseDesignator();
        if (!id) id = 0;

        parseColonComment();

        s += 'queueEarlyCall("' + id + '");\n';
      } else if (peek('&')) {
        assert('&');
        if (insideToken) reject('Expecting ands to be caught in parseMatchConditions');
        else reject('No need to put & between tokens (just omit them), only allowed between match conditions');
      } else {

        var linestuff = parseLineStuff(insideToken, tokenGroupIndex, OPTIONAL)

        if (linestuff) {
          s += linestuff;
          noLongerFirst = false;
        } else {
          s += parseMatchConditions(insideToken, tokenGroupIndex);
          noLongerFirst = false; // ?
        }
      }
      if (startOfChain) startOfChain--;
    }
    if (!insideToken) {
      s +=
        'if (!group'+tokenGroupIndex+') tokensMatched.length = tokensMatchGroupPointers.pop();\n'+
        'else tokensMatchGroupPointers.pop();\n'+
        '}\n'+
      '';
    }

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
    var peeked = peek();
    switch (peeked) {
      case '`':
        if (!insideToken) reject('Trying to parse a literal while not inside a tag');
        return parseLiteral(invert);

      case '*':
        if (!insideToken) reject('Unit test: inconsistent; is this star a quantifier or condition?');
        return parseStarCondition(invert);

      case '(':
        return parseAtomMaybe(NOT_TOPLEVEL, insideToken, undefined, undefined, invert);

      case '/':
        if (insideToken) return parseRegex();
    }

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
    var ci = peek('i');
    if (ci) ++pos;

    var r = s.replace(/'/g, '\\\'');
    var t = ' && '+(invert?'!':'')+'is'+(ci?'i':'')+'(\'' + r + '\')';

    var q = '';
    if (VERBOSE) q = ' && !void LOG("# '+(++logCounter)+' start of literal [`%o`] at '+pos+' in query to token "+index+":", "'+ r.replace(/"/g,'\"')+'", token())';

    return q + t;
  }
  function parseRegex() {
    // take care with consume() in this function; it skips whitespace, even in literals.
    // we only need to parse a regex-ish token, we dont need to validate it
    // to this purpose we will parse escapes as always escaping a single character
    // the rationale is that even if they are a unicode escape, we dont have to
    // care about that. this leaves the "class" construction, which should just
    // be a double backslash anyways so i'll ignore that too. that makes this
    // pretty easy :)

    var start = pos;
    while (++pos < query.length && query[pos] !== '/') {
      if (query[pos] === '\\') ++pos; // just skip a char. dont care.
    }
    var regex = query.slice(start+1, pos);
    ++pos; // skip forward slash
    var ci = peek('i');
    if (ci) ++pos;
    var regstr = '/'+ regex+'/'+(ci?'i':'');

    var q = '';
    if (VERBOSE) q = ' && !void LOG("# '+(++logCounter)+' start of regex [`%o`] at '+pos+' in query to token "+index+":", '+regstr+', token())';

    return q + "&& "+regstr+".test(value(0))";
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
    if (VERBOSE && insideToken) t += ' && !void ';
    if (VERBOSE) t += 'LOG("# '+(++logCounter)+' start of symbol ['+ s.replace(/"/g,'\"')+'] at '+pos+' in query to token "+index+":", token())';
    if (VERBOSE && !insideToken) t += ';\n';

    if (hardcoded[s]) {
      if (insideToken) t += ' && ';
      else t += 'if (!group'+tokenGroupIndex+') group1 = ';
      t += (invert?'!':'') + '('+hardcoded[s]+')';
      if (VERBOSE && !insideToken) t += ';\n';
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
    if (VERBOSE) WARN('Extrapolated query:', query);
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

  if (VERBOSE) WARN('Parsing query   :', query);
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
