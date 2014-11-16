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
    var s = '';
    var atom;

    while (atom = parseAtomMaybe(TOPLEVEL, OUTSIDE_TOKEN)) {
      if (atom) s += atom + '\n';
    }

    return s;
  }

  function parseAtomMaybe(top, insideToken){
    lastAtomStart = pos;

    var s = '';
    if (top === TOPLEVEL) s += 'if (!(true';

    if (peek('[')) s += ' && checkToken(symw()' + parseWhiteToken();
    else if (peek('{')) s += ' && checkTokenBlack(symb()' + parseBlackToken();
    else if (peek('(')) s += ' && checkGroup(symg()' + parseGroup(insideToken);
    else return false;

//    parseQuantifiers();
    s += parseAssignments();

    s += ')'; // to close the checkXXX(

    if (top === TOPLEVEL) s += ')) return false;';

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
  function parseGroup(insideToken) {
    assert('(');
    var s = '';

    while (true) {
      if (peek(')')) break;
      else if (peek('[')) s += parseAtomMaybe(NOT_TOPLEVEL, insideToken);
      else if (peek('{')) s += parseAtomMaybe(NOT_TOPLEVEL, insideToken);
      else if (peek('(')) s += parseAtomMaybe(NOT_TOPLEVEL, insideToken);
      else s += parseMatchConditions(insideToken);
    }

    assert(')');
    return s;
  }

  function parseMatchConditions(insideToken){
    var s = parseMatchParticle(insideToken);
    while (peek('|') || peek('&')) {
      var d = consume();

      s = ' && (true' + s + ' ' + d + d + ' true' + parseMatchParticle(insideToken) + ')';
    }

    return s;
  }

  function parseMatchParticle(insideToken) {
    if (peek('`')) return parseLiteral();
    if (peek('*')) return parseStar();
    if (peek('(')) return parseAtomMaybe(NOT_TOPLEVEL, insideToken);
    var peeked = peek();
    if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked === '$' || peeked === '_')) return parseSymbol(insideToken);
    if (pos >= rule.length) return true;

    reject(new Error('Unexpected state'));
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

  function parseStar() {
    assert('*');

    return ' && !!token()';
  }

  function parseSymbol(insideToken) {
    var start = pos;
    var s = consume();

    while (true) {
      var peeked = peek();
      if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_') {
        s += consume();
      }
      else break;
    }

    if (hardcoded[s]) return ' && ' + hardcoded[s];
    if (macros[s]) return injectMacro(macros[s], start, pos, insideToken);

    reject('Unknown constant: ['+s+']');
  }

  function parseAssignments() {
    var assignmentString = '';

    if (peek('=')) {
      // = number | identifier, no escapes
      var leftName = '';
      assert('='); // take =, skip whitespace
      while (true) {
        var peeked = rule[pos];
        if ((peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_') {
          leftName += rule[pos++];
        }
        else break;
      }
      // skip whitespace after name...
      --pos;
      consume();

      if (!leftName) reject('Missing valid var name after equal sign');
      assignmentString += ', \'' + leftName + '\'';

      if (peek() === ',') {
        assert(',');

        var rightName = '';
        while (true) {
          var peeked = rule[pos];
          if (peeked && (peeked >= 'a' && peeked <= 'z') || (peeked >= 'A' && peeked <= 'Z') || (peeked >= '0' && peeked <= '9') || peeked === '$' || peeked === '_') {
            rightName += rule[pos++];
          }
          else break;
        }
        // skip whitespace after name...
        --pos;
        consume();

        if (!rightName) reject('Missing valid second var name after equal sign');
        assignmentString += ', \'' + rightName + '\'';
      }
    }

    return assignmentString;
  }

  function injectMacro(macro, from, to, insideToken) {
    // remove lastAtomStart...pos and replace it with macro
    // then reset pos and parse atom again

    var s = '';

    rule = rule.slice(0, from) + macro + rule.slice(to);
    pos = from;

    if (peek('[') || peek('{') || peek('(')) return s + parseAtomMaybe(NOT_TOPLEVEL, insideToken);
    return s + parseMatchConditions();
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
    '  return true;\n' +
    '}\n'
    );
}
