# Drew

Declarative Rewriting Expressions Wuuuut

Tokenize a language (or even just work on a bare string). Feed the tokens to Drew and apply your queries to do the rewriting.

The goal of this library is to make it easy to manipulate, investigate, and rewrite tokenized input. Drew allows you to work on tokens in a similar way as <code>string.replace</code> works in JavaScript.

You have input, usually pre-processed by a lexer of your choice, and a query or regular expression and apply this query to the input. A callback is called whenever a match is found.

# run()

To put Drew to work you call the global function `run` (tbd).

```
var tokens = run(
  'foo or bar', 
  '[`f`]=0[`o`]=1[`o`]=2', 
  function(a,b,c){ a.value = 1; b.value = 2; c.value = 3; }
);
console.log(tokens.map(function(o){ return o.value; }).join(''); // -> '123 or bar'
```

You can pass on a string to use the built in string splitter. You can also pass on an array of tokens of pre-parsed input with a custom parser. Only if first argument is a string, Drew will use its own `split()` on them.

The full api of `run` looks like this: `run(input, queryCode, handler, repeatMode, copyInputMode, startTokenIndex, stopTokenIndex)`

- `input`: either a string or an array of tokens. Note that if an array, it will be the same reference that's returned.
- `queryCode`: string, the query to apply to the input
- `handler`: function or string. A callback is called on every call. If this is a string any time a callback would be called it clears the tokens of the entire range of the match and set the value of the first token to this string.
- `repeatMode`: string, optional, one of 'once', 'every', 'after'
- `copyInputMode`: string, optional, one of 'copy', 'nocopy'
- `startTokenIndex`: number, optional, token index where Drew should start matching
- `stopTokenIndex`: number, optiona, token index (inclusive) where Drew should stop matching

It will return an array of tokens. If input was a string it will be a fresh array, otherwise the same. Note that tokens are only changed by your callback, if at all.

# Queries

Every "query" is a matching rule. Each rule is translated to JS code to do the actual matching.

Drew is a DSL designed to make rewriting easier. It's main source inspiration are common regular expressions.

## Query language CFG

Comments are considered a space as a whole. They can appear between any other token.

- comment: `comment-simple` | `comment-line` | `comment-multi`
  - comment-simple: `':'` `simple-comment-chars` [`';'`]
  - simple-comment-chars: `simple-comment-chars` | `simple-comment-char`
  - simple-comment-char: `/[a-zA-Z0-9\s_-]+/` // TBD...
  - comment-line: `'::'` `anything-until-newline` `newline`
  - comment-multi: `':::'` `anything-except-triple-colons` `':::'`
  - newline: `'\n'`
  - whitespace: `' '` | `'\t'` | `newline`

The early call triggers a callback which flushes the current queue. They can appear between any token.
  
- early-call: `'#'` 

The atom is the main core concept of the language.

- atoms: `atom-complete` | `atom-complete` `atoms`
- atom-complete: `atom` [`quantifier`] [`designation`]
  - atom: `white-token` | `black-token` | `atom-group` | `line-boundary` | `seek`
    - white-token: `'['` `conditions` `']'` 
    - black-token: `'{'` `conditions` `'}'` 
    - atom-group: `'('` `atoms` `')'` 
    - line-boundary: `'^^'` | `'^'` | `'$'` | `'$$'`
    - seek: `seek-type` [ `digits` ]
      - seek-type:`'<'` | `'<<'` | `'>'` | '`>>'` | `'~'` | `'-->'`
- quantifier: `digits` | `digits` `'..'` `digits` | `digits` `'...'` | `'...'` `digits` | `'*'` | `'?'` | `'+'`
  - digits: `digit` | `digits`
  - digit: `'0'` | `'1'` | `'2'` | `'3'` | `'4'` | `'5'` | `'6'` | `'7'` | `'8'` | `'9'`
- designation: `'='` `identifier` [`','` `identifier`] | `'='` `','` `identifier`
  - identifier: `/[a-zA-Z0-9]+/` // note: can start with a number... by design!

Conditions (or "matching conditionals") are rules to match a token. There are a few ways to match a token and some logic options.
  
- conditions: `condition` | `condition` `'|'` `conditions` | `condition` `'&'` `conditions` | `'!'` `condition`
  - condition: `literal` | `condition-group` | `macro` | `regex`
    - condition-group: `'('` `conditions` `')'` 
    - literal: ``'`'`` `literal-unit` ``'`'`` [``'`'`` `'i'` ``'`'``] // `foo` for case sensitive or or `foo`i` for case insensitive
    - regex: `js-regex-literal`
  - literal-unit: `any character except backslash` | `escape`
  - escape: `'\'` `any character`
  - macro: `any combination of letters`

# Atoms

An atom is either a token match or a group. More exotic are the line boundary symbols or seeks. Generally when we speak of atoms we speak of one or more tokens.

# Tokens

All tokens in a query should be wrapped in `[]` or `{}`. You'll probably end up using `{}` mostly.

- `[matching conditionals]` = start matching at the next white token
- `{matching conditionals}` = start matching at the next non-white token which we call "black". This skips any white tokens when finding the token to start matching
- `(matching conditionals)` = groups atoms and only "matches" when the query it wraps matches

# Split

In the next examples the function `split()` is used to chunk a string up in tokens. One token per character. Only spaces, tabs, and newlines become "WHITE" tokens, other characters are BLACK. They get the same "type".

The function should be available to you as well so you can experiment. Normally you would use Drew on the result of an actual parser and there most tokens won't be a single character.

# Matching conditionals

These always go inside a token wrapper (`[]` or `{}`)

- Backticked text means quoted literals. `` `foo` `` = literal token value match for a token with value `foo`. Must match entire token value. See regex for partial match.
- Regex has the syntax of JS without the flags suffix and is translated to a regex as is and then tested against the token value.

```
run(split('foo'), '[`f`][`o`][`o`]', func, 'once', 'nocopy');
run(split('foo'), '[/^foo$/]', func, 'once', 'nocopy'); // this would be the same thing
``` 
 
- `` `...`i `` = same as literal token but with case insensitive match (will apply .toLowerCase() to either side first). For regular expressions this means what it normally means.

```
run(split('foo'), '[`Foo`i]', func, 'once', 'nocopy');
run(split('foo'), '[/^foo$/i]', func, 'once', 'nocopy'); // same
``` 

- `/regex/flags` = a normal (JS) regular expression to apply to the whole value of the (one!) token (-> `/foo/.test(token.value)`).

```
run(split('abc'), '[/a[^ac]c/]', func);
run(split('abc'), '[`a`][!a & !c][`c`]', func); // same
```

- `TAB` = (any identifier as-is) are macros or constants. see macros.js and constants.js. They are aliases for literals, other macros, hardcoded constants, or any combination thereof. Each can only be used either inside or outside tokens, depending on their definition. See related section below.

```
run(split('a \t b'), '[`a`][SPACE][TAB][SPACE][`b`]', func);
```

- `|` = "or"; `[A | B]` matches as a whole when at least the left or right side of the pipe matches individually (lazy eval)

Can be used inside and outside tokens. 

`&` and `|` are processed left to right, same strength, and scope everything in between. Use parenthesis for disambiguation.

```
run(split('aabbababbaaab'), '[`a`]|[`b`]', func);
run(split('aabbababbaaab'), '[/(a|b)/]', func);


run(split('aabbababbaaab'), '[`a`][`a`]|[`b`][`b`]', func); // matches aa and bb, not ab nor ba
run(split('aabbababbaaab'), '[/((aa)|(bb))/]', func);

run(split('aabbababbaaab'), '[`a`][`a`|`b`][`b`]', func); // matches aab and abb, nothing else
run(split('aabbababbaaab'), '[/(a[ab]b)/]', func);
```

- `&` = "and"; `[A & B]` matches as a whole when both criteria A and B match

Can only be used inside tokens. 

They are implied outside of tokens so you don't need them there. Inside tokens you can stitch conditions together. 

`&` and `|` are processed left to right, same strength, and scope everything in between. Use parenthesis for disambiguation.

```
run(split(' a\ta'), '[WHITE & TAB][`a`]', func); // only matches second a
run(split(' a\ta'), '[WHITE & TAB | SPACE][`a`]', func); // same as white&(tab|space)
```

- `()` = group criteria ``[SPACE | (ARG & `foo`)]`` or atoms ``[SPACE] (ARG | `foo`)]``

```
run(split(' b\ta a\tb'), '([WHITE & TAB][`a`]) | ([WHITE][`b`])', func);
```

- `*` = assert any one token 

Not to be confused with the quantifier.

Do not apply any other matching criteria (could be used together with other conditions, but why would you, it will match a token regardless).
 
Used to skip one token unconditionally.

```
run(split('abc'), '[`a`][*][`c`]', func);
```

- `!` = negate the next matching condition or group
 
Only works inside tokens.

```
run(split('abc'), '[`a`][!a & !c][`c`]', func);
```

# Partial matches with regular expressions

When you use regular expressions, `^` means the start of a token and `$` the end of a token. You can use this to do partial matches and/or more complex searches.

```
run(split('abc'), '[/a[^ac]c/]', func);
// same as
run(split('abc'), '[`a`][!a & !c][`c`]', func);
// same as: matching an a and c with anything except a or c in between them
```

- Translates directly to doing `regex.test(token.value)`, as is.
- This is relatively slow (only because regular expressions are relatively slow in JS).
- Note that this is will do a partial match by default. You must use the `^` and `$` chars to make sure the whole regex match the whole token.
- Regular regex literal backslash rules apply, not double like you'd do in a string.
- Only the `i` flag is valid, other flags would be useless (due to the way `.test()` works). Other flags in the query will trigger a parse error. TBD: maybe i'll support them, anyways, because it doesn't really matter to me so why be overly defensive.

# Start or end of line or file

This is the `line-atom` rule. These special tokens (not allowed inside token matching conditions) are used to match the start or end of a line or file.

- `^`: Match start of line or file. Checks whether previous (white) token is a newline or whether current has index `0`.
- `^^`: Match start of file. Checks whether current token has index `0`.
- `$`: Match end of line or file. Checks whether _next_ (white) token is a newline or is EOF.
- `$$`: Match end of file. Checks whether _next_ (white) token is EOF.

```
run(split('abc\ndef\nghi'), '^^[`a`][`b`][`c`]', func); // matches start
run(split('abc\ndef\nghi'), '^^[`d`][`e`][`f`]', func); // no match
run(split('abc\ndef\nghi'), '^[*][*][*]', func); // matches all three
run(split('abc\ndef\nghi'), '^[*][*][*]$', func); // matches all three
run(split('abc\ndef\nghi'), '[*][*][*]$', func); // matches all three
run(split('abc\ndef\nghi'), '[`g`][`h`][`i`]$$', func); // matches end
run(split('abc\ndef\nghi'), '[`d`][`e`][`f`]$$', func); // no match
```

Obviously the symbols are chosen to match regular expressions. These symbols will _not_ consume the token they match. 

None of these influence the start or end index of a match directly (in particular when used at the start or end of a query). 

# Custom seek

TODO... the tilde `~` probably ends up a customizable seek. Mainly because what makes sense in one language may not make sense in another.

The rest is old...

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
- Groups can be grouped, quantified, and everything like other atoms

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

- Whitespace in a literal is significant. Of course.

Whitespace (insignificant) is not allowed in a query between:

- Whitespace in a literal
- A literal or regular expression and its flag
- Characters of the same identifier
- Digits of the same number
- Characters of the same operator (`<<` `>>` `...` `^^` `$$`)

There is also the concept of whitespace while parsing. 

The `[]` targets the first next "white" token, meaning a whitespace token. The `{}` targets the first next "black" token, meaning any kind fo token.

What whitespace means that case is language dependent and you'll have to configure it through macros. Many language have similar rules, but it's the edge cases that still require custom configurations.

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

There are three types of comments in this spec:

- single colon; "simple comment". You can only use whitespace, alphanumeric, dash, dollar, and underscores for these simple comments. They are intended to be used inside tokens
  - You can explicitly end a simple comment with a semi-colon. Using a character that's invalid for simple comments will also end the simple comment
- double colon; "line comment". Anything until and including the first next newline is assumed to be part of a line comment
- triple colon; "multi line comment". Anything up to the next occurrence of a triple colon is considered part of a multi line comment. You cannot escape the triple colon inside it.

```
[FOO]:parse a foo [BAR]: and parse a bar; :you can chain comments if you want

[FOO] :: anything [ is allowed { here :)

:::
: Now we can type anything! :D
: Maybe even nicely
: But probably not.
:::
```

# Designators and identifiers

A "designator" means the assignment of the start and/or end of a match of the previous atom to a callback arg. The identifier is then the argument being targeted, either an argument index or object property depending.
 
A designator always starts with an assignment and goes after the quantifier. You can assign the start and the end divided by a comma: `=x,y`. The start is optional, so you can do `=,x` to just assign the end.

Unlike JS and most other languages, the identifier may start and just be a number, or may just start with a number. It doesn't lead to ambiguity in this DSL and actually allows a nice trick.

Identifiers used can have to results for the callback:

- If you exclusively use numbered identifiers they will signify indexes of arguments on the callback
- If you use _at least_ once identifier that is not numbers only, the callback receives an object with a key for each identifier used

You can describe index identifiers with a short comment easily;

```
[FOO]+=1:start, 2:end    :: parse at least one FOO token. Your callback is called `func(10, 20)`, or whatever numbers
```

Alternatively, and you'll need this with many such designators, you can force your callback to receive an object with all the values:

```
[FOO]+=start, end        :: your callback is called `func({start: 10, end: 20})`, or whatever numbers 
```

Designators bind to the last atom only.
 
```
run(split('ababababc'), '([`a`][`b`])', function(start){}); // only 0 is set (implicitly)
run(split('ababababc'), '([`a`][`b`])=0,1', function(start, stop){});
run(split('ababababc'), '([`a`][`b`])=,1', function(start, stop){}); // 0 is set implicitly
run(split('ababababc'), '([`a`][`b`])=start,stop', function(obj){ obj.start, obj.stop; }); // non-ints result in one obj
run(split('ababababc'), '([`a`][`b`])=start,1', function(obj){ obj.start, obj[1]; }); // even when mixed
run(split('ababababc'), '([`a`][`b`])=0start,1stop', function(obj){ obj[0start], obj[1start]; }); // names can start with numbers (unusual in coding)
```

Note that the index is unaffected by seeks at the start or end of a (sub) query. TODO: any seek? I think so...?

# Quantifiers

Quantifiers quantify atoms in a regex-esque fashion.

A quantifier only quantifies the previous atom, never more. Groups are atoms too.

## Syntax

Quantifiers go immediately after the token/group wrapper and before the designators.

- `[X]8` = X must occur 8 times. Same as regex `{8}`
- `[X]1..3` = X must occur at least 1 and at most 3 times. Same as regex `{1,3}`
- `[X]5...` = X must occur at least 5 times, no upper bound. Same as regex `{5,}`
- `[X]...5` = X must occur at most 5 times, maybe less. Same as regex `{,5}`
- `[X]*` = X can have any number of occurrences, same as regex, same as `0...`
- `[X]+` = X must occur at least once, same as regex, same as `1...`
- `[X]?` = X must occur at most once, same as regex, same as `0..1`

So yes, you use a numbered quantifier the same as you would use `+` `*` and `?`, no other characters required. But you may add whitespace :)

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

Note that if you want to add a short comment between an atom and its quantifier, you'll need to use a semi-colon to terminate the comment or else the quantifier is (at least partially) consumed by the comment.

```
[X] 8               :: matches if 8 X tokens are found
[X] 8, 10           :: matches if found 8, 9, or 10 times
[X] :yeah 8, 10     :: same as [X],10 because numbers are allowed in short comments
[X] :yeah;8, 10     :: same as [X]8,10
```

# Callback args

The query syntax allows you to assign certain matched tokens to arguments of the callback function. You can choose whether these tokens are assigned directly to an argument index (and which), or you can have a single argument which is an object that contains one key for each designator you've used. Either way each argument or property will contain the matched token.

## Syntax

Designator starts with an equal sign (`=`). These can follow after the optional quantifier of any atom and without quantifier directly after the atom. 

You can only assign the first and last token of a matched atom. The end is relevant if you match a group or repetition of atoms. You can also only get the first or last token in an arg.

```
// assign start of a quantified match to the first argument
run('xxxxyyyyy', '[`x`]+=0', function (xStart){ log(xStart); }, 'after');
// assign last token of quantified match to the first argument
run('xxxxyyyyy', '[`x`]+=,0', function (xStart){ log(xStop); }, 'after');
// assign first and last token
run('xxxxyyyyy', '[`x`]+=0,1', function (xStart, xStop){ log(xStart, xStop); }, 'after');

// or as an object

// assign start of a quantified match to the first argument
run('xxxxyyyyy', '[`x`]+=a', function (obj){ log(obj.a); }, 'after');
// assign last token of quantified match to the first argument
run('xxxxyyyyy', '[`x`]+=,b', function (obj){ log(obj.b); }, 'after');
// assign first and last token to props with number starting names
run('xxxxyyyyy', '[`x`]+=0a,1b', function (obj){ log(obj['0a'], obj['1b']); }, 'after');
```

## Start of match implied first argument

- By default the first argument is the start of the match (if no `'0'` key was requested, it is always created and set to the start, but you can override it)
 - `({X}{Y})=5` -> puts `X` token into sixth argument (and the start into the first argument)
 - `{X}{Y}=0` -> puts `Y` token as first argument
 - `{X}{Y}=1{Z}=2` -> callback gets X Y Z as arguments in that order
 - `{X}({Y}{Z})=0,1` -> first param is Y, second param is Z
 - `{X}({Y}{Z})=,1` -> first param is X (implicit) and second param is Z

## No match

If a certain part does not match and was optional, it will ignore the designator part. Drew will always try to call your callback with as few parameters as possible.

- `[X]?=1` -> The second arg will be the `X` token if it was found, `undefined` otherwise.
- `[X]=1 [Y]?=1` -> The second arg will be `Y` token if it was found, otherwise it will be the `X` token
- `[X][Y]?=0` -> The first arg will be the `Y` token if it was found, otherwise it will be the `X` token (implicitly set when not assigned)

## Overriding

You can use the same designator multiple times in the same query. Just like the implied `0`, the last seen token for a certain designator before a callback is called will be the one that will be passed on to it.

Only parts of a query that are part of the match are eligible to declare or override anything. Parts that don't contribute to the match (due to backtracking) will not declare nor clobber anything.
 
- `[X]=1 [Y]=1` -> The second arg will be the `Y` token because it was overridden.
- `[X]=1 [Y]?=1` -> The second arg will be `Y` if it was found, otherwise it will be `X`

## Args as object

If the name of at least one matched designator isn't a positive integer the callback will receive one object with one key for every designator.

This is handled automatically.

The object will have an implicit `0` key with the token of the start of the match or explicit when overridden. TODO: should that still be the case for objects?

You can access "invalid" identifiers with dynamic properties: `obj['0_foo']`

- `{X}=the_x`
- `{X}=the_x {Y}=the_rest` -> The `the_rest` key becomes the `Y` token
- `{X}=0abx {Y}=2def :can  start with number` -> The keys can start with a number (unlike regular identifiers in JS)

# Pointer manipulation (seeking)

Drew offers a few ways to seek explicitly with and without being a match condition.

## Customizable conditional seek: `~`

Outside a token context you can use `~` to seek in a custom way. The symbol is defined as a macro in macros.js and allows you to seek an arbitrary (sub)query.

The original intent was to have `~` be a way to seek towards the next newline or black token unless at the start of input. To use in conjunction with the line start/stop matchers (`^` etc.). But since every language needs its own definitions of what to skip in such case there was no simple way to generalize on that. Plain text will want to skip spaces and tabs but JavaScript will also want to skip comments and ASI tokens.

One special property of `~` is that it does not contribute to a valid match as long as no other part of the query has matched. This is an optimization step and shouldn't really affect your query, anyways. Drew will still try to match the query but if it seeked any tokens while no other part has matched anything yet, the `~` will fail and backtracking/bailing starts.

By default `~` is implemented as skipping all spaces and tabs for plain text and as skipping spaces, tabs, comments, and ASI's in JavaScript. Though you can change that as well of course.

## Skip a white or black token unconditionally `>` `<` `>>` `<<` 

Sometimes you may want to manipulate the pointer directly. You can use `>` or `<` to move one white token forward or backwards. You can use `>>` or `<<` to move one black token forward or backwards.

What it means for a token to be "white" is configurable per language. For example, JS will want to include ASI but that doesn't make sense in other languages.

- `>` = move the pointer after the current white token
- `>>` = move the pointer after the first black token from current
- `<` = move the pointer before the previous white token
- `<<` = move the pointer back to before the first previous black token

These skips do not contribute to whether the query matches. So if you want to skip 5 tokens (`> > > > >`) but there are only 3 to skip, the match doesn't fail. The pointer will simply be at the start or end.

If you need to jump more than one token, you can add a number to have Drew do this many jumps. So `>>5` skips the next five black tokens (similar to `{*}5`, though that _will_ fail if there aren't enough tokens to skip, or simiar to `> > > > >`).

Be careful! This mechanisms may allow you to cause infinite loops. There are awol loop protections in place but you don't want to trigger them.

- `{a}<{b}` - This would be the same as `{a & b}`, except it doesn't fail the match if the token does not exist
- `{a}>{b}` - This would be the same as `{a}[*]{b}`, except it doesn't fail the match if the token does not exist
- `{a}<<{b}` - Same as `{a & b}` because a match ends immediately after the token. `{a}{b}<<2{c}>>` would be the same as `{a&c}{b}`, but could be a quick forward check optimization (`c` wont be evaluated at all if `b` doesn't match anyways)
- `{a}>>{b}` - Same as `{a}{*}{b}`, skip a black token unconditionally, except it doesn't fail the match if the token does not exist
- `{a}>> 2{b}` - Same as `{a}{*}{*}{b}`, whitespace is ignored between the op and the number
- `{a}>>>{b}` - Silly, but same as `{a}{*}[*]{b}`, except it doesn't fail the match if the token does not exist
- `{a}>>>>{b}` - Sillier, but same as `{a}{*}{*}{b}`, except it doesn't fail the match if the token does not exist

One use case is in conjunction with repeat mode = `"after"` to make Drew jump back a bit after a match, such that the next match starts inside the previous match, while still having the partial advantage `"after"` offers.

Say you want to eliminate empty lines, you can match `([NEWLINE][WHITE & ^NEWLINE]*)=0,1[NEWLINE]<` on repeat and remove anything between and including matches. You can put Drew in "after" mode, and after each match Drew will continue at the last newline that was matched so it can be the first token to match. Without this mechanism it'd be difficult to eliminate repetitive matches.

Another case I once had is eliminating two different things with a single query, where the second thing was part of the first:

```
console.log(x);
{
stuff;
}
```

I had a query that would eliminate console stuff AND blocks that weren't part of another statement. I used something like `({console}{.}{log}{parens}{semi_pair})|({semi}{curly_pair})` for this. The first part would match but then Drew would continue after this match and the semi colon would not be seen, meaning the second part would not match this example. Adding `<<` to the query would fix it.

## --> Skip while next atom does not match

This is a special operator that means to skip the following atom (token or group) as long as the next atom cannot be parsed. The idea is that you don't have to duplicate your code like `[!foo]*[foo]` vs `-->[foo]`.

```
run('xxxxyyyyy', '[`x`]-->([`y`]+)');
// similar to
run('xxxxyyyyy', '[`x`]!([`y`]+)*([`y`]+)');
```

It is a _runtime_ error for `-->` to occur before any other part of the query matched, even if it doesn't occur at the start of a query at compile time. This is for your own protection; This is basically what Drew does already so you'd be doing it twice.

While `-->` itself is not a matching condition, it will keep trying until the EOF. So if it reaches EOF it will stop scanning but that does mean that whatever it was trying to find also was not found and the match fails anyways. So you may as well see it as a matching condition :) But Drew fails it on account of the context not being matched.

# Macros

They are like aliases of literals or other macros or constants, can be used to combine any other macro's. They are 
extrapolated recursively and can be viewed as simple string replacements while parsing a query. Pretty much any valid 
part of a query can be put in a macro. Macros are not validated individually. Only the query as a whole is 
validated. However, since macros do have to be a unit inside a matching condition or group, they must inherently be
valid for the query to be valid. (Meaning you can't use a partial invalid query because you can't really "combine" 
them without putting at least `&` or `|` between them.)

In case it matters, macros can use "constants" (see below) but constants can not refer to macros.

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
