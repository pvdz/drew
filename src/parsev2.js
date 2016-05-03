window.drew = (function(){

  var input = '';
  var pos = 0;
  var len = 0;

  function parse(query) {
    input = query;
    len = query.length;
    pos = 0;

    parseAtoms();

    // clear memory
    input = '';
  }

  function skip(n) {
    pos += n;
  }
  function peek(n) {
    return input[pos + n];
  }
  function skipChar(c) {
    var d = input[pos++];
    if (d !== c) {
      // this is the slow path.
      --pos;
      reject(c);
    }
  }
  function skipIf(c) {
    if (peek(0) === c) {
      skip(1);
      return true;
    }
    return false;
  }
  function reject(c) {
    console.log([input]);
    throw new Error('fail, expecting ['+c+']('+ c.charCodeAt(0)+') at ['+pos+'] in ['+input+'], found ['+input[pos]+']('+(input[pos]||'').charCodeAt(0)+')');
  }

  function parseWhitesMaybe() {
    var had = false;
    while (pos < len && parseWhiteMaybe()) had = true;
    return had;
  }
  function parseWhiteMaybe() {
    var c = peek(0);
    if (parseWhitespaceMaybe(c)) {
      return true;
    }
    if (parseCommentMaybe(c)) {
      return true;
    }
    if (parseCallbackMaybe(c)) {
      return true;
    }

    return false;
  }
  function parseWhitespaceMaybe(c) {
    switch (c) {
      case ' ':
      case '\t':
      case '\n':
      case '\r':
        ++pos;
        return true;
    }
    return false;
  }
  function parseCommentMaybe(c) {
    var n = 0;
    if (c === ':') {
      if (peek(++n) === ':') {
        if (peek(++n) === ':') {
          // :::
          while (++n < len) {
            if (peek(n) === ':' && peek(++n) === ':' && peek(++n) === ':') {
              ++n;
              break;
            }
          }
        } else {
          // ::
          while (++n < len) {
            var c = peek(n);
            if (c === '\n' || c === '\r') break;
          }
        }
      } else {
        // :
        do {
          var c = peek(n);
          if (c === ';') {
            ++n;
            break;
          }
          if (!(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c === '$' || c === '_' || c === ' ' || c === '\t' || c == '\n' || c === '\r')) {
            break;
          }
        } while (++n < len);
        console.log('>>', [c])
      }
      //console.log([input.slice(pos, pos + n)]);
      skip(n);
      return true;
    }
    return false;
  }
  function parseCallbackMaybe(c) {
    if (c === '#') {
      skip(1);
      return true;
    }
    return false;
  }

  function parseAtoms() {
    parseAtom();
    if (parseOuterOperatorMaybe()) {
      // note: `c` is the operator, & or |
      return parseAtoms();
    }
  }

  function parseAtom() {
    parseWhitesMaybe()
    switch (peek(0)) {
      case '[':
        parseTokenWhite();
        return true;
      case '{':
        parseTokenBlack();
        return true;
      case '(':
        parseOuterGroup();
        return true;
      case '<':
        parseSkipLeft();
        return true;
      case '>':
        parseSkipRight();
        return true;
      case '~':
        parseCustomSeek();
        return true;
      case '-':
        parseArrow(); // TODO: same as [*]* so maybe drop this? or repurpose it
        return true;
    }
    reject('?');
    return false;
  }

  function parseTokenWhite() {
    skip(1);
    parseInnerConditions();
    parseWhitesMaybe();
    skipChar(']');
  }
  function parseTokenBlack() {
    skip(1);
    parseInnerConditions();
    parseWhitesMaybe();
    skipChar('}');
  }
  function parseOuterGroup() {
    skip(1);
    parseAtoms();
    parseWhitesMaybe();
    skipChar(')');
  }

  function parseSkipLeft() {
    skip(1);
    if (skipIf('<')) {
      // skip black token to the left
    } else {
      // skip white token to the left
    }
  }
  function parseSkipRight() {
    skip(1);
    if (skipIf('>')) {
      // skip black token to the right
    } else {
      // skip white token to the right
    }
  }
  function parseCustomSeek() {
    skip(1);
  }
  function parseArrow() {
    if (peek(1) === '-' && peek(2) === '>') {
      skip(3);
      // do `[*]*`
    }
  }

  function parseOuterOperatorMaybe() {
    parseWhitesMaybe()
    if (peek(0) === '&' && peek(1) === '&') {
      skip(2);
      return true;
    }
    if (peek(0) === '|' && peek(1) === '|') {
      skip(2);
      return true;
    }
    return false;
  }

  function parseInnerConditions() {
    if (!parseInnerConditionMaybe()) {
      reject('?');
    }
    if (parseOuterOperatorMaybe()) {
      parseInnerConditions();
    }
  }
  function parseInnerConditionMaybe() {
    parseWhitesMaybe();
    var c = peek(0);
    switch (c) {
      case '`':
        parseLiteral();
        break;

      case '/':
        parseRegex();
        break;

      case '(':
        parseInnerGroup();
        break;

      case '*':
        skip(1);
        break;

      case 'a':
      case 'b':
      case 'c':
      case 'd':
      case 'e':
      case 'f':
      case 'g':
      case 'h':
      case 'i':
      case 'j':
      case 'k':
      case 'l':
      case 'm':
      case 'n':
      case 'o':
      case 'p':
      case 'q':
      case 'r':
      case 's':
      case 't':
      case 'u':
      case 'v':
      case 'w':
      case 'x':
      case 'y':
      case 'z':
      case 'A':
      case 'B':
      case 'C':
      case 'D':
      case 'E':
      case 'F':
      case 'G':
      case 'H':
      case 'I':
      case 'J':
      case 'K':
      case 'L':
      case 'M':
      case 'N':
      case 'O':
      case 'P':
      case 'Q':
      case 'R':
      case 'S':
      case 'T':
      case 'U':
      case 'V':
      case 'W':
      case 'X':
      case 'Y':
      case 'Z':
      case '$':
      case '_':
        parseMacro();
        break;

      default:
        return false;
    }
    return true;
  }

  function parseMacro() {
    parseWhitesMaybe();
    var n = 1;
    var c = peek(n);
    while (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c === '$' || c === '_') c = peek(++n);
    skip(n);
  }
  function parseInnerGroup() {
    skip(0);
    parseInnerConditions();
    parseWhitesMaybe();
    skipChar(')');
  }
  function parseLiteral() {
    parseWhitesMaybe();
    var n = 1;
    var c = peek(n);
    while (c !== '`' && n < len) {
      c = peek(++n);
      if (c === '\\') c = peek(++n);
    }
    skip(n);
    skipChar('`');
    if (skipIf('i')) {
      // case insensitive
    }
  }
  function parseRegex() {
    parseWhitesMaybe();
    var n = 1;
    var c = peek(n);
    while (c !== '/' && n < len) {
      c = peek(++n);
      if (c === '\\') c = peek(++n);
    }
    skip(n);
    skipChar('/');
    while (pos < len && (skipIf('i') || skipIf('m')));
  }

  return parse;
})();
