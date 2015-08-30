// compound symbols, based on the system in place or other symbols
// a symbol is either a group of tokens, or a(n implicit) group of conditions
// but never mixed.
// macros may reference constants directly. constants are always conditions (!)
var macros = module.exports = {
  // "system" customizable. these are vital to certain parts of Drew
  //WHITESPACE: '[WHITE | ASI | EOF]', // determines whitespace skipping
  '~': '[(WHITE & !NEWLINE) | ASI]*',

  // alias

  SPACE: '` `',
  TAB: '`\t`',

  LF: '`\\x0A`', // \n
  CR: '`\\x0D`', // \r
  CRLF: '`\\x0A\\x0D`',
  PS: '`\\u2028`',
  LS: '`\\u2029`',

  COMMA: '`,`',
  PLUS: '`+`',
  MIN: '`-`',
  MINUS: '`-`',
  DASH: '`-`',
  IS: '`=`',
  SEMI: '`;`',
  CURLY_OPEN: '`{`',
  CURLY_CLOSE: '`}`',
  PAREN_OPEN: '`(`',
  PAREN_CLOSE: '`)`',
  SQUARE_OPEN: '`[`',
  SQUARE_CLOSE: '`]`',

  SEMIASI: 'SEMI|ASI',

  // skip from current curly to after the next (group because param assignments are a problem otherwise)
  CURLY_PAIR: '(CURLY_OPEN & JUMP_TO_RHC)',
  SQUARE_PAIR: '(SQUARE_OPEN & JUMP_TO_RHS)',
  PAREN_PAIR: '(PAREN_OPEN & JUMP_TO_RHP)',

  BREAK: '`break`',
  CASE: '`case`',
  CATCH: '`catch`',
  CONTINUE: '`continue`',
  DEBUGGER: '`debugger`',
  DEFAULT: '`default`',
  DO: '`do`',
  ELSE: '`else`',
  FINALLY: '`finally`',
  FOR: '`for`',
  FUNCTION: '`function`',
  IF: '`if`',
  RETURN: '`return`',
  SWITCH: '`switch`',
  TRY: '`try`',
  THROW: '`throw`',
  VAR: '`var`',
  WHILE: '`while`',
  WITH: '`with`',
  STATEMENT_KEYWORD: 'BREAK | CASE | CONTINUE | DEBUGGER|  DEFAULT | DO | FOR | FUNCTION | IF | RETURN | SWITCH | TRY | THROW | VAR | WHILE | WITH',

  ADDITION: '{NUMBER}{PLUS}{NUMBER}',
};
