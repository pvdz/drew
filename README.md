all tokens in a query should be wrapped in `[]` or `{}`

- `[matching criteria]` = start matching at the next white token
- `{matching criteria}` = start matching at the next non-white token (skips any white tokens when matching)
- `(matching criteria)` = white or non-white is determined by the first token-criteria of the group

Matching criteria can be grouped `[SPACE | (ARG & `foo`)]`
Tokens can be grouped with `()` as well

Token matching criteria:
- `\`...\` = literal token value match (maybe with regex-like features like wildcards?)
- `TAB` = constants (tab, space, semi, expression, statement_header), aliases for `...` or certain groups of tokens. probably upper cased, maybe either.
- `|` = "or" `[A | B]` matches if it either matches criteria A or B
- `&` = "and" `[A & B]` matches if it matches criteria A and B
- `()` = group criteria `[SPACE | (ARG & `foo`)]`
- `*` = assert any one token. do not apply any other matching criteria.
- `!` = negate the next matching condition or group: `[!SPACE]` (you dont need peek, you can add multiple conditions for the same token with `&` and `|`)

Operator precedence of `&` and `|` is rtl, both have same prio, lazy eval. Important examples: 
- `true | foo()` does not evaluate `foo()` because it already knows it can pass ("lazy evaluation"). 
- `true & false | true` will evaluate to `false`, as the `&` will fail.
- `(true & false) | true` will evaluate to `true`, as the parenthesis cause the second `|` to be checked as well, now.
Operator precedence of `!` is over the first next condition or group. Use a group to apply it to multiple criteria.

Quantifiers quantify tokens and token-groups in a regex-esque fashion
- `1..3` = must occur at least 1 and at most 3 times. Same as regex `{1,3}`
- `5...` = must occur at least 5 times, no upper bound. Same as regex `{5,}`
- `*` = any number of occurrences of the previous token/group, same as regex, same as `0...`
- `+` = at least one, same as regex, same as `1...`
- `?` = at most one, same as regex, same as `0..1`

A quantifier only quantifies over the token or group that immediately precedes it, never more. 

You can pick out which tokens to receive in the callback by suffixing `=n`, where `n` is the argument offsetting at `0`. Note that for any group, the first token that matched is passed on.
alternatively you can get them as keys on an object by making `n` a non-integer identifier (the name can still lead with a number). if one such name is encountered, the callback receives one object.
if arg 0 was not assigned it will default to the start of the match.
you can only suffix these at token boundaries, after the (optional) quantifiers
`[FOO][BAR][EXPRESSION]=1{DOO}=2` -> `func(FOO-token, first-EXPRESSION-token, DOO-token)`
`[FOO][BAR][EXPRESSION]=exprstart{DOO}=doo` -> `func({0:FOO-token, exprstart:first-EXPRESSION-token, doo:DOO-token})`

all whitespace is insignificant and completely ignored except in literals
use a backspace to escape the backslash and the backtick in literals
you can use hex and unicode escapes in literals. other backslashed chars are added as is, without the backslash

you can define your own macros (or plugins), these act like constants, except you define them in terms of other
conditions/constants/macros. when a macro is encountered it will replace the group with whatever you defined it to be:
```
def('ADDITION', '{VALUE}{PLUS}{VALUE}')
[VAR]{IDENTIFIER}{IS}(ADDITION)
->
[VAR]{IDENTIFIER}{IS}{VALUE}{PLUS}{VALUE}
```

Some examples:


```
[SPACE]
if (value() === ' ') call(start())

[TAB]
if (value() === '\t') call(start())

[WHITESPACE]
if (value() === ' ' || value() === '\t') call(start())

[WHITE]
if (type() === WHITE) call(start())

(EXPRESSION){SEMI & !FOR_SEMI}=0
if (token().expressionStart) {
	nextAfter(token().expressionLastToken);
	nextBlack();
	if (value() === ';' && !token().forHeader) call(token());
}

[NEWLINE][TAB]*[SPACE]?=0[SPACE]?=1[COMMA]=2[SPACE]?=3
if (newlined()) {
	while (value() === '\t') next();
	if (value() === ' ') {
		args[0] = token()
		next()
	}
	if (value() === ' ') {
		args[1] = token()
		next()
	}
	if (value() === ',') {
		args[2] = token
		next()

		if (value() === ' ') {
			args[3] = token()

			call(args)
		}
	}
}

[VAR] [!`_`]=0
function(firstVarName) {
  firstVarName.before = '_\n\t,'
}

[NEWLINE][VAR]=0[WHITE]+([IDENTIFIER]({IS}{EXPRESSION}{,}?)?)+{SEMI}?=1[WHITESPACE]*[NEWLINE]?=2[WHITESPACE]*[!NEWLINE]

(FUNCTIONHEADER | STATEMENTHEADER)
([WHITE]2... | [NEWLINE])?=0
[CURLY_OPEN]=1
if (token().functionHeaderStart || token().statementHeaderStart) {
	if (token().functionHeaderStart) next(token().functionHeaderStopToken);
	else if (token().statementHeaderStart) next(token().statementHeaderStopToken);

	var start = token();
	var matched = false;
	if (nextIfType(WHITE, 2)) {
		args[0] = start;
		matched = true;
	} else if (nextIfType(NEWLINE, 1)) {
		args[0] = start;
		next();
		matched = true;
	}

	if (matched) {
		if (value() === '{') {
			args[1] = token();

			call(args);
		}
	}
}




```
