// hardcoded conditions (symbol translates to the actual JS that you see)
// code is injected as is wrapped in parenthesis. so 'type(STRING)` -> (type(STRING))

var constants = module.exports = {
  // token type name vars (as governed and exposed by zeparser)
  STRING: 'type(STRING)',
  NUMBER: 'type(NUMBER)',
  REGEX: 'type(REGEX)',
  PUNCTUATOR: 'type(PUNCTUATOR)',
  IDENTIFIER: 'type(IDENTIFIER)',
  EOF: 'type(EOF)',
  ASI: 'type(ASI)',
  ERROR: 'type(ERROR)',
  WHITE: 'type(WHITE)',
  COMMENT: 'type(WHITE) && value()[0] === "/"',

  // custom hacks
  NEWLINE: 'isNewline(0)',

  STATEMENT_START: 'token().statementStart',
  STATEMENT: 'token().statementStart && (index = token().lastStatementToken.white)',

  // skip from current curly to after the next
  JUMP_TO_RHC: 'token().rhc && skipTo(token().rhc.white)',
  JUMP_TO_RHS: 'token().rhs && skipTo(token().rhs.white)',
  JUMP_TO_RHP: 'token().rhp && skipTo(token().rhp.white)',

  KEYWORD: 'token().isKeyword',

  // for test cases
  TRUE: 'true',
  FALSE: 'false',
  DEBUG: '!function(){debugger;}'
};
