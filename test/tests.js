// this tester callback replaces the token in first arg with '@', second with '$', other args with '#'
// so callback args get: 0=@, 1=$, 2... = #
// note: tests are called in `once` mode, meaning they'll exit after the first match

var REPEAT_ONCE = 'once';
var REPEAT_AFTER = 'after';
var REPEAT_EVERY = 'every';
var INPUT_COPY = 'copy';
var INPUT_NO_COPY = 'nocopy';

// each test is an array with: [<query>, <input>, <output>[, <desc>[, <repeatmode=once>[, copymode=nocopy[, handler:function]]]]
// (eg; desc, repeatmode, copymode, and handler are optional)

var tests = module.exports = [
  [
    '[SPACE]',
    'var a = 20;',
    'var@a = 20;',
    'spaces',
    REPEAT_ONCE
  ],
  [
    '[SPACE]',
    'var a = 20;',
    'var@a@=@20;',
    'spaces',
    REPEAT_AFTER
  ],
  [
    '[SPACE]',
    'var a = 20;',
    'var@a@=@20;',
    'spaces',
    REPEAT_EVERY
  ],
  [
    '[SPACE | TAB]',
    'var a\t= 20;',
    'var@a\t= 20;',
    'space tab',
  ],
  [
    '[SPACE | TAB]',
    'var a\t= 20;',
    'var@a@=@20;',
    'space tab',
    REPEAT_EVERY
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
    '[`a`]|~',
    '  a;  b;',
    '@ a;  b;',
    'the ~ at the "start" wont skip anything so it may as well be the empty query (which matches everything)'
  ],
  [
    '[WHITE & TAB][`;`]',
    ' ;\t;',
    ' ;@;',
    'should only match second semi', // update docs if this changes
    REPEAT_EVERY
  ],
  [
    '[WHITE & SPACE | TAB][`;`]',
    ' ;\t;',
    '@;@;',
    'should match both, same as white&(space|tab)', // update docs if this changes
    REPEAT_EVERY
  ],
  [
    '~[`a`]|~[`b`]',
    '  a;  b;',
    '  @;  @;',
    // the ~ wont seek at all when at the start of input
    // the ~ wont seek as long as the query hasnt consumed anything (optimization)
    // the or wraps whole left and right side, so matching ~a and ~b
    // with ~ at query start being ignored it's actually matching a and b
    'matches a when applying the rule starting at index 2 (!)',
    REPEAT_AFTER,
  ],
  [
    '[`x`][`;`]~[`a`]|~[`b`]',
    'x;  a;  b;',
    '@;  a;  @;',
    // this should match ~b or the other part as a whole
    'same as before but with leading stuff to force ~ to seek',
    REPEAT_AFTER,
  ],
  [
    '(~[`a`]|~[`b`])*',
    '  a;  b;',
    '@ a;  b;',
    'equivalent to matching nothing (so anything works)'
  ],
  [
    '((~[`a`])|(~[`b`]))*',
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
    '((~[`a`])|(~[`b`]))+',
    '  a;  b;',
    '  @;  b;',
    'reset ~ after match, grouped repeat (tbd, match should start at [a])'
  ],
  [
    '(~[`a`]|[`b`])+=0,1',
    '  a;  b;',
    '  $;  $;',
    '~ is ignored because query start, the match wont repeat but will match a and b (only) individually',
    REPEAT_AFTER
  ],
  [
    '((~[`a`])|[`b`])+=0,1',
    '  a;  b;',
    '  $;  $;',
    '~ only applies to a but ignored anyways because still query start, groups are irrelevant for that',
    REPEAT_AFTER
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
    'a;\n@ b;',
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
    '@a;\nb;',
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
    '(ADDITION|(ADDITION))=0,1',
    'var a = 1 + 2;',
    'var a = @ + $;',
    'toplevel grouped macro edge case'
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

  // some cases with scoping of designators at the end in a complex query
  [
    '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1|({`;`}{CURLY_PAIR}=2,3)',
    'console.log(15);{ oh; hello; world; }',
    '@.log(15)@# oh; hello; world; #',
    '2 and 3 should be start and end of curly pair',
    REPEAT_EVERY,
    INPUT_COPY
  ],
  [
    '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1|({`;`}{CURLY_PAIR}=2,3)',
    'console.log(15);{ oh; hello; world; }',
    '@.log(15)${ oh; hello; world; }',
    'without copy the top level OR part wont match because the first part will replace the semi-colon so it wont match',
    REPEAT_EVERY,
    INPUT_NO_COPY
  ],
  [
    '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1|({`;`}{CURLY_PAIR}=2,3)',
    'console.log(15);{ oh; hello; world; }',
    '@.log(15)${ oh; hello; world; }',
    'without repeating every token the first part will match, then start matching after the semi so the second part wont match, even if you copy',
    REPEAT_AFTER,
    INPUT_COPY
  ],
  [
    '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1|({`;`}{CURLY_PAIR}=2,3)',
    'console.log(15);{ oh; hello; world; }',
    '@.log(15)${ oh; hello; world; }',
    'without repeating every token the first part will match, then start matching after the semi so the second part wont match',
    REPEAT_AFTER,
    INPUT_NO_COPY
  ],
  [
  '(({`!`}{`void`})?{`console`}{`.`}{`log`|`warn`|`group`|`groupEnd`|`error`}{PAREN_PAIR}({`&&`}|{`||`}|{`;`}|{`,`})?)=0,1|({`;`}{CURLY_PAIR})=2,3',
    'console.log(15);  { oh; hello; world; }',
    '@.log(15)#  { oh; hello; world; #',
    '2 and 3 wrap the entire group starting at semi',
    REPEAT_EVERY,
    INPUT_COPY
  ],

  // regex
  [
    '{/foo/}',
    'foo',
    '@',
    'simple regex straight match'
  ],
  [
    '{/foo/}',
    'bloofoo',
    '@',
    'partial match without ^$'
  ],
  [
    '{/foo/}',
    'foobloo',
    '@',
    'partial match without ^$'
  ],
  [
    '{/foo/}',
    'bloofoobloo',
    '@',
    'partial match without ^$'
  ],
  [
    '{/foo/i}',
    'blooFoobloo',
    '@',
    'case insensitive flag'
  ],
  [
    '{`foo`i}',
    'Foo',
    '@',
    'case insensitive literal flag'
  ],
  [
    '{`a`}{/\\./}{`c`}',
    'a.c',
    '@.c',
    'backslashed dot should match dot',
  ],
  [
    '{`a`}{/\\./}{`c`}',
    'abc',
    'abc',
    'backslashed dot should not match b',
  ],

  [
    '({`{`}{`}`})=0,1|[NEWLINE]=2',
    '{\n}',
    '@#$',
    'the black token condition should skip past the whites but the OR should rewind this part',
    REPEAT_EVERY,
    INPUT_COPY
  ],

  [
    '{`A`}|{`B`}=2',
    'A',
    '@',
    'match should be assigned to 0, 2 should bind to B (but wont match)'
  ],
  [
    '{`A`}|{`B`}=2',
    'B',
    '#',
    'match should be assigned to 2'
  ],
  [
    '{`;`}+|{`!`}=1,2',
    ';;;;;; !!!!!x',
    '@;;;;; !!!!!x',
    'should assign to 0, ignore the 1 and 2',
    REPEAT_ONCE
  ],
  [
    '{`A`}+|{`!`}=1,2',
    '-+-+x; !!!!!x',
    '-+-+x; #!!!!x',
    'should assign first B to 1 and 2',
    REPEAT_ONCE
  ],

  [
    '[NEWLINE][!NEWLINE]*[NEWLINE]',
    'a\nb',
    'a\nb',
    'regression: caused infinite loop',
  ],

  [
    '[`x`]#[`y`]|[`z`]',
    'x + z;',
    'x + @;',
    'checking toplevel OR and backtracking on an early call'
  ],

  [
    '{`a` | `b`}',
    '',
    '',
    'query parser test',
  ],
  [
    '{`a` & `b`}',
    '',
    '',
    'query parser test',
  ],
  [
    '{`a` & `b` | `c`}',
    '',
    '',
    'query parser test',
  ],
  [
    '{/foo/ & `b` | `c`}',
    '',
    '',
    'query parser test',
  ],

  [
    '{/^\\// & REGEX | PUNCTUATOR}',
    ' // should not match this comment',
    ' // should not match this comment',
    '{a & b | c} matches c on first semi because a&b doesnt match',
  ],
  [
    '{/^\\// & REGEX | PUNCTUATOR}',
    ' /* should not match this comment */',
    ' /* should not match this comment */',
    '{a & b | c} matches c on first semi because a&b doesnt match',
  ],
  [
    '{/^\\// & REGEX | PUNCTUATOR}',
    ' /should match this regex/;',
    ' @;',
  ],
  [
    '{/^\\// & REGEX | PUNCTUATOR}',
    ' foo;',
    ' foo@',
    'a&b|c, matches on c regardless of a&b'
  ],
  [
    '{/^\\// & (REGEX | PUNCTUATOR)}',
    ' foo;',
    ' foo;',
    'can use parens to disambiguate, a&(b|c) now the punc wont match because a wont match'
  ],

  [
    '{`a`}[` `]',
    'a ;',
    '@ ;',
    'check pointer stuff, black token skip should leave pointer right behind the black token, not before the next black token'
  ],
  [
    '{`a`}{`;`}[` `]',
    'a; ;',
    '@; ;',
    'check pointer stuff, black token skip should leave pointer right behind the black token, not before the next black token'
  ],

  // seeking > >> < <<
  [
    '[WHITE]<[NEWLINE]',
    'a;\nb;',
    'a;@b;',
    'jump back a white token',
  ],
  [
    '[WHITE]>[NEWLINE]',
    'a ;\nb;',
    'a@;\nb;',
    'jump over a black or white token',
  ],
  [
    '[WHITE]>[NEWLINE]',
    'a  \n;b;',
    'a@ \n;b;',
    'jump over a black or white token',
  ],
  [
    '[WHITE]>>[NEWLINE]',
    'a  \n;b;',
    'a  \n;b;',
    'jump over a black token (should fail as there is no black token to skip)',
  ],
  [
    '[WHITE]>>[NEWLINE]',
    'a ;\nb;',
    'a@;\nb;',
    'jump over a black token (space, semi, newline)',
  ],
  [
    '{IDENTIFIER}{`;`}<<2{`foo`}',
    'obj.foo ; bar;',
    'obj.@ ; bar;',
    'check token type for ident, check next token, jump back to confirm actual value of identifier',
  ],

  // fiddle with designators and seeks
  [
    '({`a`}{`.`}{`b`}{`;`}<)=0,1',
    'a.b;',
    '@.$;',
    'should assign the second last index to 1, instead of the last'
  ],
  [
    '({`a`}{`.`}{`b`}{`;`}<)=0,1|({`;`}{`c`})=,2',
    'a.b;c',
    '@.$@#',
    'this wont work in AFTER mode if the index isnt moved back',
    REPEAT_AFTER
  ],
  [
    '({`a`}{`.`}{`b`}{`;`})=0,1|({`;`}{`c`})=,2',
    'a.b;c',
    '@.b$c',
    'this wont work in AFTER mode because the index isnt moved back',
    REPEAT_AFTER
  ],
  [
    '({`a`}{`.`}{`b`}{`;`})=0,1|({`;`}{`c`})=,2',
    'a.b;c',
    '@.b@#',
    'this wont work in AFTER mode if the index isnt moved back but would work in EVERY mode with COPY', // though less efficient
    REPEAT_EVERY,
    INPUT_COPY
  ],
  [
    '{IDENTIFIER}{`;`}<<2{`a`}',
    'a;',
    '@;',
    'conditional with seek back',
  ],
  [
    '{IDENTIFIER}{`;`}<<2{`b`}',
    'a;',
    'a;',
    'conditional with seek back, failing after seek',
  ],
  [
    '({IDENTIFIER}{`;`}<<2{`a`})=0,1',
    'a;',
    '$;',
    'conditional with seek back, checking range',
  ],
  [
    '{IDENTIFIER}{`;`}<<2{`a`}{`;`}',
    'a;',
    '@;',
    'scanning same token twice',
  ],
  [
    '{IDENTIFIER}{`;`}<<2{`a`}{`b`}',
    'a;',
    'a;',
    'scanning same token twice, failing the second time',
  ],
  [
    '({IDENTIFIER}{`;`}<<2{`a`}{`;`})=0,1',
    'a;',
    '@$',
    'scanning same token twice, check range',
  ],

  [
    '[`a`]|[`b`]',
    'a',
    'c',
    'return true is like repeat mode = same',
    REPEAT_AFTER,
    INPUT_NO_COPY,
    function(a){ if (a.value === 'a') a.value = 'b'; else if (a.value === 'b') a.value = 'c'; else return; return true; }
  ],

  // tbd
  [
    '({`{`|`;`}{CURLY_PAIR}=0,1) :eliminate empty blocks | ([NEWLINE]~[NEWLINE])=2,3 : eliminate empty lines, the tilde skips all non-newline whites, make sure 3 is not the last newline so one newline survives',
    '// result after comment elimination example\nfunction query(){\n  \n  \n  \nvar group0 = false;\nmatchedSomething = false;\n\n{\n\n\n\n{\nmatchedSomething = true;\n{ \n\ngroup0 = checkTokenBlack(symb() \n\n\n&& (matchedSomething = true) && checkConditionGroup(symgc()\n  && (true  && is(\'(\') && (true  && (token().rhp && skipTo(token().rhp.white)))))\n, \'0\', \'1\');\n} \n}\n\n\n\n}\n\n  \n  return group0;\n}\n',
    '',
    'regression: index is not being reset so the newlines dont match',
    REPEAT_EVERY,
    INPUT_COPY
  ],
  [
    '([NEWLINE](~[NEWLINE])+<)=2,3  |  ({`{`|`;`}~[NEWLINE]~[`{`]~[NEWLINE]<)=2,3',
    '// result after comment elimination example\nfunction query(){\n  \n  \n  \nvar group0 = false;\nmatchedSomething = false;\n\n{\n\n\n\n{\nmatchedSomething = true;\n{ \n\ngroup0 = checkTokenBlack(symb() \n\n\n&& (matchedSomething = true) && checkConditionGroup(symgc()\n  && (true  && is(\'(\') && (true  && (token().rhp && skipTo(token().rhp.white)))))\n, \'0\', \'1\');\n} \n}\n\n\n\n}\n\n  \n  return group0;\n}\n',
    '',
    'regression: crash',
    REPEAT_EVERY,
    INPUT_COPY
  ],

  [
    '(>(>))[`x`]',
    '  x',
    '  1', // if multiple 1's or higher numbers, the callback triggered more than once
    'should trigger a match only once and ignore the > symbols',
    REPEAT_ONCE,
    INPUT_NO_COPY,
    function(t){t.value = (t.value|0)+1; },
  ],
  [
    '((>|[`x`])[`;`])=0,1',
    '  x;',
    '  x$', // >; matches first so match starts at ;
    'should trigger a match only once and ignore the > symbols',
    REPEAT_EVERY,
    INPUT_NO_COPY,
  ],
  [
    '(([`x`]|>)[`;`])=0,1',
    '  x;',
    '  @$', // x; matches first so match starts at x
    'should trigger a match only once and ignore the > symbols',
    REPEAT_EVERY,
    INPUT_NO_COPY,
  ],
  [
    '((>|[`x`])~[`;`])=0,1',
    'x    ;',
    'x    ;', // >; matches first so match starts at ;
    // the `>~;` query should start at ; but the `x~;` should start at x
    // the x start should therefor match first
    'should match at x, refutes that "matchedSomething" can be determined at compile time, unless we tear it apart...',
    REPEAT_ONCE,
    INPUT_NO_COPY,
  ],

  // test that calls repeats (repeat or collect) but doesnt meet minimal quantity, trackback to another repeater...
  // test that repetitive callback is not called until min repetitions are seen
  // test invert and backtracking
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
