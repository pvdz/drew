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


//  [
//    '{`function` & KEYWORD}=0 {IDENTIFIER} {`(`} ({IDENTIFIER} ({COMMA} {IDENTIFIER})*)?=1,2 {`)`}{`{`}=3',
//    '',
//    '',
//    'function identifier and arg header',
//  ]
];
