# Drew

Declarative Rewriting Expressions Wuuuut

Tokenize a language (or even just work on a bare string). Feed the tokens to Drew and apply your queries to do the rewriting.

# Queries

Every "query" is a matching rule. Each rule is translated to JS code to do the actual matching.
Drew is a DSL designed to make rewriting easier. It's main source inspiration are common regular expressions.

# Language CFG

atoms: `atom` | `atom | atoms`
atom: 'white-token | black-token | token-group | early-call | condition-group
white-token: `'[' conditions ']' [quantifier] [assignment]`
black-token: `'{' conditions '}' [quantifier] [assignment]`
token-group: `(atom)` | `(atom | atoms)`
early-call: `'#' designator [comment]`
condition-group: `'(' conditions ')'`
quantifier: `n` | `n '..' m` | `n '...'` | `'*'` | `'?'` | `'+'`
assignment: `'=' designator [comment]`
comment: `':' comment-chars-or-whitespace`
designator: `designator-chars`
conditions: `condition` | `condition '|' conditions` | `condition '&' condition` | `'!' condition`
condition: `literal` | `condition-group` | `macro`
literal: ``'`' any-but-backslash | escape '`'``
escape: `'\' char`
macro: `identifier`

# Tokens

All tokens in a query should be wrapped in `[]` or `{}`. You'll probably end up using `{}` mostly.

- `[matching criteria]` = start matching at the next white token
- `{matching criteria}` = start matching at the next non-white token (skips any white tokens when matching)
- `(matching criteria)` = white or non-white is determined by the first token-criteria of the group

# Matching criteria

These always go inside a token wrapper (`[]` or `{}`)

- `` `...` `` = literal token value match (maybe with regex-like features like wildcards?). Only inside a token or group. Currently must match entire token value. Future plans to extend this syntax for partial/regex matches.
- `TAB` = macros or constants. aliases for literals, other macros, or hardcoded constants, or any combination thereof. Each can only be used either inside or outside tokens. See section below. 
- `|` = "or" `[A | B]` matches if it either matches criteria A or B. Can be used in and outside tokens.
- `&` = "and" `[A & B]` matches if it matches criteria A and B. Can be used inside tokens. They are implied outside of tokens.
- `()` = group criteria ``[SPACE | (ARG & `foo`)]`` or tokens.
- `*` = assert any one token. do not apply any other matching criteria (could be used together with other conditions, but why would you). Used to skip one token unconditionally.
- `!` = negate the next matching condition or group: `[!SPACE]` (you dont need peek, you can add multiple conditions for the same token with `&` and `|`). Only inside tokens.

# Matching criteria outside token

While uncommon there are a few cases where you may want to do a matching criteria without being explicit about the token, and in fact where you don't want to move the token pointer at all.
Once such case is matching the start of the file (`SOF`) or line (`SOL`). These are hardcoded constants which check certain conditions but you may not want their match to consume a token in your query.
In such cases you can just wrap them in a group on the token level. A match will count towards matching the entire query, but not move the token pointer.
The behavior of using a quantifier on such groups is _undefined_. 

- `(SOL)[SPACE|TAB]*` Match all spaces and tabs at the start of a line. This would be much harder if you had to put `SOL` inside a token wrapper.

# Literal escaping

Use a backspace to escape a few things in literals

- backspace `foo\\bar`
- backtick ``foo\`bar``
- unicode escape `\uNNNN` where `NNNN` is a four digit hexadecimal number representing a unicode code point (TBD: 6 digits?)
- hex escape `\xNN`, a two digit hexadecimal number representing a unicode code point
- Right now any other character will be encoded as-is but that may change to a more restrictive check.

# Groups

- Tokens can be grouped with `()`
- Matching criteria can be grouped ``[SPACE | (ARG & `foo`)]``

# Whitespace

Nearly all whitespace in a query is insignificant and completely ignored. Exceptions are:
- Whitespace in a literal
- Characters of the same identifier
- Digits of the same number

# Operator precedence

Operator precedence of `&` and `|` is rtl, both have same prio, lazy eval. Important examples: 
- `true | foo()` does not evaluate `foo()` because it already knows it can pass ("lazy evaluation"). 
- `true & false | true` will evaluate to `false`, as the `&` will fail.
- `(true & false) | true` will evaluate to `true`, as the parenthesis cause the second `|` to be checked as well, now.

In JS `X && Y || Z` actually is the same as `(X && Y) || Z`, but in this spec `X & Y | Z` really means `X & (Y | Z)`.
This precedence is enforced by simply wrapping everything after each operator in parenthesis while translating:
- `X | Y & Z` always becomes `X || (Y && Z)` in JS.
- `X & Y | Z` always becomes `X && (Y || Z)` in JS.

Operator precedence of `!` is over the first next condition or group. Use a group to apply it to multiple criteria.
- `[!X | Y]` means a token that's not X or that is Y
- `[!(X | Y)]` means a token that's not X nor Y

# Colon-comments

In this spec, a colon-comment is a colon followed by alpha-numeric characters, dashes, underscores, (dollar signs ?? TBD), and whitespace until the first character that doesn't match this criteria.
It is only used in places where a comment makes sense and cannot lead to ambiguity (so outside of token wrappers, where identifiers are not allowed in arbitrary positions).

- `[X]=1: this is the second argument [Y]=2 : and this is the third` 

# Designators

In this spec, an designator is a regular identifier in JS extended by the possibility to start with a number as well (TBD: and maybe dashes). There's no syntactical situation where this leads to ambiguity.
It is used to define callback arguments and callback names. 

- `foo`
- `15`
- `1foo`
- `1_foo`

# Quantifiers

Quantifiers quantify tokens and token-groups in a regex-esque fashion. They can trigger callbacks for individual matches within the quantifier.
A quantifier only quantifies over the token or group that immediately precedes it, never more.

## Syntax

Quantifiers go immediately after the token/group wrapper and before the assignments or pound.

- `[X]1..3` = X must occur at least 1 and at most 3 times. Same as regex `{1,3}`
- `[X]5...` = X must occur at least 5 times, no upper bound. Same as regex `{5,}`
- `[X]*` = X can have any number of occurrences, same as regex, same as `0...`
- `[X]+` = X must occur at least once, same as regex, same as `1...`
- `[X]?` = X must occur at most once, same as regex, same as `0..1`

## Callback suffix

Sometimes you'll want to get a callback for each match within a quantifier (like all statements in a function body).
These callback signifiers are suffixed to the quantifier and can trigger the callback in three different ways:

- default = no suffix, no explicit callbacks ran inside the quantifier. If the quantifier is assigned it will assign start and end token of entire match under the quantifier.
 - `[X][Y]*=a,b` on `'xxxyyyy'` -> run callback once, 0 = 2, a = 3 and b = 6
- `@` = run once for each (possibly repeated) match. Assign the start-end of each match individually
 - `[X][Y]*@=a,b` on `'xxxyyyy'` -> run callback for each match of Y, 0 = 2, a = 3 and b = 3, then 0 = 2, a = 4 and b = 4, then 0 = 2, a = 5 and b = 5, and finally 0 = 2, a = 6 and b = 6   
- `%` = collect all positions (start-end of each match in an array) and run callback once at the end
 - `[X][Y]*%=a,b` on `'xxxyyyy'` -> run callback once, 0 = 2, a = [3,4,5,6] and b = [3,4,5,6]   
 - `[X][Y]*%=a` on `'xxxyyyy'` -> run callback once and collect pairs of ranges on the single param, 0 = 2, a = [3,3,4,4,5,5,6,6]

## Queue

Callbacks are stored in a queue while applying the query. Only if the entire rule matches the queued callbacks will trigger in order of registering them.

Multiple quantifiers in the same query can trigger callbacks. 
Multiple callbacks will trigger in order of encountering while matching (so not necessarily the rtl-order in the query).
One callback suffix can invoke multiple series of callback when nested in another quantifier that matches multiple times. They are simply queued.
Arguments are not cleared between these calls so last seen assignments are passed on before and after other quantifier callbacks.

- `[X][Y]*@[X][Z]*@` on `xxxxyyxxxzzz` -> queues 5 callbacks, 2 for `y` and 3 for `z`. Note the extra callback for the entire match. 
- `[X][Y]*@[X][Z]+@` on `xxxxyyxxx` -> queues 2 callbacks, but does not trigger them because there is no `z` and at least one was required.

# Assignments

You can determine which tokens to receive as which parameters of the callback, or as keys in an object passed on to the callback
Assignments go after the quantifiers and pound.

## Syntax

The assignment starts with an equal sign (`=`). 

- It is either followed by:
 - a designator, optionally followed by a colon-comment or
 - a comma which must be followed by a(nother) designator, optionally followed by a colon-comment

- Examples:
 - `[X]=1` => put x in second parameter (0 being the first)
 - `[STATEMENT]=1,2` => put first token of statement in second param, last token of statement in third param 
 - `[STATEMENT]=,5` => only put last token of statement in sixth param (ignore start) 
 - `[STATEMENT]=1:start of statement` => colon-comment
 - `{X}1..2=a,b` => Assignments always go _after_ (optional) quantifiers

- Callback examples
 - `[X][Y][EXPRESSION]=1{Z}=,2` -> `func(X, EXPRESSION, Z)`
 - `[X] [Y] [EXPRESSION]=expr_start {Z}=2_doo` -> `func({0:X, expr_start:EXPRESSION, '2_doo':Z})`

## Overriding

You can use the same designator multiple times in the same query. The last seen value for a certain designator before a callback is queued will be the one that will be passed on to it.
 
- `[X]=1 [Y]=1` -> The second arg will be the `Y` token because it was overridden.
- `[X]=1 [Y]?=1` -> The second arg will be `Y` if it was found, otherwise it will be `X`

## No match

If a certain part does not match and was optional, it will ignore the assignment part, passing on `undefined` or the previous assigned value.

- `[X]?=1` -> The second arg will be the `X` token if it was found, `undefined` otherwise.
- `[X]=1 [Y]?=1` -> The second arg will be `Y` token if it was found, otherwise it will be the `X` token
- `[X][Y]?=0` -> The first arg will be the `Y` token if it was found, otherwise it will be the `X` token (implicitly set when not assigned)

## Implicit start of match

The first argument (or named `0` key if an object) is implicitly created/passed on unless overridden.

- By default the first argument is the start of the match (if no `'0'` key was requested, it is always created and set to the start, but you can override this)
 - `({X}{Y})=5` -> puts `X` token into fifth argument (and the start into the first argument)
 - `{X}{Y}=0` -> puts `Y` token as first argument
 - `{X}{Y}=1{Z}=2` -> callback gets X Y Z as arguments in that order
 - `{X}({Y}{Z})=0,1` -> first param is Y, second param is Z
 - `{X}({Y}{Z})=,1` -> first param is X (implicit) and second param is Z
- Early callbacks clear the implicit zero too, it will be set as if the match started after encountering the pound sign
 - `{X}#{Y}` First callback will have first parameter set to `X` token, second call will have first parameter set to `Y` token.

## Comments

Use colon-comments to clarify certain args

- `{X} =1 :the x`
- `{X} =1 :the x {Y} =2 :the rest`

## Args as object

If the name of at least one arg isn't a positive integer, the callback will receive one object with one key for every arg.
This is handled automatically.
The object will have an implicit `0` key with the token of the start of the match unless overridden.
You can access "invalid" identifiers with dynamic properties: `obj['0_foo']`

- `{X}=the_x`
- `{X}=the_x {Y}=the_rest` -> The `the_rest` key becomes the `Y` token
- `{X}=0abx {Y}=2def :can  start with number` -> The keys can start with a number (unlike regular identifiers in JS)

# Early callbacks

It's possible to trigger a callback multiple times, even from mid-way a query. All callbacks are queued while applying the rule. Only when the rule passes entirely will all individual callbacks be triggered in the order they were queued.
Can appear anywhere where a token may start. They can have an optional designator and optional colon-comment.

## Multiple calls

To trigger an early callback simply add a pound sign. This is like saying "queue up a callback at this position with the current assignments and clear the assignments after the call".
You cannot prevent the last implicit call of a match. If you're looking to prevent it you should look into rewriting your query instead.
If the query has an explicit call at the end of the query it will replace the implicit query, though.

- `[X]#[Y]`
- The last callback is implied, but can be made explicit (can be useful, see below)
 - `[X]#[Y]#` === `[X]#[Y]`
- Colon-comments allowed
 - `[X] #:first part [Y] #:second part` === `[X]#[Y]`

## Clears assignments

Another feature is that it will clear the argument stack for the next callback.
It makes more sense in complex queries, like formatting a function where one callback formats the header while the others format the body. Each callback only needs a certain set of args. And you certainly don't want to reformat the header for each statement in the body.
Note that this also affects the last implicit callback

- `[X]=1,2#[Y]=3` => The callback is first called with three parameters (start, first x, last x), and then again with two parameters and two empty places (start, _, _, first y)
- `[X]=1,2#[Y]=1` => This differs from regular callbacks (`[X]=1,2[Y]=1`) in that the third parameter (`2`) is not passed on for the second call.

## Handler designators

You can use designators after each pound to identify which callback to call.
You can use this to have multiple handlers of different parts of the query

- `[X]=1,2 #0 [Y]=3 #1` => Calls two different callback functions (`0` and `1`) once the entire query matches. Note that the implicit call doesn't happen because of the explicit one at the end.
- Defaults to `0` if no designator was found
- You can use designators
 - `[X]=1,2 #foo :calls the foo callback [Y]=3 #bar :and the bar callback`

## Compared to quantifier callbacks

Quantifiers support a similar callback scheme with `@` and `%`, which does support designators, but which won't clear the argument stack.
Quantifier callbacks for `@` also trigger for each individual quantified match (`@`), where early callbacks only trigger after matching the entire quantified condition.

## Conditional

Like anything else, and because these callbacks are queued, these early callbacks can be conditional and if a later condition on the same level doesn't match, the callback doesn't trigger and the arg stack is not cleared.

- `[X]=1[Y]=2(#[Z]?=3)`
 - applied to `xyf` causes `callback(x, y)` because there was no `z` and so the group didn't match so the `#` was queued but ignored/reverted
 - applied to `xyz` causes `callback(z, undefined, undefined, z)`

# Macros

They are like aliases of literals or other macros or constants, can be used to combine any other macro's. They are 
extrapolated recursively and can be viewed as simple string replacements while parsing a query. Pretty much any valid 
part of a query can be put in a macro. Macros don't are not validated individually. Only the query as a whole is 
validated. However, since macros do have to be a unit inside a matching condition or group, they must inherently be
valid for the query to be valid. (Meaning you can't use a partial invalid query because you can't really "combine" 
them without putting at least `&` or `|` between them.)

- `[SPACE]` -> ``[` `]``
- `(ADDITION)` -> `{NUMBER}{PLUS}{NUMBER}` -> ``{NUMBER}{`+`}{NUMBER}``
- `{FOO}` -> `XXXX=5:this is foo`

# Constants

Hardcoded macros that translate to code directly.
For debugging; constants are not extrapolated until the actual code generation phase. This is why you'll see the constants left untranslated in the "final" query.
Constants will always be wrapped in parenthesis when extrapolating. This prevents issues when looking at constants as a unit during declaration time.

- `(SOF)` -> `if (SOF) ...` -> `if (!!index()) ...`
- `SOL: '!!index() || newlined(-1)'` when used in `[SOL & SPACE]` becomes something like `if ((!!index() || newlined(-1)) && value(' ')) ...`, note the extra wrap for SOL.

# Examples (TBD)

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
