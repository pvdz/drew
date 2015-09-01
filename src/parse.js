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
  var MANDATORY = false;
  var TOKEN_OR_GROUP_ONLY = true;
  var NOT_INVERSE = false;
  var FORCE_PARAMFILL = true;
  var NORMAL_CALL = 0;
  var REPEAT_CALL = 1;
  var COLLECT_CALL = 2;
  var MATCH_STATE_NUMBER_IRRELEVANT = undefined;

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
    var s =
      'var group'+matchStateNumber+' = false;\n' +
      'matchedSomething = false;\n' +
      'GROPEN("root start");\n' +
      '{\n' + // this way we can close and open a bracket when we encounter a | and dont worry about brackets in result.
    '';

    do {
      s += parseTopLevelAtom(matchStateNumber);

      if (peek('|')) {
        consume();
        s +=
          '  GRCLOSE();\n' +
          '} // top level, OR\n' +
          '\n' +
          'if (group' + matchStateNumber + ') LOG("Last part of top level matched, no need to check rest after OR");\n' +
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
    s +=
      '  GRCLOSE();\n' +
      '} // top level end\n' +
    '';

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

  function parseAtomMaybe(insideToken, matchStateNumber, isTopLevelStart, invert) {
    return parseAtom(insideToken, matchStateNumber, isTopLevelStart, invert, OPTIONAL);
  }
  function parseAtom(insideToken, matchStateNumber, isTopLevelStart, invert, optional, tokenOrGroupOnly) {
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
      // the paren is consumed in parseGroup...
      if (insideToken) {
        // from macro, or nested group
        result += '// - its a _nested_ group\n';
        beforeQuantifier += ' && ' + (invert ? '!' : '') + 'checkConditionGroup(symgc()' + parseGroup(INSIDE_TOKEN, matchStateNumber, NOT_TOPLEVEL_START) + ')';

        result += (insideToken ? '&& (' : '{\n') + 'matchedSomething = true' + (insideToken ? ')' : ';\n');
        result += parseQuantifiers(beforeQuantifier, afterQuantifier, matchStateNumber, currentCounter, insideToken);
        result += (insideToken ? '' : '}\n');
      } else {
        // top level, or nested group
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
    } else if (tokenOrGroupOnly) {
      if (!optional) reject('Expected to parse token or group only');
      return '';
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
      var r = parseSeeks(insideToken, matchStateNumber, isTopLevelStart, optional);
      if (!r) return r;
      result += '// - it must be a line start or end or tilde...\n';
      result += r;
    }

    result =
      '\n//#parseAtomMaybe('+insideToken+', '+matchStateNumber+', '+isTopLevelStart+', '+invert+') (parsed `'+query.slice(startpos, pos).replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'`)\n'+
      result +
      '// parseAtomMaybe end\n';
    return result;
  }

  function parseSeeks(insideToken, matchStateNumber, isTopLevelStart, optional) {
    var result = '//#parseSeeks('+insideToken+', '+matchStateNumber+', '+optional+')\n';

    if (peek('~')) {
      assert('~');
      if (insideToken) reject('Tilde (~) only allowed outside of tokens');

      var varCounter = ++counter;

      // we are going to match ~ regardless. but it will only pass if either it's not
      // at the start of the query (something else already consumed something), or the
      // operator would be a noop because applying it did not increment the pointer.
      result +=
        '{\n' +
        '  GROPEN("~ seek");\n' +
        '  var start'+varCounter+' = matchedSomething || index; // save to compare afterwards\n' +
        injectMacro(macros['~'], pos - 1, pos, insideToken, matchStateNumber, isTopLevelStart, NOT_INVERSE) +
        '  if (start'+varCounter+' !== true && start'+varCounter+' !== index) {\n' +
        '    // if ~ is at query start and would not be a NOOP it does not "pass"\n' +
        '    LOG("~ at start would not be a NOOP; so failing match");\n'+
        '    index = start'+varCounter+';\n' +
        '  } else {\n' +
        '    group'+matchStateNumber+' = true; // the ~ seek passes regardless\n'+
        '  }\n' +
        '  GRCLOSE();\n' +
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

      result +=
        '{\n' +
        '  GROPEN("'+symbol+(forBlack?symbol:'')+' '+steps+'x, start index="+index, tokens[index]);\n' +
      '';

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
          result += 'index = Math.max(index - '+steps+', 0);'
        } else {
          result += '// - its a white skip (>) for '+steps+'x\n';
          result += 'index = Math.min(index + '+steps+', tokens.length);'
        }
      }
      result +=
        '  GRCLOSE();\n'+
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
        result += 'LOG("$$ end of file?", isEof());\n';
        result += 'group' + matchStateNumber + ' = isEof();';
        result += ' // $$\n'
      } else {
        assert('$');
        result += 'LOG("$ end of line?", "eol=", isEof() || isNewline(0), "eof=", isEof());\n';
        result += '(group' + matchStateNumber + ' = (isEof() || isNewline(0)));';
        result += ' // $\n';
      }
      result += 'matchedSomething = true;\n';
      result += 'GRCLOSE();\n';
      result += '}\n';
    } else if (peek('-') && query[pos+1] === '-' && query[pos+2] === '>') {
      pos += 3;

      // so basically we try to match the next token and bump the index while we dont
      var loopId = ++counter;
      result +=
        '{\n' +
        '  var protect'+loopId+' = 10000;\n'+
        '  do {\n'+
        '    if (!matchedSomething) throw "Arrow (-->) not allowed at the start of a query";\n'+
        '    LOG("--> parsing until we find next atom, from:", index, tokens[index]);\n'+
        '    group'+matchStateNumber+' = true; // need to set this or atom wont parse, will be overriden immediately anyways\n'+
        parseAtom(OUTSIDE_TOKEN, matchStateNumber, isTopLevelStart, NOT_INVERSE) + // restrict to tokens and groups...
        '    // increase index by one as long as we dont match\n'+
        '    if (group'+matchStateNumber+') LOG("Next atom found");\n'+
        '  } while (!group'+matchStateNumber+' && ++index && !isEof() && --protect'+loopId+' > 0);\n' +
        '  if (protect'+loopId+' <= 0) debugger;// throw "loop protection (seek)";\n' +
        '}\n' +
      '';

    } else if (optional) {
      return false;
    } else {
      reject('unable to parse line stuff, and it is not optional');
    }

    return result;
  }

  function parseWhiteToken() {
    assert('[');
    var s = parseMatchConditions(INSIDE_TOKEN, MATCH_STATE_NUMBER_IRRELEVANT, NOT_TOPLEVEL_START, NOT_INVERSE);
    assert(']');
    return s;
  }
  function parseBlackToken() {
    assert('{');
    var s = parseMatchConditions(INSIDE_TOKEN, MATCH_STATE_NUMBER_IRRELEVANT, NOT_TOPLEVEL_START, NOT_INVERSE);
    assert('}');
    return s;
  }
  function parseGroup(insideToken, matchStateNumber, toplevelStart) {
    assert('(');
    var s = '';
    s += '// parseGroup, toplevelStart='+toplevelStart+'\n';
    if (!insideToken) {
      s +=
        '{\n' + // for the |
        '  GROPEN("parse group");\n' +
        '  group' + matchStateNumber + ' = true;\n' + // init to true for group, to be falsified later
        '  tokensMatchGroupPointers.push(tokensMatched.length); // parseGroup; store pointer to current matches so we can drop new matches in case the group fails\n' +
      '';
    }
    var startOfChain = 1;
    var toplevelStartStatus = toplevelStart; // "pointer" so we can reset to initial value when we encounter a pipe...
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
        // nested group but paren is not consumed here...
        s += parseAtomMaybe(insideToken, matchStateNumber, toplevelStartStatus);
        toplevelStartStatus = NOT_TOPLEVEL_START;
      } else if (peek('|')) {
        toplevelStartStatus = toplevelStart; // reset to what it was at the call
        assert('|');
        if (insideToken) reject('Expecting ors inside tokens to be caught in parseMatchConditions');
        startOfChain = 2; // first is immediately dec'ed, 2 makes sure it survives one loop
        s +=
          '  LOG("group sub-end for OR");\n'+
          '  GRCLOSE();\n'+
          '}\n'+
          'if (group'+matchStateNumber+') {\n' +
          '  LOG("group'+matchStateNumber+' passed, skipping OR");\n'+
          '} else {\n'+
          '  GROPEN("grouped OR");\n'+
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

        var linestuff = parseSeeks(insideToken, matchStateNumber, NOT_TOPLEVEL, OPTIONAL)

        if (linestuff) {
          s += linestuff;
          toplevelStartStatus = NOT_TOPLEVEL_START;
        } else {
          // expecting a macro at this point...
          // can trigger inside and outside tokens due to macro extrapolation
          var peeked = peek();
          if (!((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked === '$' || peeked === '_'))) reject('not a macro? then what?');

          s += parseMatchConditions(insideToken, matchStateNumber, toplevelStart, NOT_INVERSE);
          toplevelStartStatus = NOT_TOPLEVEL_START; // ?
        }
      }
      if (startOfChain) startOfChain--;
    }
    if (!insideToken) {
      s +=
        '  if (!group'+matchStateNumber+') tokensMatched.length = tokensMatchGroupPointers.pop();\n'+
        '  else tokensMatchGroupPointers.pop();\n' +
        '  LOG("end of group");\n'+
        '  GRCLOSE();\n'+
        '}\n'+
      '';
    }

    assert(')');
    return s;
  }

  function parseMatchConditions(insideToken, matchStateNumber, toplevelStart, invert){
    // from parseGroup, parseToken (black/white), or parseMacro which could be anything
    if (matchStateNumber === MATCH_STATE_NUMBER_IRRELEVANT && insideToken !== INSIDE_TOKEN) reject('expect a match state number when not inside a token');

    var s = parseMatchParticle(insideToken, matchStateNumber, toplevelStart, invert);
    while (consumeWhites() || peek('|') || peek('&')) {
      // toplevel outer | is caught by parseQuery
      // group outer is caught by parseGroup
      // group inner is caught by parseGroup
      // so this could only be token inner
      if (!insideToken) reject('Expect outer | to be caught by parseQuery or parseGroup, outer & is illegal regardless');

      var d = consume();
      s = ' && (true' + s + ' ' + d + d + ' (true' + parseMatchParticle(insideToken, matchStateNumber, NOT_TOPLEVEL_START, NOT_INVERSE) + '))';
    }

    return s;
  }

  function parseMatchParticle(insideToken, matchStateNumber, toplevelStart, invert) {
    // from parseGroup, parseToken (black/white), or parseMacro which could be anything

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
        // parse group inside token (consumes in parseGroup eventually)
        // - nested groups is done in parseAtom from parseGroup
        // - outer group is done in parseAtom, never here
        if (!insideToken) reject('fixme')
        return parseAtomMaybe(INSIDE_TOKEN, MATCH_STATE_NUMBER_IRRELEVANT, toplevelStart, invert);

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

      ++pos; // backslash (regardless)
      switch (peeked) {
        case '\\':
          var escaped = query[pos].toLowerCase();
          switch (escaped) {
            case 'u':
            case 'w':
              var a = query[pos + 1].toLowerCase();
              if ((a < '0' || a > '9') && (a < 'a' || a > 'f')) reject('Unicode escape must be 0-9a-f, was [' + a + ']');
              var b = query[pos + 2].toLowerCase();
              if ((b < '0' || b > '9') && (b < 'a' || b > 'f')) reject('Unicode escape must be 0-9a-f, was [' + b + ']');
              var c = query[pos + 3].toLowerCase();
              if ((c < '0' || c > '9') && (c < 'a' || c > 'f')) reject('Unicode escape must be 0-9a-f, was [' + c + ']');
              var d = query[pos + 4].toLowerCase();
              if ((d < '0' || d > '9') && (d < 'a' || d > 'f')) reject('Unicode escape must be 0-9a-f, was [' + d + ']');

              // w ("wide") takes 6
              if (escaped === 'u') {
                s += '\\u' + a + b + c + d;
                pos += 5;
              } else {
                var e = query[pos + 5].toLowerCase();
                if ((e < '0' || e > '9') && (e < 'a' || e > 'f')) reject('Unicode escape must be 0-9a-f, was [' + e + ']');
                var f = query[pos + 6].toLowerCase();
                if ((f < '0' || f > '9') && (f < 'a' || f > 'f')) reject('Unicode escape must be 0-9a-f, was [' + f + ']');
                s += '\'+String.fromCharCode(' + parseInt(a + b + c + d + e + f, 16) + ')+\'';
                pos += 7;
              }
              break;

            case 'x':
              var a = query[pos + 1].toLowerCase();
              if ((a < '0' || a > '9') && (a < 'a' || a > 'f')) reject('Unicode escape must be 0-9a-f, was [' + a + ']');
              var b = query[pos + 2].toLowerCase();
              if ((b < '0' || b > '9') && (b < 'a' || b > 'f')) reject('Unicode escape must be 0-9a-f, was [' + b + ']');
              s += '\\x' + a + b;
              pos += 3;
              break;

            case '\\':
              s += '\\\\';
              ++pos;
              break;

            default:
              ++pos;
              s += '\\\\' + escaped;
              break;
          }
          break;

        // newlines must be properly escaped because this is translated to a JavaScript string
        // JS defines 4 different newlines, but at least that's all
        case '\n':
          s += '\\n';
          break;
        case '\r':
          s += '\\r';
          break;
        case '\u2028':
          s += '\\u2028';
          break;
        case '\u2029':
          s += '\\u2029';
          break;
        case '\'':
          s += '\\\'';
          break;
        default:
          s += peeked;
      }
    }
    if (protection <= 0) {debugger; reject('loop protection (literal)'); }
    assert('`');
    var ci = peek('i');
    if (ci) ++pos;

    var q = ' && !void LOG("# '+(++logCounter)+' start of literal [`%o`] at '+pos+' in query to token "+index+":", "'+ s.replace(/"/g,'\\"').replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'", token())';
    var t = ' && '+(invert?'!':'')+'is'+(ci?'i':'')+'(\'' + s + '\')';

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

    var q = ' && !void LOG("# '+(++logCounter)+' start of regex [`%o`] at '+pos+' in query to token "+index+":", '+regstr+', token())';
    var t = ' && '+regstr+'.test(value(0))';

    return q + t;
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

    //if (!insideToken) reject('expecting symbols to be only inside tokens...');

    var t = '';
    if (insideToken) t += ' && !void ';
    t += 'LOG("# '+(++logCounter)+' start of symbol ['+ s.replace(/"/g,'\"')+'] at '+pos+' in query to token "+index+":", token())';
    if (!insideToken) t += ';\n';

    if (hardcoded[s]) {
      if (insideToken) t += ' && ';
      else t += 'if (!group'+matchStateNumber+') group1 = '; // TOFIX: make test case where `group1` fails because it should be group+matchStateNumber
      t += (invert?'!':'') + '('+hardcoded[s]+')';
      if (!insideToken) t += ';\n';
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

      assignmentString += ' /* = */ ';

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
      assignmentString += ' /* no assignment */ ';
      assignmentString += ', undefined, undefined';
    } else {
      assignmentString += ' /* no assignment */ ';
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
    WARN('Extrapolated query:', query);
    pos = from;
    if (peek('[') || peek('{') || peek('(')) return s + parseAtomMaybe(insideToken, matchStateNumber, isTopLevelStart, invert);
    return s + parseMatchConditions(insideToken, matchStateNumber, isTopLevelStart, invert);
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
      // TOFIX: we can drop the parseAssignments call here I think?
      return beforeAssignments + ' /* EOF */ ' + parseAssignments() + afterAssignments;
    } else if (peeked < '0' || peeked > '9') {
      // no quantifier. dont wrap string.
      return beforeAssignments + ' /* no quantifier */ ' + parseAssignments() + afterAssignments;
    } else {
      min = parseNumbersAsInt();

      if (!peek('.')) {
        max = min;
      } else if (query[pos+1] === '.') {
        pos += 2;

        if (query[pos] === '.') {
          consume('.');
          max = 0;
        } else {
          peeked = peek();
          if (!(peeked > '0' && peeked < '9')) {
            reject('expecting number after double dot');
          } else {
            max = parseNumbersAsInt();
          }
        }
      } else { // only one dot
        reject('expecting two or three dots after the first optional number in a quantifier');
      }
    }

    if (insideToken) reject('Parse error: found quantifier for non-token or non-token-group. You can only quantify tokens.');

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
        'if (loopProtection'+currentCounter+' <= 0) throw "Loop protection (quantifier)";\n' +
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

  WARN('Parsing query   :', query);
  var code = parseQuery();

  return (
    'function query(){\n'+
    '  // input query: '+inputQuery.replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'\n' +
    '  // final query: '+query.replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'\n' +
//  '  if(index===2)debugger;'+
    '  // query start..\n' +
       code+'\n' +
    '  // query end..\n' +
//  '  if(index===0)debugger;'+
    '  return group0;\n' +
    '}\n'
    );
}
