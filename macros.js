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

  VAR: '`var`',


  ADDITION: '{NUMBER}{PLUS}{NUMBER}'
};
