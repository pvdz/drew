// todo:
// - some e2e sanity tests
// - throw if not all input can be consumed
// - alias `[\n]` to `[IS_NEWLINE]` ? or is that too prone to confusion?

(function(exports) {
  var logging = typeof Drew === 'object' ? Drew.logging : require('./logging').logging;
  var LOG = logging.LOG;
  var MED = logging.MED;
  var HI = logging.HI;
  var DESC = logging.DESC;
  var GROPEN = logging.GROPEN;
  var GRCLOSE = logging.GRCLOSE;


  // BODY-START

  var input = '';
  var pos = 0;
  var len = 0;
  var codes;

  // inner and outer
  var ERROR = 99; // not negative so type is unsigned-byte-able. throws an error if picked.
  var GROUP = 0;
  var NOT = 1;

  // inner condition types
  var REGEX = 2;
  var LITERAL = 3;
  var STAR = 4;
  var MACRO = 5;

  // outer condition types
  var WHITE = 2;
  var BLACK = 3;
  var SEEK_BACK = 4;
  var SEEK_NEXT = 5;
  var SEEK_ARROW = 6;
  var SEEK_FORWARD = 7;
  var TYPE_CARET = 8;
  var TYPE_DOLLAR = 9;

  function compileDrew(query, asFunc, onlyFunc, forMacro) {
    if (onlyFunc) {
      return toFunction(query);
    }

    input = query;
    len = query.length;
    pos = 0;
    codes = [];

    if (forMacro) {
      LOG('Parsing for a macro specifically');
      var s = parseInnerConditions();
    } else {
      var s = parseAtoms();
      var c = codes.map(function (code, i) {
        return 'function c' + i + '(){ return ' + code.replace(/\n/g, '\\n') + '; }';
      }).join('\n');
    }

    var code = c + '\nreturn ' + s.replace(/\n/g, '\\n');

    // clear memory
    input = '';
    codes = undefined;

    if (asFunc) {
      return toFunction(code);
    }

    return code;
  }

  function toFunction(code) {
    return Function('and', 'or', 'then', 'macro', 'token', 'prev', 'next', 'seek', 'arrow', 'not', 'current', 'value', 'seekTo', 'caret', 'dollar', 'DESC', code);
  }

  function escape(desc) {
    return desc.replace(/\n/g, '\u21b5').replace(/"/g, '\\"');
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
    HI('query with error:', [input]);
    throw new Error(
      'fail, expecting [' + c + '](' + c.charCodeAt(0) + ') ' +
      'at [' + pos + '] ' +
      'found [' + input[pos] + '](' + (input[pos] || '').charCodeAt(0) + ') ' +
      'error at #|#: ' + input.slice(Math.max(0, pos - 20), pos) + '#|#' + input.slice(pos, Math.min(len, pos + 20))
    );
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
      }
      skip(n);
      return true;
    }
    return false;
  }

  function parseAtoms() {
    var start = pos;
    var s = parseAtom();
    var last = '';
    do {
      var after = pos;
      var t = parseAmpsPipesMaybe();
      var mid = pos;
      if (t) {
        // note: `t` is the operator, & or |
        if (t === '&') {
          var lid = cache(s);
          var rid = cache(parseAtoms());
          last = 'and(c' + lid + ', c' + rid + ', "' + escape(input.slice(start, after)) + '", "' + escape(input.slice(mid, pos)) + '")';
        } else if (t === '|') {
          var lid = cache(s);
          var rid = cache(parseAtoms());
          last = 'or(c' + lid + ', c' + rid + ', "' + escape(input.slice(start, after)) + '", "' + escape(input.slice(mid, pos)) + '")';
        } else {
          reject('UNKNOWN_OP[' + t + ']');
        }
      } else {
        last = parseAtomMaybe();
        if (last) {
          var lid = cache(s);
          var rid = cache(last);
          last = 'then(c' + lid + ', c' + rid + ', "' + escape(input.slice(start, after)) + '", "' + escape(input.slice(mid, pos)) + '")';
        }
      }
      if (last) s = last;
    } while (last);

    return s;
  }

  function parseAtomMaybe() {
    return _parseAtom(true);
  }

  function parseAtom() {
    return _parseAtom(false);
  }

  function _parseAtom(maybe) {
    parseWhitesMaybe()

    // if true will parse an atom after parsing quantifier/designator
    // and use its parsed atom result as the condition
    var scopesAtom = false;

    // parse quantifiers? only disabled for certain atoms (like seek)
    var parseQuantifiers = true;

    // parse designators? pretty much all atoms allow this
    var parseDesignators = true;

    var start = pos;
    var type = ERROR;
    var condition = '';

    switch (peek(0)) {
      case '[':
        condition = parseTokenWhite();
        type = WHITE;
        break;

      case '{':
        condition = parseTokenBlack();
        type = BLACK;
        break;

      case '(':
        condition = parseOuterGroup();
        type = GROUP;
        break;

      case '<':
        condition = parseSkipLeft();
        type = SEEK_BACK;
        break;

      case '>':
        condition = parseSkipRight();
        type = SEEK_FORWARD;
        break;

      case '~':
        // more efficient way of [*]*
        // parse this here because we need to parse the designator explicitly before parsing the scoped atom
        // it's a little ugly but it works, i can live with it.
        skip(1); // ~
        type = SEEK_NEXT;
        scopesAtom = true;
        parseQuantifiers = false; // there's no point
        break;

      case '!':
        skip(1); // !
        scopesAtom = true;
        type = NOT;
        parseQuantifiers = false; // there's no point
        break;

      case '-':
        // --> is seek to next newline token
        // -->> is immediately after next newline token
        condition = parseArrow();
        type = SEEK_ARROW;
        break;

      case '^':
        condition = parseCaret();
        type = TYPE_CARET;
        break;

      case '$':
        condition = parseDollar();
        type = TYPE_DOLLAR;
        break;


      default:
        if (maybe) return '';
        reject('UNKNOWN_ATOM_START');
        return '';
    }


    var min = 1;
    var max = 1;

    if (parseQuantifiers) {
      parseWhitesMaybe();
      var c = peek(0);
      switch (c) {
        case '*':
          skip(1);
          min = 0;
          max = 0;
          break;

        case '?':
          skip(1);
          min = 0;
          max = 1;
          break;

        case '+':
          skip(1);
          min = 1;
          max = 0;
          break;

        default:
          var beforePos = pos;
          min = parseQuantifierMin();
          var hasMin = beforePos !== pos;
          var dots = parseDots();
          // if there was no min, only parse a max with three dots
          // if there was a min and three dots, dont parse a max
          // if there were no dots, dont parse a max
          // in other words, parse a max if there's a min
          if ((hasMin ? dots === 2 : dots === 3)) {
            beforePos = pos;
            max = parseQuantifierMax();
            var hasMax = beforePos !== pos;
            if (!hasMin && !hasMax) reject('EXPECTING_MAX_BECAUSE_DOTS');
            if (dots === 2 && !hasMax) reject('EXPECTING_MAX_WITH_TWO_DOTS');
          } else if (!hasMin && dots === 2) {
            reject('TWO_DOTS_MISSING_NUMBERS_LEFT');
          }
      }
    }

    var dstart = '';
    var dstop = '';

    if (parseDesignators) {
      parseWhitesMaybe();
      if (skipIf('=')) {
        parseWhitesMaybe();
        if (skipIf(',')) {
          dstop = parseIdentifier();
        } else {
          dstart = parseIdentifier();
          parseWhitesMaybe();
          if (skipIf(',')) {
            parseWhitesMaybe();
            dstop = parseIdentifier();
          }
        }
      }
    }

    if (scopesAtom) {
      if (pos >= len) reject('ATOM_SCOPES_ANOTHER_ATOM');
      condition = parseAtom();
    }

    var s = genForOuter(type, condition, min, max, dstart, dstop, input.slice(start, pos));

    return s;
  }

  function parseQuantifierMin() {
    var n = 0;
    var c = peek(n);
    while (c >= '0' && c <= '9' && pos + n < len) {
      c = peek(++n);
    }
    var min = parseInt(input.slice(pos, pos + n) || '1', 10);
    skip(n);
    return min;
  }

  function parseDots() {
    var k = 0;
    parseWhitesMaybe();
    if (peek(0) === '.') {
      skip(1);
      skipChar('.');
      if (skipIf('.')) {
        return 3;
      }
      return 2;
    }
    return 0;
  }

  function parseQuantifierMax() {
    parseWhitesMaybe();
    var n = 0;
    var c = peek(n);
    while (c >= '0' && c <= '9' && pos + n < len) {
      c = peek(++n);
    }
    if (n < 1) reject('DOTS_REQUIRES_MAX');
    var max = parseInt(input.slice(pos, pos + n), 10);
    skip(n);
    return max;
  }

  function parseTokenWhite() {
    skip(1);
    var s = parseInnerConditions();
    parseWhitesMaybe();
    skipChar(']');
    return s;
  }

  function parseTokenBlack() {
    skip(1);
    var s = parseInnerConditions();
    parseWhitesMaybe();
    skipChar('}');
    return s;
  }

  function parseOuterGroup() {
    skip(1);
    var s = parseAtoms();
    parseWhitesMaybe();
    skipChar(')');
    return s;
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

  function parseArrow() {
    if (peek(1) === '-' && peek(2) === '>') {
      skip(3);
    } else {
      reject('UNEXPECTED_DASH_WAS_NOT_ARROW');
    }
  }

  function parseCaret() {
    if (peek(1) === '^') {
      // start of file only
      skip(2);
      return 2;
    } else {
      // start of any line
      skip(1);
      return 1;
    }
  }

  function parseDollar() {
    if (peek(1) === '^') {
      // end of file only
      skip(2);
      return 2;
    } else {
      // end of any line
      skip(1);
      return 1;
    }
  }

  function parseAmpsPipesMaybe() {
    // either parse two pipes or two amps or nothing
    parseWhitesMaybe()
    if (peek(0) === '&') {
      if (peek(1) === '&') skip(2);
      else skip(1);
      return '&';
    }
    if (peek(0) === '|') {
      if (peek(1) === '|') skip(2);
      else skip(1);
      return '|';
    }
    return '';
  }

  function parseInnerConditions() {
    var s = parseInnerConditionMaybe();
    if (!s) reject('EXPECTING_INNER_CONDITION');

    var op = parseAmpsPipesMaybe();
    if (op) {
      return s + ' ' + op + op + ' ' + parseInnerConditions();
    }
    return s;
  }

  function parseInnerConditionMaybe() {
    parseWhitesMaybe();
    var c = peek(0);
    switch (c) {
      case '`':
        return parseLiteral();

      case '/':
        return parseRegex();

      case '(':
        return parseInnerGroup();

      case '*':
        skip(1);
        return genForInner(STAR, undefined, undefined, '*');

      case '!':
        var start = pos;
        skip(1);
        var cond = parseInnerConditionMaybe();
        if (!cond) reject('NOT_MUST_HAVE_CONDTION');
        return genForInner(NOT, cond, undefined, input.slice(start, pos));

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
        return parseMacro();

      default:
        return '';
    }
    reject('REACHED_UNREACHABLE_PLACE_GREAT');
  }

  function parseMacro() {
    parseWhitesMaybe();
    var start = pos;
    var n = 1;
    var c = peek(n);
    while (pos + n < len && (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c === '$' || c === '_')) c = peek(++n);
    var macro = input.slice(pos, pos + n);
    skip(n);

    // TODO: inline the macro or constant

    return genForInner(MACRO, macro, undefined, input.slice(start, pos));
  }

  function parseInnerGroup() {
    var start = pos;
    skip(1);
    var s = parseInnerConditions();
    parseWhitesMaybe();
    skipChar(')');

    return genForInner(GROUP, s, undefined, input.slice(start, pos));
  }

  function parseLiteral() {
    parseWhitesMaybe();
    var start = pos;
    var n = 1;
    var c = peek(n);
    while (c !== '`' && pos + n < len) {
      if (c === '\\') c = peek(++n);
      c = peek(++n);
    }
    var lit = input.slice(pos + 1, pos + n);
    skip(n);
    skipChar('`');
    var i = false;
    if (skipIf('i')) {
      i = 'i'; // case insensitive
    }

    return genForInner(LITERAL, lit, i, input.slice(start, pos));
  }

  function parseRegex() {
    parseWhitesMaybe();
    var start = pos;
    var n = 1;
    var c = peek(n);
    while (c !== '/' && pos + n < len) {
      c = peek(++n);
      if (c === '\\') c = peek(++n);
    }
    if (peek(n) === '/') ++n;
    var flags = '';
    c = peek(n);
    while (pos < len && (c === 'i' || c === 'm')) {
      c = peek(++n);
    }
    var rex = input.slice(pos, pos + n);
    skip(n);

    return genForInner(REGEX, rex, undefined, input.slice(start, pos));
  }

  function parseIdentifier() {
    parseWhitesMaybe();
    var n = 0;
    var c = peek(n);
    while (pos + n < len && (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c === '$' || c === '_')) c = peek(++n);
    var ident = input.slice(pos, pos + n);
    skip(n);

    return ident;
  }

  function cache(code) {
    var pos = codes.indexOf(code);
    if (pos < 0) {
      pos = codes.length;
      codes.push(code);
    }
    return pos;
  }

  function genForInner(type, body, rest, desc) {
    desc = escape(desc);

    switch (type) {
      case GROUP:
        return 'DESC(current(), ' + body + ', "' + desc + '")';

      case REGEX:
        return 'DESC(current(), ' + body + '.test(value()), "' + desc + '")';

      case LITERAL:
        if (rest) { // case insensitive
          return 'DESC(current(), value().toLowerCase() === "' + body.replace(/"/g, '\\"') + '".toLowerCase(), "' + desc + '")';
        }
        return 'DESC(current(), value() === "' + body.replace(/"/g, '\\"') + '", "' + desc + '")';

      case STAR:
        return 'DESC(current(), true, "' + desc + '")';

      case MACRO:
        return 'DESC(current(), macro("' + body.replace(/"/g, '\\"') + '"), "' + desc + '")';

      case NOT:
        return 'DESC(current(), !' + body + ', "' + desc + '")';
    }

    throw 'fail, type=' + type;
  }

  function genForOuter(type, condition, min, max, desigStart, desigStop, desc) {
      desc = escape(desc);
      switch (type) {
        case GROUP:
          var tname = 'group';
        // fallthrough
        case WHITE:
          if (!tname) tname = 'white';
        // fallthrough
        case BLACK:
          if (!tname) tname = 'black';
          return 'token("' + tname + '", c' + cache(condition) + ', ' + min + ', ' + max + ', "' + desigStart + '", "' + desigStop + '", "' + desc + '")';

        case SEEK_FORWARD:
          return 'next(' + min + ', ' + max + ', "' + desigStart + '", "' + desigStop + '", "' + desc + '")';
        case SEEK_BACK:
          return 'prev(' + min + ', ' + max + ', "' + desigStart + '", "' + desigStop + '", "' + desc + '")';
        case SEEK_NEXT:
          return 'seek(c' + cache(condition) + ', "' + desigStart + '", "' + desigStop + '", "' + desc + '")';
        case SEEK_ARROW:
          return 'arrow("' + desigStart + '", "' + desigStop + '", "' + desc + '")';
        case NOT:
          return 'not(c' + cache(condition) + ', "' + desc + '")';
        case TYPE_CARET:
          return 'caret(' + (condition === 2) + ', "' + desc + '")';
        case TYPE_DOLLAR:
          return 'dollar(' + (condition === 2) + ', "' + desc + '")';
      }

      reject('UNKNOWN_OUTER_TYPE');
      return '';
    }

  // BODY-STOP

  exports.compileDrew = compileDrew;
})(typeof module === 'object' ? module.exports : window.Drew);
