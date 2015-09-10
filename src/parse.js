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
  var MANDATORY = false;
  var TOKEN_OR_GROUP_ONLY = true;
  var INVERSE = true;
  var NOT_INVERSE = false;
  var FORCE_PARAMFILL = true;
  var NORMAL_CALL = 0;
  var REPEAT_CALL = 1;
  var COLLECT_CALL = 2;
  var MATCH_STATE_NUMBER_IRRELEVANT = undefined;
  var LAMBDA = '\u03bb';

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

  function consumeThenSkipWhites() {
    var c = query[pos++];

    consumeWhitesOnly();

    return c;
  }
  function consumeWhitesOnly() {
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
    consumeThenSkipWhites();
  }
  function reject(m){
    console.log(query.slice(0, pos) + '\ud68e\ud68e\ud68e'+ query.slice(pos));
    throw new Error('['+pos+'] '+m);
  }

  function parseQuery() {
    var matchStateNumber = ++counter;
    var s =
      'var queryPassState_'+matchStateNumber+' = NEW_STATE; // 1\n' +
      'GROPEN("root start");\n' +
      '{\n' + // this way we can close and open a bracket when we encounter a | and dont worry about brackets in result.
    '';
    do {
      s += parseTopLevelAtom(matchStateNumber, MANDATORY);

      if (peek('|')) {
        consumeThenSkipWhites();
        s +=
          '  GRCLOSE();\n' +
          '} // top level, OR\n' +
          '\n' +
          'if (queryPassState_' + matchStateNumber + ' === PASS_STATE) LOG("Last part of top level matched, no need to check rest after OR");\n' +
          '// toplevel OR\n' +
          'if (queryPassState_' + matchStateNumber + ' !== PASS_STATE) {\n' +
          '  GROPEN("root OR start");\n' +
          '  queryPassState_' + matchStateNumber+' = NEW_STATE; // must be set to NEW because top-level OR\n' +
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
    var optional = MANDATORY; // first in a loop is always required.
    while (atom = parseOutsideAtom(matchStateNumber, optional)) {
      s += atom + '\n';
      optional = OPTIONAL; // only first one in a loop can be mandatory in this context
    }

    return s;
  }

  function parseOutsideAtom(matchStateNumber, optional) {
    lastAtomStart = pos;
    var startpos = pos; // for debugging
    var atomStateNumber = ++counter;

    var result =
      // TOFIX: should this be moved to something that loops or group or...?
      '  var queryPassState_' + atomStateNumber + ' = queryPassState_' + matchStateNumber + ';\n' + // copy because `x(-->y)`
      '';
    var beforeQuantifier = '';
    var afterQuantifier = '';

    consumeWhitesOnly();

    switch (peek()) {
      case LAMBDA:
        // ignore. code will already have been compiled. this is just an artifact to simplify other parts of the code.
        ++pos;
        break;
      case '[': {
        result += '// - its a white token\n';

        beforeQuantifier += '// parseAtomMaybe ' + atomStateNumber + ' for a white token `[`\n';
        beforeQuantifier += '// white token ' + atomStateNumber + ':' + (++tokenCounter) + '\n';
        beforeQuantifier += 'queryPassState_' + atomStateNumber + ' = checkTokenWhite(symw()' + parseWhiteToken();

        afterQuantifier += ');\n';
        afterQuantifier += '// `]` ' + atomStateNumber + ' for a white token\n';

        result += parseQuantifiers(beforeQuantifier, afterQuantifier, atomStateNumber);
        break;
      }
      case '{': {
        result += '// - its a black token\n';

        beforeQuantifier += '// parseAtomMaybe ' + atomStateNumber + ' for black token `{`\n';
        beforeQuantifier += '// black token ' + atomStateNumber + ':' + (++tokenCounter) + '\n';
        beforeQuantifier += 'queryPassState_' + atomStateNumber + ' = checkTokenBlack(symb()' + parseBlackToken();

        afterQuantifier += ');\n';
        afterQuantifier += '// `}` ' + atomStateNumber + ' for black token\n';

        result += parseQuantifiers(beforeQuantifier, afterQuantifier, atomStateNumber);
        break;
      }
      case '(': {
        // the paren is consumed in parseGroup...
        // top level, or nested group
        result += '// - its a outer group\n';

        beforeQuantifier += '// parseAtomMaybe ' + atomStateNumber + ' for a token group `(`\n';
        beforeQuantifier += '// start of a group (' + atomStateNumber + ')\n';
        // TOFIX: does it matter if outer state is NEW vs PASS?
        //beforeQuantifier += 'var queryPassState_' + atomStateNumber + ' = NEW_STATE; // 4\n'; // inside a group, init to true
        beforeQuantifier += 'var groupStart' + atomStateNumber + ' = index;\n';
        beforeQuantifier += 'symgt(); // ' + atomStateNumber + '\n';
        beforeQuantifier += parseGroupOutside(atomStateNumber);
        beforeQuantifier += 'checkTokenGroup(';
        beforeQuantifier += 'queryPassState_' + atomStateNumber;
        beforeQuantifier += ', index - groupStart' + atomStateNumber;

        afterQuantifier += ');\n';
        afterQuantifier += 'if (queryPassState_' + atomStateNumber + ' === FAIL_STATE) index = groupStart' + atomStateNumber + ';\n';
        // TOFIX: what if the group state was new but the outer state was pass? should not clobber here...
        afterQuantifier += 'queryPassState_' + matchStateNumber + ' = queryPassState_' + atomStateNumber + '\n';
        afterQuantifier += '// end group ' + atomStateNumber + '\n';
        afterQuantifier += '// `)` ' + atomStateNumber + ' for token group\n';

        result += parseQuantifiers(beforeQuantifier, afterQuantifier, atomStateNumber);
        break;
      }
      case '#': {
        result += '// an explicit callback (#)\n';
        assert('#');
        var id = parseDesignator();
        if (!id) id = 0;
        parseColonComment();
        result += 'queueEarlyCall("' + id + '");\n';
        break;
      }
      case '~': {
        assert('~');

        var varCounter = ++counter;
        // we are going to match ~ regardless. but it will only pass if either it's not
        // at the start of the query (something else already consumed something), or the
        // operator would be a noop because applying it did not increment the pointer.
        result +=
          '  GROPEN("~ seek");\n' +
          '  var start' + varCounter + ' = index; // save to compare afterwards\n' +
            // replace ~ with the user define macro, then call parseGroup to call it all
          injectMacroAsGroup(macros['~'], pos - 1, pos, NOT_INVERSE) +
            // inject will wrap in a group
          parseGroupOutside(atomStateNumber) +
          // if _matchStateNumber_ is unset here we are at the start of a query
          // in that case, if ~ matched something, consider it a fail.
          '  if (queryPassState_' + matchStateNumber + ' === NEW_STATE && start' + varCounter + ' !== index) {\n' +
          '    // if ~ is at query start and would not be a NOOP it does not "pass"\n' +
          '    LOG("~ at start would not be a NOOP; so failing match");\n' +
          '    queryPassState_' + atomStateNumber + ' = FAIL_STATE;\n' +
          '    index = start' + varCounter + ';\n' +
          '  } else {\n' +
          '    LOG("~ passed");\n' +
          '  }\n' +
          '  GRCLOSE();\n' +
          '';
        break;
      }
      case '<':
      case '>': {
        var symbol = peek();
        ++pos;
        // dont skip whitespace. this would allow you to explicitly skip white tokens without a number suffix
        var forBlack = peek() === symbol;
        if (forBlack) ++pos;
        consumeWhitesOnly();
        var peeked = peek();
        var steps = 1;
        if (peeked >= '0' && peeked <= '9') steps = parseNumbersAsInt();
        if (!steps) reject('Cannot use `' + steps + '`; it is an illegal number for moving the pointer forward');
        result +=
          '{\n' +
          '  GROPEN("' + symbol + (forBlack ? symbol : '') + ' ' + steps + 'x, start index="+index, tokens[index]);\n' +
          '';
        if (forBlack) {
          // need to seek explicitly
          if (symbol === '<') { // <<
            result +=
              '// - its a black back skip (>>) for ' + steps + 'x\n' +
              'for (var i=0; LOG("- <<", index), i<' + steps + '; ++i) {\n' +
              '  --index;\n' + // put against next black token, dont skip if already black
              '  rewindToBlack();\n' + // now skip the token that must be black
              '  LOG("- >>", tokens[index]);\n' +
              '}\n' +
              'LOG("- >> end pos=", index);\n' +
              '';
          } else { // >>
            result +=
              '// - its a black skip (>>) for ' + steps + 'x\n' +
              'for (var i=0; LOG("- >>", index), i<' + steps + '; ++i) {\n' +
              '  consumeToBlack();\n' + // put against next black token, dont skip if already black
              '  next();\n' + // now skip the token that must be black
              '  LOG(tokens[index]);\n' +
              '}\n' +
              'LOG("- >> end pos=", index);\n' +
              '';
          }
        } else {
          // just forward the pointer
          if (symbol === '<') {
            result += '// - its a white back skip (<) for ' + steps + 'x\n';
            result += 'index = Math.max(index - ' + steps + ', 0);'
          } else {
            result += '// - its a white skip (>) for ' + steps + 'x\n';
            result += 'index = Math.min(index + ' + steps + ', tokens.length);'
          }
        }
        result +=
          '  GRCLOSE();\n' +
          '}\n' +
          '';
        break;
      }
      case '^': {
        // start of line, or start of file if another ^ follows
        result += '{\n';
        result += 'GROPEN("^ or ^^");\n';
        if (over('^')) { // no space between
          assert('^');
          assert('^');
          result += 'LOG("^^ start of file?", !index);';
          result += 'queryPassState_' + atomStateNumber + ' = !index ? PASS_STATE : FAIL_STATE;';
          result += ' // ^^\n';
        } else {
          assert('^');
          result += 'LOG("^ start of line?", !index, index && isNewline(-1), "->", !index || isNewline(-1));\n';
          result += 'queryPassState_' + atomStateNumber + ' = (!index || isNewline(-1)) ? PASS_STATE : FAIL_STATE;';
          result += ' // ^\n';
        }
        result += 'GRCLOSE();\n';
        result += '}\n';
        break;
      }
      case '$': {
        // end of line, or end of file if another $ follows
        result += '{\n';
        result += 'GROPEN("$ or $$");\n';
        if (over('$')) { // no space between
          assert('$');
          assert('$');
          result += 'LOG(tokens[index]);\n';
          result += 'LOG("$$ end of file?", isEof());\n';
          result += 'queryPassState_' + atomStateNumber + ' = isEof() ? PASS_STATE : FAIL_STATE;';
          result += ' // $$\n'
        } else {
          assert('$');
          result += 'LOG("$ end of line?", "eol=", isEof() || isNewline(0), "eof=", isEof());\n';
          result += 'queryPassState_' + atomStateNumber + ' = (isEof() || isNewline(0)) ? PASS_STATE : FAIL_STATE; // $\n';
        }
        result += 'GRCLOSE();\n';
        result += '}\n';
        break;
      }
      case '-': {
        if (query[pos + 1] === '-' && query[pos + 2] === '>') {
          pos += 3;

          // so basically we try to match the next token and bump the index while we dont
          var loopId = ++counter;
          result +=
            '{\n' +
            ' GROPEN("-->");\n' +
            '  var protect' + loopId + ' = 10000;\n' +
              // TOFIX: this uncovers a problem with state; something should be transferred from parent to child because right now children start as NEW. while true for a group, false for the query as a whole, and that's the relevant part here.
              // note: use matchStateNumber here! we want to know whether we parsed anything at all
            '  if (queryPassState_' + matchStateNumber + ' === NEW_STATE) {\n' +
            '    WARN("Arrow (-->) not allowed at the start of a query");\n' +
            '    queryPassState_' + atomStateNumber + ' = FAIL_STATE;\n' +
            '  } else {\n' +
            '    do {\n' +
            '      LOG("--> parsing until we find next atom, from:", index, tokens[index]);\n' +
            '      queryPassState_' + atomStateNumber + ' = PASS_STATE; // note that state cannot be NEW here because then --> would have failed. will be overwritten but otherwise code will not even check\n' +
            parseOutsideAtom(atomStateNumber, MANDATORY) + // restrict to tokens and groups...
            '      // increase index by one as long as we dont match\n' +
            '    } while (queryPassState_' + atomStateNumber + ' === FAIL_STATE && ++index && !isEof() && --protect' + loopId + ' > 0);\n' +
            '    if (protect' + loopId + ' <= 0) debugger;// throw "loop protection (seek)";\n' +
            '    if (queryPassState_' + atomStateNumber + ' !== FAIL_STATE) LOG("Next atom found");\n' +
            '    else LOG("unable to find match, --> failed");\n' +
            '  }\n' +
            '  GRCLOSE();\n' +
            '}\n' +
            '';
        }
        break;
      }
    }
    // if (tokenOrGroupOnly) { // TOFIX: revisit tokenorgrouponly stuff
    //if (!optional) reject('Expected to parse token or group only');
    //return '';

    if (startpos === pos) {
      if (optional) return false;
      reject('unable to parseOutsideAtom and it is not optional');
    }

    result =
      '\n//#parseOutsideAtom('+atomStateNumber+', '+optional+') (parsed `'+query.slice(startpos, pos).replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'`)\n'+
      'if (queryPassState_'+matchStateNumber+' !== FAIL_STATE) { // (if not fail then either new or pass)\n' +
      result +
      '  if (queryPassState_'+atomStateNumber+' !== NEW_STATE) queryPassState_'+matchStateNumber+' = queryPassState_'+atomStateNumber+';\n'+
      '} // parseOutsideAtom end\n';

    return result;
  }
  function parseWhiteToken() {
    assert('[');
    var s = parseInsideAtoms(NOT_INVERSE);
    assert(']');
    return s;
  }
  function parseBlackToken() {
    assert('{');
    var s = parseInsideAtoms(NOT_INVERSE);
    assert('}');
    return s;
  }

  function parseAtomInside(matchStateNumber, invert, optional, tokenOrGroupOnly) {
    lastAtomStart = pos;
    var startpos = pos; // for debugging

    var beforeQuantifier = '';
    var afterQuantifier = '';

    var result = '';

    if (peek('(')) {
      // the paren is consumed in parseGroup...
      // from macro, or nested group
      result +=
        '// - its a _nested_ group\n'+
        ' && ' + (invert ? '!' : '') + 'checkConditionGroup(symgc()' + parseGroupInside() + ')' +
        '';
    } else if (peek('#')) {
      result += '// an explicit callback (#)\n';
      assert('#');

      var id = parseDesignator();
      if (!id) id = 0;

      parseColonComment();

      result += 'queueEarlyCall("' + id + '");\n';
    } else {
      throw 'nope';
    }

    result =
      '\n//#parseAtomInside('+matchStateNumber+', '+invert+') (parsed `'+query.slice(startpos, pos).replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'`)\n'+
      '&& (true ' +
      result +
      ')';

    return result;
  }

  function parseGroupInside() {
    if (peek(LAMBDA)) {
      // special case: just consume a character and return
      // this happens when parsing a symbol that turns out to be a constant
      // parseGroup is immediately called afterwards so we can return now
      assert(LAMBDA);
      return '// ('+LAMBDA+')\n';
    }

    var s = '';
    assert('(');
    // we know it is NOT a ( so we dont have the possibility of a group here, so:
    if (!peek(')')) s += parseInsideAtoms(NOT_INVERSE);
    assert(')');

    return s;
  }
  function parseGroupOutside(matchStateNumber) {
    if (peek(LAMBDA)) {
      // special case: just consume a character and return
      // this happens when parsing a symbol that turns out to be a constant
      // parseGroup is immediately called afterwards so we can return now
      assert(LAMBDA);
      return '// ('+LAMBDA+')\n';
    }
    assert('(');
    var groupUniqueIndex = ++counter;
    var s =
      '// parseGroup\n' +
      '{\n' + // for the |
      '  GROPEN("parse group [id='+groupUniqueIndex+']");\n' +
      '  tokensMatchGroupPointers.push(tokensMatched.length); // parseGroup; store pointer to current matches so we can drop new matches in case the group fails\n' +
      '  var groupStartIndex'+groupUniqueIndex+' = index; // to reset at group-OR\n' +
      ' var queryPassState_'+groupUniqueIndex+' = queryPassState_'+matchStateNumber+';\n' + // copy
      '';
    var protect = 100000;
    while (--protect > 0) {
      var peeked = peek();
      if (peeked === ')') break;
      switch (peeked) {
        case '':
        case undefined:
          return reject('Unexpected EOF');

        case '|':
          assert('|');
          s +=
            '  LOG("group sub-end for OR");\n' +
            '  GRCLOSE();\n' +
            '}\n' +
            'if (queryPassState_' + groupUniqueIndex + ' !== FAIL_STATE) {\n' +
            '  LOG("group' + groupUniqueIndex + ' passed, skipping OR");\n' +
            '} else {\n' +
            '  GROPEN("grouped OR");\n' +
              // reset index to what it was before parsing this group (we are effectively at that point again)
            '  index = groupStartIndex'+groupUniqueIndex+';\n' +
              // reset stacks to the start of group state
            '  tokensMatched.length = tokensMatchGroupPointers[tokensMatchGroupPointers.length-1];\n' +
            '  callStack.length = callPointers[callPointers.length-1];\n' +
            '  argStack.length = argPointers[argPointers.length-1];\n' +
            '  // state must be new/false. force to new so group does continue parsing\n' +
            '  queryPassState_' + groupUniqueIndex + ' = queryPassState_'+matchStateNumber+';\n' + // copy
            '';
          break;

        // TOFIX: `[x]&[y]` is not the same as `[x]<[y]` in complexer cases so maybe we should support it?
        case '&':
          assert('&');
          reject('No need to put & between tokens (just omit them), only allowed between match conditions');
          break;

        default:
          // special case: identifiers can appear outside tokens when inside a group
          if (isIdentChar(peeked)) {
            s += replaceSymbolOutside(groupUniqueIndex);
          }
          // (if symbol was a constant, it will be replaced with lambda which is ignored by parseOutsideAtom)
          s += parseOutsideAtom(groupUniqueIndex, MANDATORY);
      }
    }
    if (!protect) reject('loop protection ['+peeked+']');
    s +=
      '  if (queryPassState_'+groupUniqueIndex+' === FAIL_STATE) tokensMatched.length = tokensMatchGroupPointers.pop();\n'+
      '  else tokensMatchGroupPointers.pop();\n' +
      '  LOG("end of group");\n'+
      '  GRCLOSE();\n'+
      '}\n'+
      'queryPassState_' + matchStateNumber + ' = queryPassState_'+groupUniqueIndex+'; // ultimate result of group '+groupUniqueIndex+'\n' + // copy back
      '';

    assert(')');
    return s;
  }

  function parseInsideAtoms(invert){
    var s = parseInsideAtom(invert);
    // toplevel outer | is caught by parseQuery
    // group outer is caught by parseGroup
    // group inner is caught by parseGroup
    // so this could only be token inner
    // `(A|B)` and `(A&B)` can trigger here (due to macros or constants)
    consumeWhitesOnly();
    if (peek('|') || peek('&')) {
      // must wrap once because `A && B || C` is different from `A && (B || C)`
      s = ' && (true' + s + ')';

      do {
        var d = consumeThenSkipWhites();
        // TOFIX: atom or atoms? affects how the conditions are wrapped... it may be atoms actually.
        s += ' ' + d + d + ' (true' + parseInsideAtom(NOT_INVERSE) + ')';
        consumeWhitesOnly();
      } while (peek('|') || peek('&'));
    }
    return s;
  }
  function parseInsideAtom(invert) {
    // from parseGroup, parseToken (black/white), or parseMacro which could be anything

    if (pos >= query.length) return true;

    if (peek('!')) {
      assert('!');
      invert = invert !== INVERSE ? INVERSE : NOT_INVERSE;
    }
    var peeked = peek();
    switch (peeked) {
      case '`':
        return parseLiteral(invert);

      case '*':
        return parseStarCondition(invert);

      case '(':
        // parse group inside token (consumes in parseGroup eventually)
        // - nested groups is done in parseOutsideAtom from parseGroup
        // - outer group is done in parseOutsideAtom, never here
        return parseAtomInside(MATCH_STATE_NUMBER_IRRELEVANT, invert, MANDATORY);

      case '/':
        return parseRegex();

      default:
        if (isIdentChar(peeked)) {
          // inject macro or constant with value. restart this parse step from the same position
          // (replaceSymbol will replace input and reset before returning, or reject altogether)
          return ''+
            replaceSymbolInside(invert) +
            parseGroupInside() +
          '';
        }
    }

    reject(new Error('Unexpected state [index='+pos+'][peek='+peeked+'][query='+query+']'));
  }

  function parseLiteral(invert) {
    ++pos;
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

  function replaceSymbolOutside(matchStateNumber) {
    // we will "consume" the symbol that should be found from `pos`.
    // we'll slice it out, replace it with whatever the macro or constant is.
    // then we'll reset the pos and return. the caller should restart the parse.
    // returns debugging stuff for the compiled function

    var start = pos;

    var s = '';
    while (isIdentChar(peek())) s += query[pos++];

    var t =
      '{\n' +
      '  LOG("# '+(++logCounter)+' start of '+(hardcoded[s]?'constant':'macro')+' ['+ s.replace(/"/g,'\"')+'] at '+pos+' in query to token "+index+":", token());\n' +
      '';

    if (hardcoded[s]) {
      // inject a lambda. wont be wrapped. special case handled and ignored in parseGroup
      injectMacroAsGroup(LAMBDA, start, pos, NOT_INVERSE);

      return t +
        '  LOG(" - it\'s a constant");\n' +

        '  queryPassState_' + matchStateNumber + ' = ('+hardcoded[s]+') ? PASS_STATE : FAIL_STATE;\n' +
        '}\n' +
        '';
    }

    if (macros[s]) {
      // note: symbols are inside tokens so never toplevel
      return t +
        '  LOG(" - it\'s a macro");\n  ' +

        injectMacroAsGroup(macros[s], start, pos) + ';\n' +

        '}\n' +
        '';
    }

    reject('replaceSymbolOutside: Unknown constant: ['+s+']');
  }
  function replaceSymbolInside(invert) {
    // we will "consume" the symbol that should be found from `pos`.
    // we'll slice it out, replace it with whatever the macro or constant is.
    // then we'll reset the pos and return. the caller should restart the parse.
    // returns debugging stuff for the compiled function

    var start = pos;

    var s = '';
    while (isIdentChar(peek())) s += query[pos++];

    var t =
      ' && !void LOG("# '+(++logCounter)+' start of '+(hardcoded[s]?'constant':'macro')+' invert='+invert+' ['+ s.replace(/"/g,'\"')+'] at '+pos+' in query to token "+index+":", token())' +
      '';

    if (hardcoded[s]) {
      // inject a lambda. wont be wrapped. special case handled and ignored in parseGroup
      injectMacroAsGroup(LAMBDA, start, pos, NOT_INVERSE);

      return t +
        ' && !void LOG(" - it\'s a constant")' +
        ' && ' + (invert?'!':'') + '('+hardcoded[s]+')' +
        '';
    }

    if (macros[s]) {
      // note: symbols are inside tokens so never toplevel
      return t +
        ' && !void LOG(" - it\'s a macro")' +
        injectMacroAsGroup(macros[s], start, pos, invert) +
        '';
    }

    reject('replaceSymbolInside: Unknown constant: ['+s+']');
  }
  function isIdentChar(c) {
    return ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '$' || c === '_');
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
      while ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_' || peeked === '$' || peeked === '-') {
        consumeThenSkipWhites();
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
    while (isIdentChar(peek())) name += query[pos++];
    return name;
  }

  function injectMacroAsGroup(macro, from, to, invert) {
    // Remove lastAtomStart...pos and replace it with macro
    // Wrap macro in a group, Regardless. This way we can simply always parse it as a group after the call.
    // Then reset pos and parse atom again
    // (special case for lambda; wont get grouped)

    if (macro !== LAMBDA) {
      var t = '//injectMacroAsGroup `'+query.slice(from, to)+'` -> `'+macro+'`\n';
      query = query.slice(0, from) + (invert?'(!(':'(') + macro+(invert?'))':')') + query.slice(to);
      WARN('Extrapolated query:', query);
      pos = from;
      return t;
    }

    query = query.slice(0, from) + LAMBDA + query.slice(to);
    WARN('Inserting lambda... ->', query);
    pos = from;
  }

  function parseQuantifiers(beforeAssignments, afterAssignments, matchStateNumber) {
    // [foo] 1
    // [foo] 1...
    // [foo] 1..2
    var uniqueLoopNum = ++counter;

    var min = 0;
    var max = 0; // 0 => token.length

    var peeked = peek();
    var startpos = pos; // for debugging

    if (peeked === '+') {
      min = 1;
      consumeThenSkipWhites();
    } else if (peeked === '?') {
      max = 1;
      consumeThenSkipWhites();
    } else if (peeked === '*') {
      // 0:0 is good.
      consumeThenSkipWhites();
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
          consumeThenSkipWhites('.');
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

    var innerCounter = ++counter;

    var result =
      //'{\n' +
      '// parseQuantifiers '+matchStateNumber+', loop id = '+uniqueLoopNum+'\n' +
        '// quantifier for this part of the query: `'+(query.slice(startpos, pos))+'`\n'+
        'var loopProtection'+uniqueLoopNum+' = 20000;\n' +
        'var min'+uniqueLoopNum+' = '+min+';\n' +
        'var max'+uniqueLoopNum+' = '+max+' || tokens.length;\n' +
        'var count'+uniqueLoopNum+' = 0;\n' +
        'var startIndex'+uniqueLoopNum+' = index; // backup for backtracking\n' +
        'do {\n' +
          beforeAssignments +
            parseAssignments(FORCE_PARAMFILL) +
            ', count'+uniqueLoopNum+'+1' +
            ', ' + callbackMode +
            ', min'+uniqueLoopNum +
          afterAssignments +
        '} while(queryPassState_'+matchStateNumber+' !== FAIL_STATE && --loopProtection'+uniqueLoopNum+' > 0 && (++count'+uniqueLoopNum+' < max'+uniqueLoopNum+'));\n' +
        'if (loopProtection'+uniqueLoopNum+' <= 0) throw "Loop protection (quantifier)";\n' +
        'LOG("finished quantifier;", count'+uniqueLoopNum+', ">=", min'+uniqueLoopNum+', "=", count'+uniqueLoopNum+' >= min'+uniqueLoopNum+');\n' +
        // only check lower bound since upper bound is forced by the loop condition (`s` will override current value of group, but it was true at the start of the loop)
        'queryPassState_'+matchStateNumber+' = count'+uniqueLoopNum+' >= min'+uniqueLoopNum+' ? PASS_STATE : FAIL_STATE;\n' +
        // we reset the counter if the required number was not reached OR if it was optional and indeed not matched at all
        'if (queryPassState_'+matchStateNumber+' === FAIL_STATE || !count'+uniqueLoopNum+') index = startIndex'+uniqueLoopNum+';\n' +
      //'}\n' +
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
    consumeThenSkipWhites();

    return parseInt(s, 10);
  }

  WARN('Parsing query   :', query);
  var code = parseQuery();
  WARN('Final query     :', query);

  return (
    'function query(){\n'+
    '  // input query: '+inputQuery.replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'\n' +
    '  // final query: '+query.replace(/[\n\r\u2028\u2029]/g, '\u21b5')+'\n' +
//  '  if(index===2)debugger;'+
    '  // query start..\n' +
       code+'\n' +
    '  // query end..\n' +
//  '  if(index===0)debugger;'+
    // hmmmmm if we check PASS_STATE a query can't match "nothing". i think that's what we want? we shouldnt accept NEW_STATE here
    '  return queryPassState_1 === PASS_STATE;\n' +
    '}\n'
    );
}
