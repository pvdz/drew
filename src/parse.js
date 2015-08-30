module.exports = parse;

// TODO: drop `length` from args object as soon as we encounter one non-int key

var VERBOSE = true;
function parse(query, hardcoded, macros) {
  var pos = 0;
  var inputQuery = query;
  var lastAtomStart = 0;

  var TOPLEVEL_START = true;
  var NOT_TOPLEVEL_START = false;
  var TOPLEVEL = true;
  var NOT_TOPLEVEL = false;
  var INSIDE_TOKEN = true;
  var OUTSIDE_TOKEN = false;
  var OPTIONAL = true;
  var NOT_INVERSE = false;
  var FORCE_PARAMFILL = true;
  var NORMAL_CALL = 0;
  var REPEAT_CALL = 1;
  var COLLECT_CALL = 2;

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

    consumeWhites();

    return c;
  }
  function consumeWhites() {
    while (white(query[pos])) ++pos;
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
    var matchStateNumber = counter++;
    var s = 'var group'+matchStateNumber+' = false;\n';
    s += 'matchedSomething = false;\n';
    if (VERBOSE) s += 'GROPEN("root start");\n';
    s += '{\n'; // this way we can close and open a bracket when we encounter a | and dont worry about brackets in result.
    do {
      s += parseTopLevelAtom(matchStateNumber);

      if (peek('|')) {
        consume();
        if (VERBOSE) s += 'GRCLOSE();\n';
        s += '} // top level, OR\n';

        if (VERBOSE) {
          s += 'if (group' + matchStateNumber + ') LOG("Last part of top level matched, no need to check rest after OR");\n';
        }

        s +=
          '// toplevel OR\n' +
          'if (!group' + matchStateNumber + ') {\n' +
          '  GROPEN("root OR start");\n' +
          '  matchedSomething = false;\n' +
            // previous part did not match so we basically start from scratch
          '  tokensMatched.length = 0;\n' +
          '  callStack.length = 0;\n' +
          '  argStack.length = 0;\n' +
          '';
      } else if (peek('&')) {
        reject('Dont use & in toplevel, it is always implicitly the case');
      } else {
        break;
      }
    } while(true);
    if (VERBOSE) s += 'GRCLOSE();\n';
    s += '} // top level end\n';

    return s;
  }

  function parseTopLevelAtom(matchStateNumber) {
    var s = '// parseTopLevelAtom\n';
    var atom;
    var first = TOPLEVEL_START;
    var n = 0;
    while (atom = parseAtomMaybe(OUTSIDE_TOKEN, matchStateNumber, first)) {
      ++n;
      s += atom + '\n';
      first = NOT_TOPLEVEL_START;
    }

    return s;
  }

  function parseAtoms() {
    var s = '';
    return s;
  }

  function parseAtomMaybe(insideToken, matchStateNumber, isTopLevelStart, invert){
    lastAtomStart = pos;
    var startpos = pos; // for debugging
    var currentCounter = counter++;

    var beforeQuantifier = '';
    var afterQuantifier = '';
    var result = '';

    if (!isTopLevelStart && !insideToken) result += 'if (group'+matchStateNumber+') // parseAtomMaybe, not first on top level query\n';

    if (peek('[')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      result += '// - its a white token\n';
      if (isTopLevelStart) beforeQuantifier += '{ // parseAtomMaybe '+currentCounter+' for a white token `[`\n';
      beforeQuantifier += '// white token '+currentCounter+':'+(tokenCounter++)+'\n';
      beforeQuantifier += 'group'+matchStateNumber+' = checkTokenWhite(symw()' + parseWhiteToken();

      afterQuantifier += ');\n';
      if (isTopLevelStart) afterQuantifier += '} // `]` '+currentCounter+' for a white token\n';

      result += (insideToken?'&& (':'{\n') + 'matchedSomething = true' + (insideToken?')':';\n');
      result += parseQuantifiers(beforeQuantifier, afterQuantifier, matchStateNumber, currentCounter);
      result += (insideToken?'':'}\n');
    } else if (peek('{')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      if (isTopLevelStart) beforeQuantifier += '{ // parseAtomMaybe '+currentCounter+' for black token `{`\n';
      result += '// - its a black token\n';
      beforeQuantifier += '// black token '+currentCounter+':'+(tokenCounter++)+'\n';
      beforeQuantifier += 'group'+matchStateNumber+' = checkTokenBlack(symb()' + parseBlackToken();

      afterQuantifier += ');\n';
      if (isTopLevelStart) afterQuantifier += '} // `}` '+currentCounter+' for black token\n';

      result += (insideToken?'&& (':'{\n') + 'matchedSomething = true' + (insideToken?')':';\n');
      result += parseQuantifiers(beforeQuantifier, afterQuantifier, matchStateNumber, currentCounter);
      result += (insideToken?'':'}\n');
    } else if (peek('(')) {
      if (insideToken) {
        result += '// - its a _nested_ group\n';
        beforeQuantifier += ' && ' + (invert ? '!' : '') + 'checkConditionGroup(symgc()' + parseGroup(INSIDE_TOKEN, matchStateNumber, NOT_TOPLEVEL_START) + ')';

        result += (insideToken?'&& (':'{\n') + 'matchedSomething = true' + (insideToken?')':';\n');
        result += parseQuantifiers(beforeQuantifier, afterQuantifier, matchStateNumber, currentCounter, insideToken);
        result += (insideToken?'':'}\n');
      } else {
        result += '// - its a outer group\n';

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
        afterQuantifier += 'group' + matchStateNumber + ' = group' + currentCounter + '\n';
        afterQuantifier += '// end group ' + currentCounter + '\n';
        afterQuantifier += '} // `)` ' + currentCounter + ' for token group\n';

        result += parseQuantifiers(beforeQuantifier, afterQuantifier, matchStateNumber, currentCounter);
      }
    } else if (peek('#')) {
      result += '// an explicit callback (#)\n';
      assert('#');
      if (insideToken) reject('Cannot trigger early callback inside a token');

      var id = parseDesignator();
      if (!id) id = 0;

      parseColonComment();

      result += 'queueEarlyCall("' + id + '");\n';
    } else {
      // at this point it must be a top level ^ ^^ $ $$ or ~, or nothing.
      var r = parseLineStuff(insideToken, matchStateNumber, isTopLevelStart, OPTIONAL);
      if (!r) return r;
      result += '// - it must be a line start or end or tilde...\n';
      result += r;
    }

    result =
      '\n//#parseAtomMaybe('+insideToken+', '+matchStateNumber+', '+isTopLevelStart+', '+invert+') (parsed `'+query.slice(startpos, pos).replace(/\n/g, '\\n')+'`)\n'+
      result +
      '// parseAtomMaybe end\n';
    return result;
  }

  function parseLineStuff(insideToken, matchStateNumber, isTopLevelStart, optional) {
    var result = '//#parseLineStuff('+insideToken+', '+matchStateNumber+', '+optional+')\n';

    if (peek('~')) {
      assert('~');
      if (insideToken) reject('Tilde (~) only allowed outside of tokens');

      result +=
        '{\n'+
        '  if (matchedSomething) {\n'+
        '    GROPEN("~ seek");\n'+
        injectMacro(macros['~'], pos-1, pos, insideToken, matchStateNumber, isTopLevelStart, NOT_INVERSE)+
        '    GRCLOSE();\n'+
        '  } else {\n'+
        '    LOG("Still at the start of the query so not applying ~");\n'+
        '  }\n'+
        '  group'+matchStateNumber+' = true; // the ~ seek passes regardless, there is no valid condition for failing and otherwise the query can never pass with ~ at the start\n'+
        '}\n'+
      '';
    } else if (peek('>') || peek('<')) {
      var symbol = peek();
      ++pos;

      // dont skip whitespace. this would allow you to explicitly skip white tokens without a number suffix
      var forBlack = peek() === symbol;
      if (forBlack) ++pos;

      consumeWhites();
      var peeked = peek();
      var steps = 1;
      if (peeked >= '0' && peeked <= '9') steps = parseNumbersAsInt();

      if (!steps) reject('Cannot use `'+steps+'`; it is an illegal number for moving the pointer forward');
      result += 'if (matchedSomething) {\n';
      result += 'GROPEN("'+symbol+(forBlack?symbol:'')+' '+steps+'x, start index="+index, tokens[index]);\n';
      if (forBlack) {
        // need to seek explicitly
        if (symbol === '<') { // <<
          result +=
            '// - its a black back skip (>>) for '+steps+'x\n' +
            'for (var i=0; LOG("- <<", index), i<'+steps+'; ++i) {\n' +
            '  --index;\n' + // put against next black token, dont skip if already black
            '  rewindToBlack();\n'+ // now skip the token that must be black
            '  LOG("- >>", tokens[index]);\n'+
            '}\n'+
            'LOG("- >> end pos=", index);\n'+
            '';
        } else { // >>
          result +=
            '// - its a black skip (>>) for '+steps+'x\n' +
            'for (var i=0; LOG("- >>", index), i<'+steps+'; ++i) {\n' +
            '  consumeToBlack();\n' + // put against next black token, dont skip if already black
            '  next();\n'+ // now skip the token that must be black
            '  LOG(tokens[index]);\n'+
            '}\n'+
            'LOG("- >> end pos=", index);\n'+
          '';
        }
      } else {
        // just forward the pointer
        if (symbol === '<') {
          result += '// - its a white back skip (<) for '+steps+'x\n';
          result += 'if (matchedSomething) index = Math.max(index - '+steps+', 0);'
        } else {
          result += '// - its a white skip (>) for '+steps+'x\n';
          result += 'if (matchedSomething) index = Math.min(index + '+steps+', tokens.length);'
        }
      }
      result += 'GRCLOSE();\n';
      result += '}\n';
    } else if (peek('^')) {
      // start of line, or start of file if another ^ follows
      if (insideToken) reject('Caret (^) only allowed outside of tokens');
      result += '{\n';
      result += 'GROPEN("^ or ^^");\n';
      if (over('^')) { // no space between
        assert('^');
        assert('^');
        result += 'LOG("^^ start of file?", !index);';
        result += 'group' + matchStateNumber + ' = !index;';
        result += ' // ^^\n';
      } else {
        assert('^');
        result += 'LOG("^ start of line?", !index, index && isNewline(-1), "->", !index || isNewline(-1));\n';
        result += 'group' + matchStateNumber + ' = (!index || isNewline(-1));';
        result += ' // ^\n';
      }
      result += 'matchedSomething = true;\n';
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
        result += 'group' + matchStateNumber + ' = index >= tokens.length-1;';
        result += ' // $$\n'
      } else {
        assert('$');
        result += 'LOG("$ end of line?", "eol=", index < tokens.length-1 && isNewline(0), "eof=", index >= tokens.length-1);\n';
        result += '(group' + matchStateNumber + ' = (index >= tokens.length-1 || isNewline(0)));';
        result += ' // $\n';
      }
      result += 'matchedSomething = true;\n';
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
  function parseGroup(insideToken, matchStateNumber, first) {
    assert('(');
    var s = '';
    s += '// parseGroup, first='+first+'\n';
    if (!insideToken) {
      s += '{\n'; // for the |
      s += 'group' + matchStateNumber + ' = true;\n'; // init to true for group
      s += 'tokensMatchGroupPointers.push(tokensMatched.length); // parseGroup; store pointer to current matches so we can drop new matches in case the group fails\n';
    }
    var startOfChain = 1;
    var toplevelStartStatus = first; // "pointer" so we can reset to initial value when we encounter a pipe...
    while (true) {
      if (peek(')')) break;
      else if (peek('[')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if (group'+matchStateNumber+')\n';
        s += parseAtomMaybe(insideToken, matchStateNumber, toplevelStartStatus);
        toplevelStartStatus = NOT_TOPLEVEL_START;
      } else if (peek('{')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if (group'+matchStateNumber+')\n';
        s += parseAtomMaybe(insideToken, matchStateNumber, toplevelStartStatus);
        toplevelStartStatus = NOT_TOPLEVEL_START;
      } else if (peek('(')) {
        s += parseAtomMaybe(insideToken, matchStateNumber, toplevelStartStatus);
        toplevelStartStatus = NOT_TOPLEVEL_START;
      } else if (peek('|')) {
        toplevelStartStatus = first; // reset to what it was at the call
        assert('|');
        if (insideToken) reject('Expecting ors to be caught in parseMatchConditions');
        startOfChain = 2; // first is immediately dec'ed, 2 makes sure it survives one loop
        s +=
          'GRCLOSE();\n'+
          '}\n'+
          'GROPEN("grouped OR");\n'+
          'if (group'+matchStateNumber+') {\n' +
            'LOG("group'+matchStateNumber+' passed, skipping OR");\n'+
            'GRCLOSE();\n'+
          '} else {\n'+
          // reset stacks to the start of group state
          '  tokensMatched.length = tokensMatchGroupPointers[tokensMatchGroupPointers.length-1];\n' +
          '  callStack.length = callPointers[callPointers.length-1];\n' +
          '  argStack.length = argPointers[argPointers.length-1];\n' +
          '  group'+matchStateNumber+' = true; // init to true because inside a group\n'+
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

        var linestuff = parseLineStuff(insideToken, matchStateNumber, NOT_TOPLEVEL, OPTIONAL)

        if (linestuff) {
          s += linestuff;
          toplevelStartStatus = NOT_TOPLEVEL_START;
        } else {
          s += parseMatchConditions(insideToken, matchStateNumber);
          toplevelStartStatus = NOT_TOPLEVEL_START; // ?
        }
      }
      if (startOfChain) startOfChain--;
    }
    if (!insideToken) {
      s +=
        'if (!group'+matchStateNumber+') tokensMatched.length = tokensMatchGroupPointers.pop();\n'+
        'else tokensMatchGroupPointers.pop();\n'+
        '}\n'+
      '';
    }

    assert(')');
    return s;
  }

  function parseMatchConditions(insideToken, matchStateNumber, invert){
    var s = parseMatchParticle(insideToken, matchStateNumber, invert);
    while (consumeWhites() || peek('|') || peek('&')) {
      var d = consume();

      s = ' && (true' + s + ' ' + d + d + ' (true' + parseMatchParticle(insideToken, matchStateNumber) + '))';
    }

    return s;
  }

  function parseMatchParticle(insideToken, matchStateNumber, invert) {
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
        // TOFIX: create a test under which the second parameter is relevant as it seems to be ignored right now
        return parseAtomMaybe(insideToken, undefined, NOT_TOPLEVEL, invert);

      case '/':
        if (insideToken) return parseRegex();
    }

    if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked === '$' || peeked === '_')) {
      return parseSymbol(insideToken, matchStateNumber, invert);
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

  function parseSymbol(insideToken, matchStateNumber, invert) {
    var start = pos;
    var s = consume(); // TOFIX: should this be `consume`? will skip next whitespace, confirm.

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
      else t += 'if (!group'+matchStateNumber+') group1 = '; // TOFIX: make test case where `group1` fails because it should be group+matchStateNumber
      t += (invert?'!':'') + '('+hardcoded[s]+')';
      if (VERBOSE && !insideToken) t += ';\n';
      return t;
    }

    if (macros[s]) {
      // note: symbols are inside tokens so never toplevel
      t += injectMacro(macros[s], start, pos, insideToken, matchStateNumber, NOT_TOPLEVEL, invert);
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

  function injectMacro(macro, from, to, insideToken, matchStateNumber, isTopLevelStart, invert) {
    // remove lastAtomStart...pos and replace it with macro
    // then reset pos and parse atom again
    var s = '//injectMacro `'+query.slice(from, to)+'` -> `'+macro+'`\n';
    query = query.slice(0, from) + macro + query.slice(to);

    if (VERBOSE) WARN('Extrapolated query:', query);
    pos = from;
    if (peek('[') || peek('{') || peek('(')) return s + parseAtomMaybe(insideToken, matchStateNumber, isTopLevelStart, invert);
    return s + parseMatchConditions(insideToken, matchStateNumber, invert);
  }

  function parseQuantifiers(beforeAssignments, afterAssignments, matchStateNumber, currentCounter, insideToken) {
    // [foo] 1
    // [foo] 1...
    // [foo] 1..2

    var min = 0;
    var max = 0; // 0 => token.length

    var peeked = peek();
    var startpos = pos; // for debugging

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
      min = parseNumbersAsInt();

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
          max = parseNumbersAsInt();
        }
      }
    }

    if (insideToken) {
      throw 'Parse error: found quantifier for non-token or non-token-group. You can only quantify tokens.';
    }

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
      '{ // parseQuantifiers '+currentCounter+':'+matchStateNumber+'\n' +
        '// quantifier for this part of the query: `'+(query.slice(startpos, pos))+'`\n'+
        'var loopProtection'+currentCounter+' = 20000;\n' +
        'var min'+currentCounter+' = '+min+';\n' +
        'var max'+currentCounter+' = '+max+' || tokens.length;\n' +
        'var count'+currentCounter+' = 0;\n' +
        'var startIndex'+currentCounter+' = index;\n' +
        'do { // parseQuantifiers '+currentCounter+':'+matchStateNumber+'\n' +
        '  var startIndex'+innerCounter+' = index;\n' +
          beforeAssignments +
            parseAssignments(FORCE_PARAMFILL) +
            ', count'+currentCounter+'+1' +
            ', ' + callbackMode +
            ', min'+currentCounter +
          afterAssignments +
          // restore index if this group did not match ("backtracking")
        '  if (!group'+matchStateNumber+') index = startIndex'+innerCounter+';\n' +
        '} while(group'+matchStateNumber+' && --loopProtection'+currentCounter+' > 0 && (++count'+currentCounter+' < max'+currentCounter+'));\n' +
        'if (loopProtection'+currentCounter+' <= 0) throw "Loop protection!";\n' +
        // only check lower bound since upper bound is forced by the loop condition (`s` will override current value of group, but it was true at the start of the loop)
        'group'+matchStateNumber+' = count'+currentCounter+' >= min'+currentCounter+';\n' +
        'if (!group'+matchStateNumber+') index = startIndex'+currentCounter+';\n' +
      '}\n' +
      '';

    return result;
  }
  function parseNumbersAsInt() {
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
