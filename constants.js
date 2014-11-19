// hardcoded conditions (symbol translates to the actual JS that you see)

var constants = module.exports = {
  // tokens (as governed by zeparser)
  STRING: 'type(STRING)',
  NUMBER: 'type(NUMBER)',
  REGEX: 'type(REGEX)',
  PUNCTUATOR: 'type(PUNCTUATOR)',
  IDENTIFIER: 'type(IDENTIFIER)',
  EOF: 'type(EOF)',
  ASI: 'type(ASI)',
  ERROR: 'type(ERROR)',
  WHITE: 'type(WHITE)',

  // custom hacks
  NEWLINE: 'isNewline(0)',
  STARTOFLINE: '(!index || isNewline(-1))',
  ENDOFLINE: '(token(index+1).type === EOF || isNewline(1))',
  STARTOFFILE: '!index',
  ENDOFFILE: 'token(index-1).type === EOF',
};
