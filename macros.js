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
  NEWLINE: '(LF | CR | CRLF | PS | LS)',

  SOL: '(NEWLINE | SOF)',
  EOL: '(NEWLINE | EOF)',

  STARTOFLINE: 'SOL',
  ENDOFLINE: 'EOL',
  STARTOFFILE: 'SOF',
  ENDOFFILE: 'EOF',

  COMMA: '`,`',
  PLUS: '`+`',

  VAR: '`var`',


  ADDITION: '{NUMBER}{PLUS}{NUMBER}'
};
