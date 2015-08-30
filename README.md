# Drew

Declarative Rewriting Expressions Wuuuut

Tokenize a language (or even just work on a bare string). Feed the tokens to Drew and apply your queries to do the rewriting.

# Queries

Every "query" is a matching rule. Each rule is translated to JS code to do the actual matching.
Drew is a DSL designed to make rewriting easier. It's main source inspiration are common regular expressions.

# Language CFG

- atoms: `atom` | `early-call` | `atom atoms`
- atom-complete: `atom` [`quantifier`] [`explicit-call`] [`designator-comment`]
- atom: `white-token` | `black-token` | `atom-group` | `line-boundary` | `seek`
- line-boundary: `'^^'` | `'^'` | `'$'` | `'$$'`
- white-token: `'['` `conditions` `']'` 
- black-token: `'{'` `conditions` `'}'` 
- atom-group: `'('` `atoms` `')'` 
- early-call: `'#'` [`designator-comment`]
- quantifier: `digits` | `digits` `'..'` `digits` | `digits` `'...'` | `'...'` `digits` | `'*'` | `'?'` | `'+'`
- digits: `digit` | `digits`
- digit: `'0'` | `'1'` | `'2'` | `'3'` | `'4'` | `'5'` | `'6'` | `'7'` | `'8'` | `'9'`
- designators: `'='` `designator-comment` [`comma-designator-comment`] | `'='` `comma-designator-comment`
- comma-designator-comment: `','` `designator-comment`
- designator-comment: `designator` [`comment`] 
- comment: `':'` `any-non-ambiguous-chars` // tbd
- designator: any combination of numbers and letters
- conditions: `condition` | `condition` `'|'` `conditions` | `condition` `'&'` `conditions` | `'!'` `condition`
- condition-group: `'('` `conditions` `')'` // tbd: !(x) is a loop :(
- condition: `literal` | `condition-group` | `macro` | `regex`
- literal: ``'`'`` `literal-unit` ``'`'`` [``'`'`` `'i'` ``'`'``] 
- literal-unit: any character except backslash | `escape`
- escape: `'\'` `one-character`
- macro: `any combination of letters`
- seek: `seek-type` [`digits`]
- seek-type:`'<'` | `'<<'` | `'>'` | '`>>'` | `'~'`

# Atoms

An atom is either a token match or a group. More exotic are the line boundary symbols or seeks, but generally when we're talking about an atom we mean either the token condition or a group of them.

# Tokens

All tokens in a query should be wrapped in `[]` or `{}`. You'll probably end up using `{}` mostly.

- `[matching criteria]` = start matching at the next white token
- `{matching criteria}` = start matching at the next non-white token which we call "black". This skips any white tokens when finding the token to start matching
- `(matching criteria)` = groups atoms and only "matches" when the query it wraps matches

# Split

In the next examples the function `split()` is used to chunk a string up in tokens. One token per character. Only spaces, tabs, and newlines become "WHITE" tokens, other characters are BLACK. They get the same "type".

The function should be available to you as well so you can experiment. Normally you would use this library on the result of an actual parser and most tokens are not a single character.

# Matching conditionals

These always go inside a token wrapper (`[]` or `{}`)

- Backticked text is quoted literals. `` `foo` `` = literal token value match for `foo`. Only inside a token or group. Must match entire token value. See regex for partial match.

```
run(split('foo'), '[`f`][`o`][`o`]', func, 'once', 'nocopy');
run(split('foo'), '[/^foo$/]', func, 'once', 'nocopy'); // same
``` 
 
- `` `...`i `` = same as literal token but with case insensitive match (will apply .toLowerCase() to either side first)

```
run(split('foo'), '[`Foo`i]', func, 'once', 'nocopy');
run(split('foo'), '[/^foo$/i]', func, 'once', 'nocopy'); // same
``` 

- `TAB` = (any identifier as-is) are macros or constants. see macros.js and constants.js. They are aliases for literals, other macros, hardcoded constants, or any combination thereof. Each can only be used either inside or outside tokens, depending on their definition. See related section below.

```
run(split('a \t b'), '[`a`][SPACE][TAB][SPACE][`b`]', func);
```

- `|` = "or"; `[A | B]` matches as a whole when at least the left or right side of the pipe matches individually (lazy eval). Can be used inside and outside tokens. `&` and `|` are processed left to right, same strength, and scope everthing in between. Use parens for disambiguation as they have no precedence over each other.

```
run(split('aabbababbaaab'), '[`a`]|[`b`]', func);
run(split('aabbababbaaab'), '[/(a|b)/]', func);


run(split('aabbababbaaab'), '[`a`][`a`]|[`b`][`b`]', func); // matches aa and bb, not ab nor ba
run(split('aabbababbaaab'), '[/((aa)|(bb))/]', func);

run(split('aabbababbaaab'), '[`a`][`a`|`b`][`b`]', func); // matches aab and abb, nothing else
run(split('aabbababbaaab'), '[/(a[ab]b)/]', func);
```

- `&` = "and"; `[A & B]` matches as a whole when both criteria A and B match. Can only be used inside tokens. They are implied outside of tokens so you don't need them there. `&` and `|` are processed left to right, same strength, and should only have one atom in between. Use parens for disambiguation as they have no precedence over each other.

```
run(split(' a\ta'), '[WHITE & TAB][`a`]', func); // only matches second a
run(split(' a\ta'), '[WHITE & TAB | SPACE][`a`]', func); // same as white&(tab|space)
```

- `()` = group criteria ``[SPACE | (ARG & `foo`)]`` or atoms

```
run(split(' b\ta a\tb'), '([WHITE & TAB][`a`]) | ([WHITE][`b`])', func);
```

- `*` = assert any one token. do not apply any other matching criteria (could be used together with other conditions, but why would you). Used to skip one token unconditionally.

```
run(split('abc'), '[`a`][*][`c`]', func);
```

- `!` = negate the next matching condition or group: `[!SPACE]` (you dont need peek, you can add multiple conditions for the same token with `&` and `|`). Only inside tokens.

```
run(split('abc'), '[`a`][!a & !c][`c`]', func);
```

- `/regex/flags` = a normal (JS) regular expression to apply to the whole value of the (one!) token (-> `token.value.test(/foo/)`).

```
run(split('abc'), '[/a[^ac]c/]', func);
run(split('abc'), '[`a`][!a & !c][`c`]', func); // same
```

# Matching with Regular Expression

Use this for partial matches.

```
run(split('abc'), '[/a[^ac]c/]', func);
// same as
run(split('abc'), '[`a`][!a & !c][`c`]', func);
// same as: matching an a and c with anything except a or c in between them
```

- Translates directly to doing `regex.test(token.value)`, as is.
- This is relatively slow (only because regular expressions are relatively slow in JS).
- Note that this is will do a partial match by default. You must use the `^` and `$` chars to make sure the whole regex match the whole token.
- Regular backslash rules apply, not double like you'd do in a string.
- Only the `i` flag is valid, other flags would be useless (due to the way `.test()` works). Other flags in the query will trigger a parse error.

# Start or end of line or file

This is the `line-atom` rule. These special tokens (no wrapper allowed) are used to match the start or end of a line or file.

```
run(split('abc\ndef\nghi'), '^^[`a`][`b`][`c`]', func); // matches start
run(split('abc\ndef\nghi'), '^^[`d`][`e`][`f`]', func); // no match
run(split('abc\ndef\nghi'), '^[*][*][*]', func); // matches all three
run(split('abc\ndef\nghi'), '^[*][*][*]$', func); // matches all three
run(split('abc\ndef\nghi'), '[*][*][*]$', func); // matches all three
run(split('abc\ndef\nghi'), '[`g`][`h`][`i`]$$', func); // matches end
run(split('abc\ndef\nghi'), '[`d`][`e`][`f`]$$', func); // no match
```

- `^`: Match start of line or file. Checks whether previous (white) token is a newline or whether current has index 0.
- `^^`: Match start of file. Checks whether current token has index 0.
- `$`: Match end of line or file. Checks whether _next_ (white) token is a newline or is EOF.
- `$$`: Match end of file. Checks whether _next_ (white) token is EOF.

Obviously the symbols are chosen to match regular expressions. These symbols will not consume the token they match. 

None of these influence the start or end index of a match directly (in particular when used at the start or end of a query).

Use the `~` (see lower) to seek to the next black token OR newline token.

```
run(split('abc    \n    def'), '[`a`][`b`][`c`]$', func); // no match
run(split('abc    \n    def'), '[`a`][`b`][`c`]~$', func); // matches
run(split('abc    \n    def'), '^[`d`][`e`][`f`]', func); // no match
run(split('abc    \n    def'), '^~[`d`][`e`][`f`]', func); // matches
```

I intend for the user to be able to define which tokens `~` should skip, like spaces and tabs in plain text, but spaces, tabs, comments, and perhaps also ASI's in JavaScript. Various languages may have their own needs. This is hard to generalize. Perhaps I should make this read from a MACRO instead... (tbd)

# Literal escaping

Use a backslash to escape a few things in literals (backtick quoted text)

- backslash: `` `foo\\bar` ``
- backtick: `` `foo\`bar` ``
- unicode escapes 4 digits: `` `foo\uNNNNbar` `` where `N` is a hexadecimal digit. This basically translates to `String.fromCharCode(parseInt(NNNN, 16))`.
- unicode escapes 6 digits: `` `foo\wNNNNNNbar` `` (`\w` is for "wide") where `N` is a hexadecimal digit. This basically translates to `String.fromCharCode(parseInt(NNNNNN, 16))`.
- hex escape `` `foo\xNNbar` ``, a two digit hexadecimal number representing a unicode code point.
- Right now any other character will be encoded as-is but that may change to a more restrictive check.

# Groups

- Tokens can be grouped with `()`
- They can have the same suffixes as single token conditions (quantifiers, designators, etc)
- They are considered an atom as a group

```
run(split('ababababc'), '([`a`][`b`])+[`c`]', func);
```

- Matching criteria (inside tokens) can be grouped too

```
[SPACE | (ARG & `foo`)]
```

# Whitespace

Nearly all whitespace in a query is insignificant and completely ignored.
 
Exceptions:

- Whitespace in a literal is significant

Whitespace is not allowed between:

- Whitespace in a literal
- A literal or regular expression and its flag
- Characters of the same identifier
- Digits of the same number
- Characters of an operator (`<<` `>>` `...` `^^` `$$`)

Whitespace is user configurable since it depends per language. You'll probably want to override this in the macro for your language of choice.

For text in `split()` it is predefined to "invisible" characters, or more specific the spaces, tab (0x9), vtab (0xb), newlines (0xa and 0xd), but this is defined in a macro. 

# Operator precedence

Operator precedence of `&` and `|` is right-to-left, both have same prio, lazy eval. Important examples:

- `true | foo()` does not evaluate `foo()` because it already knows it can pass ("lazy evaluation"). 
- `true & false | true` will evaluate to `false`, as the `&` will fail.
- `(true & false) | true` will evaluate to `true`, as the parenthesis cause the second `|` to be checked as well, now.

In JS `X && Y || Z` actually is the same as `(X && Y) || Z`, but in this spec `X & Y | Z` really means `X & (Y | Z)`.
This precedence is enforced by simply wrapping everything after each operator in parenthesis while translating:

- `X | Y & Z` always becomes `X || (Y && Z)` in JS.
- `X & Y | Z` always becomes `X && (Y || Z)` in JS.

Operator precedence of `!` is over the first next atom. Use a group to apply it to multiple atoms.
- `[!X | Y]` means a token that's not X or that is Y
- `[!(X | Y)]` means a token that's not X nor Y

The line ops `^` `^^` `$` `$$` and `~` have the same precedence as regular tokens (`[x]` and `{x}`).

# Colon-comments

In this spec, a colon-comment is a colon followed by any character that's not ambiguous to the start of an atom. At the time of writing that's `[{(`. 

They're only valid after atoms and explicit calls (`#`).

- `[X]=1: this is the second argument [Y]=2 : and this is the third` 

# Designators

In this spec, a designator is a regular identifier in JS extended by the possibility to start with a number as well. There's no syntactical situation where this leads to ambiguity since this syntax has no calculation expressions so there are not many places where such numbers are allowed.

They are used to map a token start/stop index to the callback arguments index or name. They bind to the last atom only.
 
```
run(split('ababababc'), '([`a`][`b`])', function(start){}); // only 0 is set (implicitly)
run(split('ababababc'), '([`a`][`b`])=0,1', function(start, stop){});
run(split('ababababc'), '([`a`][`b`])=,1', function(start, stop){}); // 0 is set implicitly
run(split('ababababc'), '([`a`][`b`])=start,stop', function(obj){ obj.start, obj.stop; }); // non-ints result in one obj
run(split('ababababc'), '([`a`][`b`])=start,1', function(obj){ obj.start, obj[1]; }); // even when mixed
run(split('ababababc'), '([`a`][`b`])=0start,1stop', function(obj){ obj[0start], obj[1start]; }); // names can start with numbers (unusual in coding)
```

# Quantifiers

Quantifiers quantify atoms in a regex-esque fashion. They can have a suffix which triggers callbacks for individual matches within the quantifier as well.

A quantifier only quantifies the previous atom, never more. Though of course this atom can be a group.

## Syntax

Quantifiers go immediately after the token/group wrapper and before the assignments or pound.

- `[X]8` = X must occur 8 times. Same as regex `{8}`
- `[X]1..3` = X must occur at least 1 and at most 3 times. Same as regex `{1,3}`
- `[X]5...` = X must occur at least 5 times, no upper bound. Same as regex `{5,}`
- `[X]...5` = X must occur at most 5 times, maybe less. Same as regex `{,5}`
- `[X]*` = X can have any number of occurrences, same as regex, same as `0...`
- `[X]+` = X must occur at least once, same as regex, same as `1...`
- `[X]?` = X must occur at most once, same as regex, same as `0..1`

```
run(split('abaabaaac'), '[`a`]', func, 'after'); // six matches
run(split('abaabaaac'), '[`a`]2', func, 'after'); // one match
run(split('abaabaaac'), '[`a`]2..3)', func, 'after'); // two matches
run(split('abaabaaac'), '[`a`]...3', func, 'after'); // three matches
run(split('abaabaaac'), '[`a`]2...', func, 'after'); // two matches
run(split('abaabaaac'), '[`a`]*', func, 'after'); // nine matches (empty string is also a match here)
run(split('abaabaaac'), '[`a`]?', func, 'after'); // nine matches (empty string is also a match here)
run(split('abaabaaac'), '[`a`]+', func, 'after'); // three matches
```

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

For each of these examples func is called with one object
(Note that `[y]1` is the same as `[y]`! Without quantifier a token should match once.)

```
run(split('xxxyyyy'), '[`x`][`y`]1=a,b', func, 'after');
// obj.a is the first y, obj.b the last y

run(split('xxxyyyy'), '[`x`][`y`]1@=a,b', func, 'after');
// called 4 times, each time obj.a is equal to obj.b, once for each y
// for each call, obj[0] is the first x (because implicit)

run(split('xxxyyyy'), '[`x`][`y`]*%=a', func, 'after');
// called once with {0:first x token, a:[3,3,4,4,5,5,6,6]} (start/stop of each step of quantified atom)

run(split('xxxyyyy'), '[`x`][`y`]*%=a,b', func, 'after');
// called once with {0:first x token, a:[3,4,5,6], b: [3,4,5,6]}
```

## Queue

Callbacks are stored in a queue while applying the query. Only if the entire rule matches the queued callbacks will trigger in order of registering them.

Multiple quantifiers in the same query can trigger callbacks. 
Multiple callbacks will trigger in order of encountering while matching (so not necessarily the order of appearance in the query).
One callback suffix can invoke multiple series of callback when nested in another quantifier that matches multiple times. They are simply queued.
Arguments are not cleared between these calls so last seen assignments are passed on before and after other quantifier callbacks.

- `[X][Y]*@[X][Z]*@` on `xxxxyyxxxzzz` -> queues 5 callbacks, 2 for `y` and 3 for `z`. Note the extra callback for the entire match. 
- `[X][Y]*@[X][Z]+@` on `xxxxyyxxx` -> queues 2 callbacks, but does not trigger them because there is no `z` and at least one was required.

# Designate tokens to arguments

The query syntax allows you to assign certain matched tokens to arguments of the callback function. You can choose whether these tokens are assigned directly to an argument index (and which), or you can have a single argument which is an object that contains one key for each designator you've used. Either way each argument or property will contain the matched token.

## Syntax

The settuping up a designator starts with an equal sign (`=`). These can follow after the optional quantifier of any atom and without quantifier directly after the atom. 

You can assign the start and end of the match of an atom (the end being relevant in a group or complex macro).

```
// assign start of a quantified match to the first argument
run(split('xxxxyyyyy'), '[`x`]+=0', function (xStart){ log(xStart); }, 'after');
// assign last token of quantified match to the first argument
run(split('xxxxyyyyy'), '[`x`]+=,0', function (xStart){ log(xStop); }, 'after');
// assign first and last token
run(split('xxxxyyyyy'), '[`x`]+=0,1', function (xStart, xStop){ log(xStart, xStop); }, 'after');

// or as an object

// assign start of a quantified match to the first argument
run(split('xxxxyyyyy'), '[`x`]+=a', function (obj){ log(obj.a); }, 'after');
// assign last token of quantified match to the first argument
run(split('xxxxyyyyy'), '[`x`]+=,b', function (obj){ log(obj.b); }, 'after');
// assign first and last token to props with number starting names
run(split('xxxxyyyyy'), '[`x`]+=0a,1b', function (obj){ log(obj['0a'], obj['1b']); }, 'after');
```

## Implicit start of match

The first argument (or named `0` key if an object) is implicitly created/passed on unless overridden.

- By default the first argument is the start of the match (if no `'0'` key was requested, it is always created and set to the start, but you can override this)
 - `({X}{Y})=5` -> puts `X` token into sixth argument (and the start into the first argument)
 - `{X}{Y}=0` -> puts `Y` token as first argument
 - `{X}{Y}=1{Z}=2` -> callback gets X Y Z as arguments in that order
 - `{X}({Y}{Z})=0,1` -> first param is Y, second param is Z
 - `{X}({Y}{Z})=,1` -> first param is X (implicit) and second param is Z
- Early callbacks clear the implicit zero too, it will be set as if the match started after encountering the pound sign
 - `{X}#{Y}` First callback will have first parameter set to `X` token, second call will have first parameter set to `Y` token.

## No match

If a certain part does not match and was optional, it will ignore the designator part.

- `[X]?=1` -> The second arg will be the `X` token if it was found, `undefined` otherwise.
- `[X]=1 [Y]?=1` -> The second arg will be `Y` token if it was found, otherwise it will be the `X` token
- `[X][Y]?=0` -> The first arg will be the `Y` token if it was found, otherwise it will be the `X` token (implicitly set when not assigned)

## Overriding

You can use the same designator multiple times in the same query. The last seen value for a certain designator before a callback is queued will be the one that will be passed on to it.

Only parts of a query that are part of the match are eligible to declare or override anything. Parts that don't contribute to the match (due to backtracking) will not declare nor clobber anything.
 
- `[X]=1 [Y]=1` -> The second arg will be the `Y` token because it was overridden.
- `[X]=1 [Y]?=1` -> The second arg will be `Y` if it was found, otherwise it will be `X`

You can override the `0` like anything else.

## Args as object

If the name of at least one matched designator isn't a positive integer the callback will receive one object with one key for every designator.

This is handled automatically.

The object will have an implicit `0` key with the token of the start of the match or explicit when overridden.

You can access "invalid" identifiers with dynamic properties: `obj['0_foo']`

- `{X}=the_x`
- `{X}=the_x {Y}=the_rest` -> The `the_rest` key becomes the `Y` token
- `{X}=0abx {Y}=2def :can  start with number` -> The keys can start with a number (unlike regular identifiers in JS)

# Comments

Use colon-comments to clarify certain args or add a description. Colon comments run from the colon to the first next `({[`.

- `{X} =1 :the x`
- `{X} =1 :the x {Y} =2 :the rest`

# Early callbacks

It's possible to trigger a callback multiple times, even from mid-way a query. All callbacks are queued while applying the rule. Only when the rule passes entirely will all individual callbacks be triggered in the order they were queued.
Can appear anywhere where a token may start. They can have an optional designator and optional colon-comment.
You can't use this to get a callback on a partial match since stuff is queued lazily and discarded when the match turns out to fail.

# Pointer manipulation

## ~ Seeking past spaces, tabs, and comments

Outside a token context you can use `~` to seek up to the next black token or newline. This will keep consuming whitespace until the current token is black or a newline. This will not consume anything if the current token is already black, a newline, the first token of input, or EOF.

While not required to be used in conjunction, this is available to use `^` and `$` because other mechanisms would consume the token. But beware that `{A}` is not exactly the same as `~[A]`; the tilde (`~`) will stop seeking after the first newline and won't seek at the start of input. The curly brackets do continue to seek in those cases.

_In Regex terms, this is similar to skipping as long as the current token matches `/[ \t]/`._

## > < >> << Skip one white or black token

Sometimes you may want to manipulate the pointer directly. You can use `>` or `<` to move one white token forward or backwards. You can use `>>` or `<<` to move one black token forward or backwards.

- `>` = move the pointer after the current white token
- `>>` = move the pointer after the first black token from current
- `<` = move the pointer before the previous white token
- `<<` = move the pointer back to before the first previous black token

These skips are unconditional. So if you want to skip 5 tokens but there are only 3 to skip, the match doesn't fail. The pointer will simply be at the start or end.

When used at the start of a query they are ignored so effectively useless... (use backjumps after matching something for the same effect)

If you need to jump more than one token, you can add a number to have Drew do this many jumps. So `>>5` skips the next five black tokens (similar to `{*}5`, though unconditionally).

Be careful! This mechanisms may allow you to cause infinite loops. There are awol loop protections in place but you don't want to trigger them.

- `{a}<{b}` - This would be the same as `{a & b}`, except it doesn't fail the match if the token does not exist
- `{a}>{b}` - This would be the same as `{a}[*]{b}`, except it doesn't fail the match if the token does not exist
- `{a}<<{b}` - Same as `{a & b}` because a match ends immediately after the token. `{a}{b}<<2{c}>>` would be the same as `{a&c}{b}`, but could be a quick forward check optimization (`c` wont be evaluated at all if `b` doesn't match anyways)
- `{a}>>{b}` - Same as `{a}{*}{b}`, skip a black token unconditionally, except it doesn't fail the match if the token does not exist
- `{a}>> 2{b}` - Same as `{a}{*}{*}{b}`, whitespace is ignored between the op and the number
- `{a}>>>{b}` - Silly, but same as `{a}{*}[*]{b}`, except it doesn't fail the match if the token does not exist
- `{a}>>>>{b}` - Sillier, but same as `{a}{*}{*}{b}`, except it doesn't fail the match if the token does not exist

One use case is in conjunction with repeat mode = `"after"` to make Drew jump back a bit after a match, such that the next match starts inside the previous match, while still having the partial advantage `"after"` offers.

Say you want to eliminate empty lines, you can match `([NEWLINE][WHITE & ^NEWLINE]*)=0,1[NEWLINE]<` on repeat and remove anything between and including matches. You can put drew in "after" mode, and after each match Drew will continue at the last newline that was matched so it can be the first token to match. Without this mechanism it'd be difficult to eliminate repetitive matches.

Another case I once had is eliminating two different things with a single query, where the second thing was part of the first:

```
console.log(x);
{
stuff;
}
```

I had a query that would eliminate console stuff AND blocks that weren't part of another statement. I used something like `({console}{.}{log}{parens}{semi_pair})|({semi}{curly_pair})` for this. The first part would match but then Drew would continue after this match and the semi colon would not be seen, meaning the second part would not match this example. Adding `<<` to the query would fix it.

## Multiple calls

To trigger an "early callback" simply add a pound sign. This is like saying "queue up a callback at this position with the current assignments and clear the assignments after the call".
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

## Handler names

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

# Examples (TBD)

```
[SPACE]
if (is(' ')) call(start())

[TAB]
if (is('\t')) call(start())

[WHITESPACE]
if (is(' ') || is('\t')) call(start())

[WHITE]
if (type() === WHITE) call(start())

(EXPRESSION){SEMI & !FOR_SEMI}=0
if (token().expressionStart) {
	nextAfter(token().expressionLastToken);
	nextBlack();
	if (is(';') && !token().forHeader) call(token());
}

[NEWLINE][TAB]*[SPACE]?=0[SPACE]?=1[COMMA]=2[SPACE]?=3
if (newlined()) {
	while (is('\t')) next();
	if (is(' ')) {
		args[0] = token()
		next()
	}
	if (is(' ')) {
		args[1] = token()
		next()
	}
	if (is(',')) {
		args[2] = token
		next()

		if (is(' ')) {
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
		if (is('{')) {
			args[1] = token();

			call(args);
		}
	}
}


```
