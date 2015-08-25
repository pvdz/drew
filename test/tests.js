// this tester callback replaces the token in first arg with '@', second with '$', other args with '#'
// so callback args get: 0=@, 1=$, 2... = #
// note: tests are called in `once` mode, meaning they'll exit after the first match
var tests = module.exports = [
  [
    '[SPACE]',
    'var a = 20;',
    'var@a = 20;'
  ],
  [
    '[SPACE | TAB]',
    'var a\t= 20;',
    'var@a\t= 20;'
  ],
  [
    '[SPACE][COMMA][SPACE]',
    '1,  1  ,1  ,  1',
    '1,  1  ,1 @,  1',
  ],

  [
    '^[`b`]',
    'a;\nb;',
    'a;\n@;',
    '^ means last consumed black or white token should be newline or start of input'
  ],
  [
    '[NEWLINE]^[`b`]',
    'a;\nb;',
    'a;@b;',
    '^ should not consume a token'
  ],
  [
    '^[`a`]',
    'a;\nb;',
    '@;\nb;',
    '^ means last consumed black or white token should be newline or start of input'
  ],
  [
    '^^[`a`]',
    'a;\nb;',
    '@;\nb;',
    '^^ passes if we have not yet consumed a token'
  ],
  [
    '^^[`b`]',
    'a;\nb;',
    'a;\nb;',
    '^^ passes if we have not yet consumed a token'
  ],
  [
    '~^[`b`]',
    'a;\n  b;',
    'a;\n  b;',
    '~ means consume white tokens until current is black. then check for ^. since prev token will not be newline the query fails.'
  ],
  [
    '~[`a`]|~[`b`]',
    '  a;  b;',
    '  @;  b;',
    // the ~ wont seek at all when at the start of input
    // the ~ wont seek when it's the start of the query (effectively a noop)
    // the runner applies the query starting at every index so at index 2, the ~ is ignored and `a` is found; a match
    'matches a when applying the rule starting at index 2 (!)'
  ],
  [
    '[`x`][`;`]~[`a`]|~[`b`]',
    'x;  a;  b;',
    '@;  a;  b;',
    'same as before but with leading stuff to force ~ to seek'
  ],
  [
    '(~[`a`]|~[`b`])*',
    '  a;  b;',
    '@ a;  b;',
    'equivalent to matching nothing (so anything works)'
  ],
  [
    '(~[`a`]|~[`b`])+',
    '  a;  b;',
    '  @;  b;',
    'reset ~ after match, grouped repeat (tbd, match should start at [a])'
  ],
  [
    '((~[`a`])|(~[`b`]))|(~[`c`])',
    '  a;  b;  c;',
    '  @;  b;  c;',
    'reset ~ after match, with groups, dangerously required disambiguation'
  ],
  [
    '(((~[`a`])|(~[`b`]))|(~[`c`]))*',
    '  a;  b;  c;',
    '@ a;  b;  c;',
    'matches empty string'
  ],
  [
    '(((~[`a`])|(~[`b`]))|(~[`c`]))+',
    '  a;  b;  c;',
    '  @;  b;  c;',
    'reset ~ after match, with groups, dangerously required disambiguation, grouped repeat (tbd, match should start at [a])'
  ],
  [
    '(~[`a`]|~[`b`])|~[`c`]',
    '  a;  b;  c;',
    '  @;  b;  c;',
    'reset ~ after match, with groups'
  ],
  [
    '((~[`a`]|~[`b`])|~[`c`])*',
    '  a;  b;  c;',
    '@ a;  b;  c;',
    'matches empty string'
  ],
  [
    '((~[`a`]|~[`b`])|~[`c`])+',
    '  a;  b;  c;',
    '  @;  b;  c;',
    'reset ~ after match, with groups, grouped repeat'
  ],
  [
    '~[`a`]|(~[`b`]|~[`c`])',
    '  a;  b;  c;',
    '  @;  b;  c;',
    'reset ~ after match, with groups swapped'
  ],
  [
    '(~[`a`]|(~[`b`]|~[`c`]))*',
    '  a;  b;  c;',
    '@ a;  b;  c;',
    'matches empty string'
  ],
  [
    '(~[`a`]|(~[`b`]|~[`c`]))+',
    '  a;  b;  c;',
    '  @;  b;  c;',
    'reset ~ after match, with groups swapped, grouped repeat'
  ],
  [
    '{`b`}',
    'a;\n  b;',
    'a;\n  @;',
    '~[x] is equal to {x}'
  ],
  [
    '^{`b`}',
    'a;\n  b;',
    'a;\n  @;',
    '~[x] is equal to {x}'
  ],
  [
    '^~[`b`]',
    'a;\n  b;',
    'a;\n  @;',
    '~[x] is equal to {x}'
  ],
  [
    '{`a`}',
    '  a;\n  b;',
    '  @;\n  b;',
    '~[x] is equal to {x}'
  ],
  [
    '^{`a`}',
    '  a;\n  b;',
    '  @;\n  b;',
    '~[x] is equal to {x}'
  ],
  [
    '^~[`b`]',
    '  a;\n  b;',
    '  a;\n  @;',
    '~[x] is equal to {x}'
  ],
  [
    '[`;`]~[NEWLINE]^~[`b`]',
    'a;\n  b;',
    'a@\n  b;',
    'the first ~ should "consume" nothing because of an immediate newline. this example exposes an ugly artifact'
  ],
  [
    '~^{`a`}',
    '  a;\nb;',
    '  @;\nb;',
    '~ means consume any space/tab/comment. then check for ^'
  ],
  [
    '~^^~[`a`]',
    ' a;\nb;',
    ' @;\nb;',
    '~ is a noop if at start of query'
  ],
  [
    '~^^[`b`]',
    '  a;\nb;',
    '  a;\nb;',
    '~ means consume white tokens until current is black. then check for ^^'
  ],

  [
    '[`a`][`;`]$',
    'a;\nb;',
    '@;\nb;',
    'next black or white should be a newline or EOF'
  ],
  [
    '[`a`]$[NEWLINE]',
    'a\nb;',
    '@\nb;',
    '$ should not consume a token'
  ],
  [
    '[`b`][`;`]$',
    'a;\nb;',
    'a;\n@;',
    'next black or white should be a newline or EOF'
  ],
  [
    '[`a`][`;`]$$',
    'a;\nb;',
    'a;\nb;',
    'next black or white should be EOF'
  ],
  [
    '[`b`][`;`]$$',
    'a;\nb;',
    'a;\n@;',
    'next black or white should be EOF'
  ],

  [
    '[`a`][`;`]~$',
    'a;\nb;',
    '@;\nb;',
    '~ means consume white tokens until current is black. then check for $'
  ],
  [
    '[`a`]$[NEWLINE]~[`b`]',
    'a\n  b;',
    '@\n  b;',
    '~ should consume the whitespace'
  ],
  [
    '[`b`][`;`]~$',
    'a;\nb;',
    'a;\n@;',
    '~ means consume white tokens until current is black. then check for $'
  ],
  [
    '[`a`][`;`]~$$',
    'a;\nb;',
    'a;\nb;',
    '~ means consume white tokens until current is black. then check for $$'
  ],
  [
    '[`b`][`;`]~$$',
    'a;\nb;',
    'a;\n@;',
    '~ means consume white tokens until current is black. then check for $$'
  ],


  [
    '{VAR}',
    ';var foo;',
    ';@ foo;',
    'find black token (simple)'
  ],
  [
    '{VAR}',
    'var foo;',
    '@ foo;',
    'start with black token'
  ],
  [
    '[VAR]{`foo`}',
    'var foo;',
    '@ foo;',
    'properly skip to next black token'
  ],
  [
    '[VAR]{`fail`}',
    'var x=fail;',
    'var x=fail;',
    'should not be overzealous (no match)'
  ],

  [
    '[SPACE][COMMA]=0',
    '1 , 2',
    '1 @ 2',
    'override 0'
  ],

  [
    '[SPACE][COMMA]=1,0',
    '1 , 2',
    '1 $ 2',
    'range'
  ],
  [
    '([SPACE][COMMA])=1,0',
    '1 , 2',
    '1$@ 2',
    'range'
  ],
  [
    '(ADDITION)=0,1',
    'var a = 1 + 2;',
    'var a = @ + $;',
    'range in macro'
  ],
  [
    '(ADDITION)=1,0',
    'var a = 1 + 2;',
    'var a = $ + @;',
    'start end reversed'
  ],

  [
    '({NUMBER}{PLUS})',
    '1 + 2 + 3 + 4',
    '@ + 2 + 3 + 4',
  ],
  [
    '({NUMBER}=0{PLUS})',
    '1 + 2 + 3 + 4',
    '@ + 2 + 3 + 4',
  ],
  [
    '({NUMBER}{PLUS}=0)',
    '1 + 2 + 3 + 4',
    '1 @ 2 + 3 + 4',
  ],
  [
    '({NUMBER}{PLUS})=0',
    '1 + 2 + 3 + 4',
    '@ + 2 + 3 + 4',
  ],
  [
    '[SPACE]({NUMBER}{PLUS})',
    '1 + 2 + 3 + 4',
    '1 +@2 + 3 + 4',
  ],
  [
    '[SPACE]({NUMBER}=0{PLUS})',
    '1 + 2 + 3 + 4',
    '1 + @ + 3 + 4',
  ],
  [
    '[SPACE]({NUMBER}{PLUS}=0)',
    '1 + 2 + 3 + 4',
    '1 + 2 @ 3 + 4',
  ],
  [
    '[SPACE]({NUMBER}{PLUS})=0',
    '1 + 2 + 3 + 4',
    '1 + @ + 3 + 4',
  ],

  [
    '[SPACE](ADDITION)=0,1',
    '1 + 2 + 3 + 4',
    '1 + @ + $ + 4',
    'args target the group'
  ],

  [
    '[SPACE]*',
    '   1;',
    '@  1;',
    'matches anything'
  ],
  [
    '[SPACE]*',
    '1;',
    '@;',
    'anything...'
  ],
  [
    '[SPACE]*[`1`]',
    '   1;',
    '@  1;',
    'skip all the spaces'
  ],
  [
    '[SPACE]*[`1`]',
    '1;',
    '@;',
    'optional the spaces'
  ],
  [
    '[IS][SPACE]*[NUMBER]=0,1',
    'x =   1;',
    'x =   $;',
    'quantifier: any'
  ],
  [
    '[IS][SPACE]*[NUMBER]=,1',
    'x =   1;',
    'x @   $;',
    'quantifier: any'
  ],

  [
    '[WHITE&(SPACE|TAB)]',
    'var x\t=foo',
    'var@x\t=foo',
    'grouping matching conditions',
  ],
  [
    '[WHITE&(TAB|SPACE)]',
    'var x\t=foo',
    'var@x\t=foo',
    'grouping matching conditions',
  ],

  [
    '[SPACE]|[TAB]',
    'var x\t= 5;',
    'var@x\t= 5;',
    'OR between tokens'
  ],
  [
    '[TAB]|[SPACE]',
    'var x\t= 5;',
    'var@x\t= 5;',
    'reversed'
  ],
  [
    '([SPACE]|[TAB])|[COMMA]', // imagine SPACE|TAB being a macro
    '[1, 2 , 3\t, 4\n,5 \t,6\t ,7];',
    '[1@ 2 , 3\t, 4\n,5 \t,6\t ,7];',
    'OR between tokens and conditions'
  ],
  [
    '([TAB]|[SPACE])|[COMMA]', // imagine SPACE|TAB being a macro
    '[1, 2 , 3\t, 4\n,5 \t,6\t ,7];',
    '[1@ 2 , 3\t, 4\n,5 \t,6\t ,7];',
    'OR between tokens and conditions'
  ],
  [
    '[COMMA]|([SPACE]|[TAB])', // imagine SPACE|TAB being a macro
    '[1, 2 , 3\t, 4\n,5 \t,6\t ,7];',
    '[1@ 2 , 3\t, 4\n,5 \t,6\t ,7];',
    'OR between tokens and conditions'
  ],
  [
    '([SPACE][SPACE][SPACE][SPACE]|[TAB])=0,1',
    'var    b;',
    'var@  $b;',
    'test range params for grouped conditionals of different length; long'
  ],
  [
    '([SPACE][SPACE][SPACE][SPACE]|[TAB][TAB])=0,1',
    'var\t\tb;',
    'var@$b;',
    'test range params for grouped conditionals of different length; short'
  ],
  [
    '([SPACE]|[TAB])=0|([COMMA]|[NUMBER])=1',
    'var x\t= 5, y;',
    'var@x\t= 5, y;',
    'OR between tokens'
  ],
  [
    '([SPACE]|[TAB])=0|([COMMA]|[NUMBER])=1',
    'var\nx\n=\n5, y;',
    'var\nx\n=\n$, y;',
    'OR between tokens'
  ],

  [
    '{IS}{SQUARE_PAIR}{SEMI}=0',
    'var a = [1,2,3];',
    'var a = [1,2,3]@',
    'skip array',
  ],
  [
    '{IS}{IDENTIFIER}{SQUARE_PAIR}{SEMI}=0',
    'var a = foo[1,2,3];',
    'var a = foo[1,2,3]@',
    'skip dyn prop',
  ],
  [
    '{IS}{CURLY_PAIR}{SEMI}=0',
    'var a = {a:b};',
    'var a = {a:b}@',
    'skip object literal'
  ],
  [
    '{PAREN_PAIR}{CURLY_PAIR}=0',
    'if (foo) { var a = bar; }',
    'if (foo) @ var a = bar; }',
    'skip block statement'
  ],
  [
    '{IS}{CURLY_PAIR}{SEMI}=0',
    'if (foo) { var a = {A:B}; }',
    'if (foo) { var a = {A:B}@ }',
    'skip block statement with nested objlit'
  ],
  [
    '{PAREN_PAIR}{CURLY_PAIR}=0,1{IDENTIFIER}',
    'function f() { foo === bar; }\nf();',
    'function f() @ foo === bar; $\nf();',
    'skip function body'
  ],
  [
    '{SWITCH}{PAREN_PAIR}{CURLY_PAIR}=0',
    'switch (call()) { case 0: foo; break; default: break; }',
    'switch (call()) @ case 0: foo; break; default: break; }',
    'skip switch body'
  ],
  [
    '{IDENTIFIER}{PAREN_PAIR}?{CURLY_PAIR}',
    'try { foo; bar; } catch (e) {} finally { }',
    '@ { foo; bar; } catch (e) {} finally { }',
    'skip try/catch/finally curlies'
  ],
  [
    '{STATEMENT_KEYWORD}{PAREN_PAIR}{*}=0',
    'if (foo) bar;',
    'if (foo) @;',
    'skip statement parens'
  ],
  [
    '{PAREN_PAIR}{SEMI}=0',
    'do { foo; } while (bar);',
    'do { foo; } while (bar)@',
    'skip statement header'
  ],
  [
    '{IDENTIFIER}{PAREN_PAIR}{SEMI}=0',
    'foo();',
    'foo()@',
    'call parens'
  ],
  [
    '{PLUS}{PAREN_PAIR}{SEMI}=0',
    'a + (b - c);',
    'a + (b - c)@',
    'skip expression group'
  ],
  [
    '{CATCH}{PAREN_PAIR}{CURLY_OPEN}=0',
    'try {} catch (e) {}',
    'try {} catch (e) @}',
    'skip expression group'
  ],

  [
    '{VAR}=0 {IDENTIFIER}=1',
    'var foo = 5;',
    '@ $ = 5;',
    'regression'
  ],
  [
    '{VAR & KEYWORD}=0 {IDENTIFIER}=1',
    'var foo = 5;',
    '@ $ = 5;',
    'regression keyword'
  ],
  [
    '[TAB|SPACE]*=2,3',
    '\t\t ;',
    '#\t#;',
    'hashes are placed after the ats'
  ],
  [
    '[TAB|SPACE]*=2,3 {VAR & KEYWORD}=0 {IDENTIFIER}=1',
    '\t\t var foo = 5;',
    '#\t#@ $ = 5;',
    'regression'
  ],

  [
    '[SPACE]=0:the_space_start',
    ' ',
    '@',
    'test param name comment start'
  ],
  [
    '[SPACE]=0,1:the_space_stop',
    ' ',
    '$',
    'test param name comment stop'
  ],
  [
    '[SPACE]=0:the_space,1:same_space',
    ' ',
    '$',
    'test param name comment both'
  ],
  [
    '[SPACE]=,0:same_space',
    ' ',
    '@',
    'test param name comment without start'
  ],

  [
    '[SPACE][SPACE]{NUMBER}',
    '    5;',
    '@   5;',
    'because the last token is black, it skips the other spaces'
  ],
  [
    '[SPACE][SPACE][NUMBER]',
    '    5;',
    '  @ 5;',
    'now the last space must preceed the number, no whitespace tokens skipped'
  ],
  [
    '[SPACE]?[NUMBER]',
    '5;',
    '@;',
    'should have match start at number for missing optional space'
  ],
  [
    '[SPACE]?[NUMBER]',
    ' 5;',
    '@5;',
    'should have match start at both'
  ],
  [
    '[SPACE]?[NUMBER]',
    '+5;',
    '+@;',
    'should have match start at number for missing optional space'
  ],
  [
    '([SPACE][SPACE]?){NUMBER}',
    ' 1 +x;',
    '@1 +x;',
    'must have at least one space before the number'
  ],
  [
    '([SPACE][SPACE]?){NUMBER}',
    '1 +x;',
    '1 +x;',
    'must have at least one space before the number'
  ],
  [
    '([SPACE][SPACE]?)[NUMBER]',
    '   1;',
    ' @ 1;',
    'the one or two spaces must be connected to the number'
  ],
  [
    '([SPACE][SPACE])?{NUMBER}',
    ' 1;',
    ' @;',
    'dont match one space, either two or none'
  ],
  [
    '([SPACE][SPACE])?[NUMBER]',
    '   1;',
    ' @ 1;',
    'the two spaces are optional, should not match starting at the space before the number'
  ],
  [
    '([SPACE][SPACE])?[NUMBER]',
    ' 1;',
    ' @;',
    'the two spaces are optional, should not match starting at the space before the number'
  ],

  [
    '{NUMBER}({PLUS})=0',
    '1 + 2;',
    '1 @ 2;',
    'first black token of a group should start at black token not whitespace'
  ],
  [
    '(([SPACE][SPACE])?{NUMBER})',
    'x+ 1;',
    'x+ @;',
    'start with white or black?'
  ],
  [
    '(([SPACE][SPACE])?{NUMBER})',
    'x+  1;',
    'x+@ 1;',
    'start with white or black?'
  ],
  [
    '(([SPACE][SPACE])?{NUMBER})',
    'x+1;',
    'x+@;',
    'start with white or black?'
  ],

  [
    '{`1`}({PLUS}{NUMBER})=0,1 {PLUS}=2',
    '1 + 2 + 3 + 4 + 5 + x;',
    '1 @ $ # 3 + 4 + 5 + x;',
    'once'
  ],
  [
    '{`1`}({PLUS}{NUMBER})?=0,1 {PLUS}=2',
    '1 + 2 + 3 + 4 + 5 + x;',
    '1 @ $ # 3 + 4 + 5 + x;',
    'maybe'
  ],
  [
    '{`1`}({PLUS}{NUMBER})?=0,1 {PLUS}=2',
    '1 + x + x + x + x + x;',
    '@ # x + x + x + x + x;',
    'any'
  ],
  [
    '{`1`}({PLUS}{NUMBER})+=0,1 {PLUS}=2',
    '1 + 2 + 3 + 4 + 5 + x;',
    '1 @ 2 + 3 + 4 + $ # x;',
  ],
  [
    '{`1`}({PLUS}{NUMBER})+=0,1 {PLUS}=2',
    '1 + x + x + x + x + x;',
    '1 + x + x + x + x + x;',
  ],
  [
    '{`1`}({PLUS}{NUMBER})2=0,1 {PLUS}=2',
    '1 + 2 + 3 + 4 + 5 + x;',
    '1 @ 2 + $ # 4 + 5 + x;',
  ],
  [
    '{`1`}({PLUS}{NUMBER})2...=0,1 {PLUS}=2',
    '1 + 2 + 3 + 4 + 5 + x;',
    '1 @ 2 + 3 + 4 + $ # x;',
  ],
  [
    '{`1`}({PLUS}{NUMBER})2...=0,1 {PLUS}=2',
    '1 + 2 + x + x + x + x;',
    '1 + 2 + x + x + x + x;',
    'matching but not matching enough, so no match'
  ],
  [
    '{`1`}({PLUS}{NUMBER})2..3=0,1 {PLUS}=2',
    '1 + 2 + 3 + 4 + 5 + x;',
    '1 @ 2 + 3 + $ # 5 + x;',
  ],
  [
    '{`1`}({PLUS}{NUMBER})2..3=0,1 {PLUS}=2',
    '1 + 2 + x + x + x + x;',
    '1 + 2 + x + x + x + x;',
    'matching but not matching enough, so no match'
  ],
  [
    '{`1`}(({PLUS}{NUMBER})2|[SPACE])=0,1 {PLUS}=2',
    '1 + x + 3 + 4 + 5 + x;',
    '1$# x + 3 + 4 + 5 + x;',
    'trackback from black token to match a white token'
  ],
  [
    '({PLUS}2|[SPACE])',
    '  + - - 1;',
    '@ + - - 1;',
    'trackback after partial quantative match, grouped'
  ],
  [
    '{PLUS}2|[SPACE]',
    '  + - - 1;',
    '@ + - - 1;',
    'trackback after partial quantative match, ungrouped'
  ],
  [
    '([PLUS]2|[SPACE])',
    '++ - 1;',
    '++@- 1;',
    'misleading version, the ++ becomes one token and wont match [PLUS]2'
  ],
  [
    '([PLUS][`1`])2|[SPACE]',
    '+1+1 - 1;',
    '@1+1 - 1;',
    'fixed version, should not match space'
  ],
  [
    '({PLUS}2|[SPACE])',
    '  ++ - 1;',
    '@ ++ - 1;',
    'unless it should match'
  ],
  [
    '{PLUS}2|[SPACE]',
    '  + + - 1;',
    '  @ + - 1;',
    'quantity should not ignore black token wrapper after first match'
  ],
  [
    '[SPACE]({PLUS}2|[SPACE])',
    '  + - - 1;',
    '@ + - - 1;',
    'trackback after partial quantitative match with leading match'
  ],
  [
    '({MIN}{PLUS}2)|[SPACE]',
    '  - + - 1;',
    '@ - + - 1;',
    'trackback after partial quantitative match with leading match'
  ],
  [
    '({MIN}{PLUS}2)|[SPACE]',
    '  - + + + 1;',
    '  @ + + + 1;',
    'unless it should match'
  ],
  [
    '({PLUS}{PLUS})?|[SPACE]',
    '  + - - 1;',
    '@ + - - 1;', // wont match anywhere, but is optional, so any character passes
    'silly ? makes the OR useless'
  ],
  [
    '{`1`}(({PLUS}{NUMBER})2|[SPACE])=0,1 {PLUS}=2',
    '1 + 2 + x + 4 + 5 + x;',
    '1$# 2 + x + 4 + 5 + x;',
    'trackback after matching a group once but not sufficiently so match a white token instead'
  ],


  [
    '{`y`}({PLUS}{`x`})+',
    'y + x + x;',
    '@ + x + x;',
    'call callback repeated (no args)'
  ],
  [
    '{`y`}({PLUS}{`x`})+=0,1',
    'y + x + x;',
    'y @ x + $;',
    'call callback repeated (no args)'
  ],
  [
    '{`y`}({PLUS}{`x`})+@',
    'y + x + x;',
    '@ + x + x;',
    'call callback repeated (@ no args)'
  ],
  [
    '{`y`}({PLUS}{`x`})+@=0,1',
    'y + x + x + x;',
    'y @ $ @ $ @ $;',
    'call callback repeated (@ args)'
  ],
  [
    '{`y`}({PLUS}{`x`})3@=0,1',
    'y + x + x + x;',
    'y @ $ @ $ @ $;',
    'call for all matches'
  ],
  [
    '{`y`}({PLUS}{`x`})2...@=0,1',
    'y + x + x + x;',
    'y @ $ @ $ @ $;',
    'all matches open ended'
  ],
  [
    '{`y`}({PLUS}{`x`})2..3@=0,1',
    'y + x + x + x;',
    'y @ $ @ $ @ $;',
    'all matches bound'
  ],
  [
    '{`y`}({PLUS}{`x`})3@=0,1',
    'y + x + x + x;',
    'y @ $ @ $ @ $;',
    'sanity check for next one'
  ],
  [
    '[PLUS|MIN]3..4@=0',
    '+-+-+5;',
    '@@@@+5;',
    'white: start, repeat call with floor, should call under floor too'
  ],
  [
    '[PLUS|MIN]3..4@=,0',
    '+-+-+5;',
    '@@@@+5;',
    'white: stop, repeat call with floor, should call under floor too'
  ],
  [
    '[PLUS|MIN]3..4@=0,1',
    '+-5;',
    '+-5;',
    'white: repeat call with floor, should ignore because does not reach floor'
  ],
  [
    '{PLUS|MIN}3..4@=0',
    ' + - + - + 5;',
    ' @ @ @ @ + 5;',
    'black: start, repeat call with floor, should call under floor too'
  ],
  [
    '{PLUS|MIN}3..4@=,0',
    ' + - + - + 5;',
    ' @ @ @ @ + 5;',
    'black: stop, repeat call with floor, should call under floor too'
  ],
  [
    '[PLUS|MIN]3..4@=0,1',
    ' + - 5;',
    ' + - 5;',
    'black: repeat call with floor, should ignore because under floor'
  ],
  [
    '{`y`}({PLUS}{`x`})3@=0,1',
    'y + x + x + y;',
    'y + x + x + y;',
    'all matches but no match means no calls at all'
  ],
  [
    '{`y`}({PLUS}{`x`})+%',
    'y + x + x;',
    '@ + x + x;',
    'call callback repeated (% no args)'
  ],
  [
    '{`y`}({PLUS}{`x`})+%=0,1',
    'y + x + x + x;',
    'y @ $ @ $ @ $;',
    'call callback repeated (% args)'
  ],
  [
    '({MIN|PLUS}{MIN|PLUS}{`y`}?)+@=0',
    '+ - + - 1;',
    '@ - @ - 1;',
    'dont screw up start'
  ],
  [
    '({MIN|PLUS}{MIN|PLUS}{`y`}?)+@=,0',
    '+ - + - 1;',
    '+ @ + @ 1;',
    'dont screw up stop'
  ],

  [
    '[!WHITE & !ASI]',
    'a + b',
    '@ + b',
  ],
  [
    '{!PLUS & !SEMI}',
    'a + b;',
    '@ + b;',
  ],
  [
    '{!(PLUS | `a` | SEMI)}',
    'a + b;',
    'a + @;',
  ],

  [
    '((^[WHITE])?[WHITE]*)=0,1 {FUNCTION}{IDENTIFIER}=2',
    'function foo() {}',
    '@ #() {}',
    'regression: ^WHITE on $ should not match function (the @ is default 0 arg, a match would make that $)'
  ],
  [
    '((^[WHITE])?[WHITE]*)=0,1 {FUNCTION}{IDENTIFIER}=2',
    'var bar = function foo() {}',
    'var bar =$function #() {}',
    'the reason the query is flawed'
  ],
  [
    '(((^[WHITE])[WHITE]*)=0,1|([NEWLINE][WHITE]*=0,1)) [FUNCTION]{IDENTIFIER}=2',
    'var bar = function foo() {}',
    'var bar = function foo() {}',
    'the right way to do this query (no match)'
  ],
  [
    '(((^[WHITE])[WHITE]*)=0,1|([NEWLINE][WHITE]*=0,1)) [FUNCTION]{IDENTIFIER}=2',
    '   function foo() {}',
    '@ $function #() {}',
    'the right way to do this query 2 (sof)'
  ],
  [
    '(((^[WHITE])[WHITE]*)=0,1|([NEWLINE][WHITE]*=0,1)) [FUNCTION]{IDENTIFIER}=2',
    'foo();\n   function foo() {}',
    'foo();\n@ $function #() {}',
    'the right way to do this query 3 (newline)'
  ],
  [
    '((^[WHITE])?[WHITE]*)=0,1 {FUNCTION}{IDENTIFIER}=2',
    'foo();\nfunction foo() {}',
    'foo();$function #() {}',
    '^WHITE should match the newline' // TOFIX ^
  ],
  [
    '{IDENTIFIER}[SPACE]?=1,2',
    'foo;',
    '@;',
    'arg assignment for optional query'
  ],
  [
    '{IDENTIFIER}[SPACE]?=0,1',
    'foo;',
    '@;',
    'arg assignment for optional query on zero'
  ],
  [
    '{IDENTIFIER}[SPACE]*=0,1',
    'foo;',
    '@;',
    'arg assignment for optional query on star'
  ],
  [
    '{IDENTIFIER}([SPACE]?)=0,1',
    'foo;',
    '@;',
    'arg assignment for optional query on star, grouped'
  ],
  [
    '{IDENTIFIER}([SPACE]?[WHITE]*)=0,1',
    'foo;',
    '@;',
    'arg assignment for optional query on star, grouped, double?'
  ],
  [
    '([SPACE]?[WHITE]*)=0,1{IDENTIFIER}',
    'foo;',
    '@;',
    'arg assignment for optional query, white first'
  ],
  [
    '([SPACE]?[WHITE]*)=0,1[IDENTIFIER]',
    'foo;\nbar;',
    '@;\nbar;',
    'whitespace optional so matches identifier, no assignments so first token becomes @'
  ],
  [
    '((^[WHITE])[WHITE]*)?=0,1 {FUNCTION}',
    'foo;\nfunction foo() {}',
    'foo;\n@ foo() {}',
    'arg assignment without a match: the ^ should not match anything. 0 should be `function` and 1 should be undefined'
  ],
  [
    '((^[WHITE])[WHITE]*)?=0,1 {FUNCTION}{IDENTIFIER}=2',
    'foo;\nfunction foo() {}',
    'foo;\n@ #() {}',
    'regression: ^WHITE on newline should not match function' // TOFIX: ^
  ],

  [
    '[`x`]=0 ({`+`}=1 {`y`}=2)+@',
    'x + y + y + y + z',
    '@ $ # $ # $ # + z',
    'update params for @ matches'
  ],

  [
    '^^[`x`]',
    'x();\nx();',
    '@();\nx();',
    'constant outside token'
  ],
  [
    '^^[`x`]',
    'x();\nx();',
    '@();\nx();',
    'macro outside token'
  ],
  [
    '^([`x`][PAREN_PAIR][SEMI][WHITE]*)2',
    'x();\nx();',
    '@();\nx();',
    'top-level group for ^ (and ^^) should work as expected without consuming a token'
  ],

  [
    '{PLUS} # {MIN}',
    '+ - 1;',
    '@ @ 1;',
    'early call'
  ],
  [
    '{PLUS} {PLUS} {PLUS} # {MIN} {MIN} {MIN}',
    '+ + + - - - 1;',
    '@ + + @ - - 1;',
    'early call 2'
  ],
  [
    '{PLUS} {PLUS} {PLUS} # {`x`} {MIN}=0 {MIN} {MIN}',
    '+ + + x - - - 1;',
    '@ + + x @ - - 1;',
    'early call put x in the middle'
  ],
  [
    '({PLUS} {PLUS} {PLUS})=0,1 # ({MIN} {MIN} {MIN})=0,1',
    '+ + + - - - 1;',
    '@ + $ @ - $ 1;',
    'early call grouped'
  ],
  [
    '({PLUS} {PLUS} {PLUS})=0,1 # ({MIN} {MIN} {MIN})=0,1 # ({PLUS} {PLUS} {PLUS})=0,1',
    '+ + + - - - + + + 1;',
    '@ + $ @ - $ @ + $ 1;',
    'multiple early calls'
  ],
  [
    '({PLUS} {PLUS} {PLUS})=0,1 # ({MIN} {MIN} {MIN})=0,1 # ({PLUS} {PLUS} {PLUS})=0,1 #',
    '+ + + - - - + + + 1;',
    '@ + $ @ - $ @ + $ 1;',
    'final call'
  ],
  [
    '({PLUS} # {PLUS} # {PLUS})=0,1',
    '+ + + 1;',
    '@ @ $ 1;',
    'early call in group'
  ],



  [
    '({`x`}{`+`}{`y`}{`+`}?)*@=0,1',
//    '(({`x`}=1{`+`}{`y`}{`+`}?)=0,1 #)*',
    'x + y + x + y',
    '@ + y $ @ + $',
    'base: repeated calls, updating 0 and 1'
  ],
  [
    '(({`x`}=1{`+`}{`y`}{`+`}?)=0,1 #)*',
    'x + y + x + y',
    '@ + y $ @ + $',
    'base: alternative way of writing @'
  ],
  [
    '({`x`}=1{`+`}{`y`}{`+`}?)*@=0,1',
    'x + y + x + y',
    '@ + y $ @ + $',
    'updating 1 inside a repeated call which updates 1'
  ],

  [
    '({`console`}({`.`})?)',
    'function query(){ console.log(); }',
    'function query(){ @.log(); }',
    'regression; would match on nearly anything due to ?'
  ],

  [
    '([`b`][`;`])?[`c`][`;`]?',
    'a;b;c;d;',
    'a;@;c;d;',
    'leading AND trailing optionals should still match if possible'
  ],
  [
    '(([`b`][`;`])?[`c`][`;`]?)=,1',
    'a;b;c;d;',
    'a;@;c$d;',
    'leading AND trailing optionals should still match if possible, grouped'
  ],

  [
    '(({`!`}{`void`})?({`console`}{`.`}{`log`|`warn`|`group`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?))=0,1',
    'group0 = checkTokenWhite(symw() && !void console.log("# 1001 start of literal [`b`] at 4 in query to token "+index+":", token()) && value(\'b\'));',
    'group0 = checkTokenWhite(symw() && @void console.log("# 1001 start of literal [`b`] at 4 in query to token "+index+":", token()) $ value(\'b\'));',
    'regression',
  ],
  [
    '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1',
    'group0 = checkTokenWhite(symw() && !void console.log("# 1001 start of literal [`b`] at 4 in query to token "+index+":", token()) && value(\'b\'));',
    'group0 = checkTokenWhite(symw() && @void console.log("# 1001 start of literal [`b`] at 4 in query to token "+index+":", token()) $ value(\'b\'));',
    'regression',
  ],
  [
    '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1',
    'if (console.log("~ seek() past spaces and tabs at all?", matchedSomething, "start=", index),matchedSomething) {}',
    'if (@.log("~ seek() past spaces and tabs at all?", matchedSomething, "start=", index)$matchedSomething) {}',
    'regression',
  ],
  [
    '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1|({`;`}{CURLY_PAIR})=0,1',
    'if (console.log("~ seek() past spaces and tabs at all?", matchedSomething, "start=", index),matchedSomething) {}',
    'if (@.log("~ seek() past spaces and tabs at all?", matchedSomething, "start=", index)$matchedSomething) {}',
    'regression',
  ],

// TODO
//  [
//    '[`x`]#[`y`]|[`z`]',
//    'x + z;',
//    'x + @;',
//    'checking toplevel OR and backtracking on an early call'
//  ],


  // test that calls repeats (repeat or collect) but doesnt meet minimal quantity, trackback to another repeater...
  // test that repetitive callback is not called until min repetitions are seen
  // test invert and backtracking
  // test with logic operators in query vs in js (`a & b | c` should not lead to `c` if `!a`)
  // test to confirm the implicit callback is not called when quantified callbacks end and match the query

// define macros first...
//    '#(SOF_WHITES, ([SOF & WHITE][WHITE]*)=0,1)' +
//    '#(NEWLINE_WHITES, [NEWLINE][WHITE]*=0,1)' +
//    '(SOF_WHITES|NEWLINE_WHITES) {FUNCTION}{IDENTIFIER}=2',

// ignore tokens until match, like a [*] except instead of [!foo]*[foo] you do [>>foo]
// [>>][foo] to assign it? meaning the same as [>>foo] except you can get the >> part in args too?
// otoh you could get that by other means; `[*]=,0 [>>function]=1,2` -> start of skipped = arg0+1, end of skipped = arg1-1
// >> for "must be on same line" ([!foo & !NEWLINE]*[foo], >>> for "any token"

  // repeat match condition quantifier
  // repeated quantifier groups range start seems to reset at each (subsequent) match
];