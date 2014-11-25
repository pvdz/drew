// note: callback args get: 0=@, 1=$, 2... = #
var tests = module.exports = [
  [
    '[SPACE]',
    'var a = 20;',
    'var@a@=@20;'
  ],
  [
    '[SPACE | TAB]',
    'var a\t= 20;',
    'var@a@=@20;'
  ],
  [
    '[SOL & `a`]',
    'a;\nb;',
    '@;\nb;'
  ],
  [
    '[SOL & `b`]',
    'a;\nb;',
    'a;\n@;'
  ],
  [
    '[SPACE][COMMA][SPACE]',
    '1 ,  1  , 1 ,  1 , 1,1,1 ,1 , 1',
    '1@,  1 @, 1@,  1@, 1,1,1 ,1@, 1',
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
    '@ + @ + @ + 4',
  ],
  [
    '({NUMBER}=0{PLUS})',
    '1 + 2 + 3 + 4',
    '@ + @ + @ + 4',
  ],
  [
    '({NUMBER}{PLUS}=0)',
    '1 + 2 + 3 + 4',
    '1 @ 2 @ 3 @ 4',
  ],
  [
    '({NUMBER}{PLUS})=0',
    '1 + 2 + 3 + 4',
    '@ + @ + @ + 4',
  ],
  [
    '[SPACE]({NUMBER}{PLUS})',
    '1 + 2 + 3 + 4',
    '1 +@2 +@3 + 4',
  ],
  [
    '[SPACE]({NUMBER}=0{PLUS})',
    '1 + 2 + 3 + 4',
    '1 + @ + @ + 4',
  ],
  [
    '[SPACE]({NUMBER}{PLUS}=0)',
    '1 + 2 + 3 + 4',
    '1 + 2 @ 3 @ 4',
  ],
  [
    '[SPACE]({NUMBER}{PLUS})=0',
    '1 + 2 + 3 + 4',
    '1 + @ + @ + 4',
  ],

  [
    '[SPACE](ADDITION)=0,1',
    '1 + 2 + 3 + 4',
    '1 + @ + @ + $',
    'should not be a problem because args target the group'
  ],

  [
    '[SPACE]*',
    '   1;',
    '@@@@@',
    'any, matching all'
  ],
  [
    '[SPACE]*[`1`]',
    '   1;',
    '@@@@;',
    'any (matches any space and 1, triggers multiple times)'
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
    'var@x@=foo',
    'grouping matching conditions',
  ],

  [
    '[SPACE]|[TAB]',
    'var x\t= 5;',
    'var@x@=@5;',
    'OR between tokens'
  ],
  [
    '([SPACE]|[TAB])|[COMMA]', // imagine SPACE|TAB being a macro
    '[1, 2 , 3\t, 4\n,5 \t,6\t ,7];',
    '[1@@2@@@3@@@4\n@5@@@6@@@7];',
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
    'var@x@=@$$@y;',
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
    '@ { foo; bar; } @ (e) {} @ { }',
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
    '@@@ 5;',
    'because the last token is black, it skips the other spaces'
  ],
  [
    '[SPACE][SPACE][NUMBER]',
    '    5;',
    '  @ 5;',
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
    '@@;',
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
    ' 1 + 2+3+  4+    5;',
    '@1 +@2+3+@@4+@@@@5;',
    'the one or two spaces may have any additional whitespace between the number'
  ],
  [
    '([SPACE][SPACE]?)[NUMBER]',
    '   1;',
    ' @@1;',
    'the one or two spaces must be connected to the number'
  ],
  [
    '([SPACE][SPACE]?)[NUMBER]',
    ' 1 + 2+3+  4+    5;',
    '@1 +@2+3+@@4+  @@5;',
    'the one or two spaces must be connected to the number'
  ],
  [
    '([SPACE][SPACE])?{NUMBER}',
    ' 1;',
    ' @;',
    'dont match one space, either two or none'
  ],
  [
    '([SPACE][SPACE])?{NUMBER}',
    ' 1 + 2+3+  4+    5;',
    ' @ + @+@+@ @+@@@ @;',
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
    ' 1 + 2+3+  4+    5;',
    ' @ + @+@+@ @+@@@ @;',
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
    '{PLUS}2|[SPACE]',
    '  + - - 1;',
    '@@+@-@-@1;',
    'trackback after partial quantative match'
  ],
  [
    '({PLUS}2|[SPACE])',
    '  + - - 1;',
    '@@+@-@-@1;',
    'trackback after partial quantative match, grouped'
  ],
  [
    '[SPACE]({PLUS}2|[SPACE])',
    '  + - - 1;',
    '@ + - - 1;',
    'trackback after partial quantative match with leading match'
  ],
  [
    '({MIN}{PLUS}2)|[SPACE]',
    '  - + - 1;',
    '@@-@+@-@1;',
    'trackback after partial quantative match with leading match'
  ],
  [
    '({PLUS}{PLUS})?|[SPACE]',
    '  + - - 1;',
    '@@@@@@@@@@', // wont match anywhere, but is optional, so any character passes
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
    'call callback repeated (no args)'
  ],
  [
    '{`y`}({PLUS}{`x`})+@=0,1',
    'y + x + x + x;',
    'y @ $ @ $ @ $;',
    'call callback repeated (no args)'
  ],


//  [
//    '{`1`}({PLUS}{NUMBER})+@=0,1',
//    '1 + 2 + 3;',
//    '1 @ 2 + $;',
//    'call callback repeated'
//  ],

//  [
//    '{`1`}({PLUS}{NUMBER})*@=0,1',
//    '1 + 2 + 3;',
//    '1 @ $ @ $;',
//    'callback called repeated'
//  ],


  // repeat match condition quantifier
  // repeated quantifier groups range start seems to reset at each (subsequent) match

//  [
//    '{`function` & KEYWORD}=0 {IDENTIFIER} {`(`} ({IDENTIFIER} ({COMMA} {IDENTIFIER})*)?=1,2 {`)`}{`{`}=3',
//    '',
//    '',
//    'function identifier and arg header',
//  ]
];
