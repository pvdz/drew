// compound symbols, based on the system in place or other symbols
// a symbol is either a group of tokens, or a(n implicit) group of conditions
// but never mixed.
// macros may reference constants directly. constants are always conditions (!)
var macros = module.exports = {
  SPACE: '` `',
  TAB: '`\t`',

  LF: '`\\x0A`', // \n
  CR: '`\\x0D`', // \r
  CRLF: '`\\x0A\\x0D`',
  PS: '`\\u2028`',
  LS: '`\\u2029`',

  // alias
  SOF: 'STARTOFFILE',
  EOF: 'ENDOFFILE',
  SOL: 'STARTOFLINE',
  EOL: 'ENDOFLINE',

  COMMA: '`,`',
  PLUS: '`+`',
  MIN: '`+`',
  IS: '`=`',
  SEMI: '`;`',
  CURLY_OPEN: '`{`',
  CURLY_CLOSE: '`}`',
  PAREN_OPEN: '`(`',
  PAREN_CLOSE: '`)`',
  SQUARE_OPEN: '`[`',
  SQUARE_CLOSE: '`]`',

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

  FUNC_NAMED: '{FUNCTION}{IDENTIFIER}(FUNCTION_REST)',
  FUNC_ANON: '{FUNCTION}(FUNCTION_REST)',
  FUNC_OPT: '{FUNCTION}{IDENTIFIER}?(FUNCTION_REST)',
  FUNCTION_REST: '{PARENS}{CURLIES}',


  STATEMENT_HEADER: '{PARENS}',
  STATEMENT: '{STATEMENT_KEYWORD}(STATEMENT_HEADER)?'
};
