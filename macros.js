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

  FUNCTION_REST: '{PAREN_PAIR}{CURLY_PAIR}',
  FUNC_DECL: '{FUNCTION}{IDENTIFIER}(FUNCTION_REST)',
  FUNC_ANON: '{FUNCTION}(FUNCTION_REST)',
  FUNC_EXPR: '{FUNCTION}{IDENTIFIER}?(FUNCTION_REST)',

  STATEMENT_HEADER: '{PAREN_PAIR}',

  BLOCK_STMT: '{CURLY_PAIR}',
  TRY_STMT: '({TRY}(BLOCK_STMT)({CATCH}(STATEMENT_HEADER)(BLOCK_STMT)({FINALLY}(BLOCK_STMT))?|{FINALLY}(BLOCK_STMT)))',
  BREAK_STMT: '({BREAK}{IDENTIFIER}?{SEMIASI})',
  CASE_STMT: '({CASE}{EXPRESSION}{COLON})',
  CONTINUE_STMT: '({CONTINUE}{IDENTIFIER}?{SEMIASI})',
  DEBUGGER_STMT: '{DEBUGGER}{SEMIASI}',
  DEFAULT_STMT: '({DEFAULT}{COLON})',
  DO_STMT: '({DO}(STATEMENT){WHILE}(STATEMENT_HEADER){SEMIASI})',
  FOR_STMT: '({FOR}(STATEMENT_HEADER)(STATEMENT))',
  FUNC_STMT: '({FUNCTION}{IDENTIFIER}?{PAREN_PAIR}(BLOCK_STMT))',
  IF_STMT: '({IF}(STATEMENT_HEADER)(STATEMENT)({ELSE}{STATEMENT}))',
  RETURN_STMT: '({RETURN}(EXPRESSION)?{SEMIASI})',
  SWITCH_STMT: '({SWITCH}(STATEMENT_HEADER)(BLOCK_STMT)',
  THROW_STMT: '({THROW}[WHITE & !NEWLINE]*(EXPRESSION){SEMIASI})', // how do we verify that expression doesn't skip newlines anyways? test case: `return\nfoo;`
  VAR_STMT: '({VAR}({IDENTIFIER}({IS}{EXPRESSION})*)+{SEMIASI}',
  WHILE_STMT: '({WHILE}(STATEMENT_HEADER)(STATEMENT))',
  WITH_STMT: '({WITH}(STATEMENT_HEADER)(STATEMENT))',

  // this is how you could STATEMENT but a hardcoded approach is much much more efficient
  // this is also missing empty statement and expression statement...
  //STATEMENT: '(TRY_STMT | BREAK_STMT | CASE_STMT | CONTINUE_STMT | DEBUGGER_STMT | DEFAULT_STMT | DO_STMT | FOR_STMT | FUNC_STMT | IF_STMT | RETURN_STMT | SWITCH_STMT | THROW_STMT | VAR_STMT | WHILE_STMT | WITH_STMT)',

  ADDITION: '{NUMBER}{PLUS}{NUMBER}',
};
