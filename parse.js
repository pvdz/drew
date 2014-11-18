module.exports = parse;

// TODO: drop `length` from args object as soon as we encounter one non-int key

function parse(rule, hardcoded, macros) {
//  console.log('Parsing rule:', [rule]);

  var pos = 0;
  var inputRule = rule;
  var lastAtomStart = 0;

  var TOPLEVEL = true;
  var NOT_TOPLEVEL = false;
  var INSIDE_TOKEN = true;
  var OUTSIDE_TOKEN = false;

  var counter = 0;
  var tokenCounter = 0;

  function white(c) {
    return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\r\n';
  }

  function consume() {
    var c = rule[pos++];

    while (white(rule[pos])) ++pos;

    return c;
  }
  function peek(c) {
    var d = rule[pos];
    if (c) return c === d;
    return d;
  }
  function assert(c) {
    if (c !== rule[pos]) reject('fail, expecting ['+c+'] at ['+pos+'] in ['+rule+'], found ['+rule[pos]+']');
    consume();
  }
  function reject(m){
    throw new Error(m);
  }

  function parseRule() {
    var currentGroup = counter++;
    var s = 'var group'+currentGroup+' = false;\n';
    do {
      s += toplevelPart(currentGroup);

      if (peek('|')) {
        consume();
        s += 'if /*parserule*/(!group'+currentGroup+') ';
      } else if (peek('&')) {
        consume();
        s += 'if /*parserule*/(group'+currentGroup+') ';
      } else {
        break;
      }
    } while(true);

    return s;
  }

  function toplevelPart(currentGroup) {
    var s = '';
    var atom;
    var first = true;
    while (atom = parseAtomMaybe(TOPLEVEL, OUTSIDE_TOKEN, currentGroup, first)) {
      if (atom) {
        if (!first) s += 'if /*toplevelPart*/(group0) ';
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

  function parseAtomMaybe(top, insideToken, tokenGroupNumber, noCurlies){
    lastAtomStart = pos;
    var currentAtomIndex = counter++;

    var s = '';

    if (peek('[')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      if (noCurlies) s += '{\n';
      s += '// white token '+currentAtomIndex+':'+(tokenCounter++)+'\n';
      s += 'group'+tokenGroupNumber+' = checkToken(symw()' + parseWhiteToken() + parseAssignments() + ');\n';
      if (noCurlies) s += '}\n';
    } else if (peek('{')) {
      if (insideToken) reject('Trying to parse another token while inside a token');
      if (noCurlies) s += '{\n';
      s += '// black token '+currentAtomIndex+':'+(tokenCounter++)+'\n';
      s += 'group'+tokenGroupNumber+' = checkTokenBlack(symb()' + parseBlackToken() + parseAssignments() + ');\n';
      if (noCurlies) s += '}\n';
    } else if (peek('(')) {
      if (insideToken) {
        s += ' && checkConditionGroup(symgc()' + parseGroup(INSIDE_TOKEN) + ')';
      } else {
        if (!insideToken && !noCurlies) s += '{\n';
        s += '// start group '+currentAtomIndex+'\n';
        s += 'var group'+currentAtomIndex+' = false;\n';
        s += 'symgt();\n';
        s += parseGroup(OUTSIDE_TOKEN, currentAtomIndex);
        s += 'checkTokenGroup(group' + currentAtomIndex + parseAssignments() + ');\n';
        s += 'group'+tokenGroupNumber+' = group'+currentAtomIndex+'\n';
        s += '// end group '+currentAtomIndex+'\n';
        if (!insideToken && !noCurlies) s += '}\n';
      }
    } else {
      return false;
    }

//    parseQuantifiers();


    return s;
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
    var startOfChain = 1;
    while (true) {
      if (peek(')')) break;
      else if (peek('[')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if /*parsegroup1*/(group'+tokenGroupIndex+') ';
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, startOfChain);
      } else if (peek('{')) {
        if (insideToken) reject('Trying to parse another token while inside a token');
        if (!startOfChain) s += 'if /*parsegroup2*/(group'+tokenGroupIndex+') ';
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex, startOfChain);
      } else if (peek('(')) {
        s += parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex);
      } else if (peek('|')) {
        consume();
        if (insideToken) reject('Expecting ors to be caught in parseMatchConditions');
        startOfChain = 2; // first is immediately dec'ed, 2 makes sure it survives one loop
        s += 'if /*parsegroup3*/(!group'+tokenGroupIndex+') ';
      } else if (peek('&')) {
        consume();
        if (insideToken) reject('Expecting ands to be caught in parseMatchConditions');
        else reject('No need to put & between tokens (just omit them), only allowed between match conditions');
      } else {
        s += parseMatchConditions(insideToken, tokenGroupIndex);
      }
      if (startOfChain) startOfChain--;
    }

    assert(')');
    return s;
  }

  function parseMatchConditions(insideToken, tokenGroupIndex){
    var s = parseMatchParticle(insideToken, tokenGroupIndex);
    while (peek('|') || peek('&')) {
      var d = consume();

      s = ' && (true' + s + ' ' + d + d + ' true' + parseMatchParticle(insideToken, tokenGroupIndex) + ')';
    }

    return s;
  }

  function parseMatchParticle(insideToken, tokenGroupIndex) {
    if (peek('`')) {
      if (!insideToken) reject('Trying to parse a literal while not inside a tag');
      return parseLiteral();
    }
    if (peek('*')) {
      if (!insideToken) reject('Unit test: inconsistent; is this star a quantifier or condition?');
      return parseStarCondition();
    }
    if (peek('(')) return parseAtomMaybe(NOT_TOPLEVEL, insideToken);
    var peeked = peek();
    if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked === '$' || peeked === '_')) return parseSymbol(insideToken, tokenGroupIndex);
    if (pos >= rule.length) return true;

    reject(new Error('Unexpected state [index='+pos+'][peek='+peek()+'][rule='+rule+']'));
  }

  function parseLiteral() {
    // take care with consume() in this function; it skips whitespace, even in literals.
    ++pos; // dont consume (skips whites)
    var s = '';
    while (true) {
      var peeked = peek();
      if (peeked === '`') break;

      if (peeked === '\\') {
        s += rule[pos++];

        if (rule[pos+1].toLowerCase() === 'u') {
          var a = rule[pos+2].toLowerCase();
          if ((a < '0' || a > '9') && (a < 'a' || a > 'f')) reject('Unicode escape must be 0-9a-f, was ['+a+']');
          var b = rule[pos+3].toLowerCase();
          if ((b < '0' || b > '9') && (b < 'a' || b > 'f')) reject('Unicode escape must be 0-9a-f, was ['+b+']');
          var c = rule[pos+4].toLowerCase();
          if ((c < '0' || c > '9') && (c < 'a' || c > 'f')) reject('Unicode escape must be 0-9a-f, was ['+c+']');
          var d = rule[pos+5].toLowerCase();
          if ((d < '0' || d > '9') && (d < 'a' || d > 'f')) reject('Unicode escape must be 0-9a-f, was ['+d+']');

          s += 'u'+a+b+c+d;
        } else if (rule[pos+1].toLowerCase() === 'x') {
          var a = rule[pos+2].toLowerCase();
          if ((a < '0' || a > '9') && (a < 'a' || a > 'f')) reject('Unicode escape must be 0-9a-f, was ['+a+']');
          var b = rule[pos+3].toLowerCase();
          if ((b < '0' || b > '9') && (b < 'a' || b > 'f')) reject('Unicode escape must be 0-9a-f, was ['+b+']');

          s += 'x'+a+b;
        } else {
          s += rule[pos++];
        }
      } else {
        s += rule[pos++];
      }
    }
    assert('`');

    var r = s.replace(/'/g, '\\\'');
    var t = ' && value(\'' + r + '\')';

    return t;

//    return "(console.log(value(), '<->', '"+r+"'), "+t+")";

  }

  function parseStarCondition() {
    assert('*');

    return ' && !!token()';
  }

  function parseSymbol(insideToken, tokenGroupIndex) {
    var start = pos;
    var s = consume();

    while (true) {
      var peeked = peek();
      if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_') {
        s += consume();
      }
      else break;
    }

    if (hardcoded[s]) return ' && ' + hardcoded[s]; // TOFIX: detect token state and report?
    if (macros[s]) return injectMacro(macros[s], start, pos, insideToken, tokenGroupIndex);

    reject('Unknown constant: ['+s+']');
  }

  function parseAssignments() {
    var assignmentString = '';

    if (peek('=')) {
      assert('='); // take =, skip whitespace

      if (peek(',')) { // [foo]=,1
        s += ', undefined';
      } else {
        s += parseAssignmentKey();
      }

      if (peek() === ',') {
        assert(',');
        s += parseAssignmentKey();
      }
    }

    return assignmentString;
  }
  function parseAssignmentKey() {
    var name = '';
    while (true) {
      var peeked = rule[pos];
      if (peeked && (peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_') {
        name += rule[pos++];
      }
      else break;
    }
    // skip whitespace after name...
    --pos;
    consume();

    if (!name) reject('Missing valid var name after equal sign');

    return ', \'' + name + '\'';
  }

  function injectMacro(macro, from, to, insideToken, tokenGroupIndex) {
    // remove lastAtomStart...pos and replace it with macro
    // then reset pos and parse atom again
    var s = '';

    rule = rule.slice(0, from) + macro + rule.slice(to);
    pos = from;

    if (peek('[') || peek('{') || peek('(')) return s + parseAtomMaybe(NOT_TOPLEVEL, insideToken, tokenGroupIndex);
    return s + parseMatchConditions(insideToken, tokenGroupIndex);
  }

  var code = parseRule();

  return (
    'function rule(){\n'+
    '  // input rule: '+inputRule+'\n' +
    '  // final rule: '+rule+'\n' +
//  '  if(index===0)debugger;'+
    '  // rule start..\n' +
       code+'\n' +
    '  // rule end..\n' +
//  '  if(index===0)debugger;'+
    '  return group0;\n' +
    '}\n'
    );
}
