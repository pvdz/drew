# Drew

Declarative Rewriting Expressions

Apply a query to a language cut up in chunks, or tokens, so you can find certain structures with ease and analyze or rewrite them.

The goal of this library is to make it easy to manipulate, investigate, and rewrite tokenized input. Drew allows you to work on tokens in a similar way as <code>string.replace</code> works strings in JavaScript. Similar, but not the same.

You have input, pre-processed by a lexer of your choice, and a query and apply this query to the input. A callback is called whenever a match is found.

# Introduction

To put Drew to work you call the main exported function `drew`. It looks like this:

```
drew(tokens, query, macros, constants, callback, options);
```

After calling this function Drew will apply the query to the tokens and call your callback whenever there is a match. The options can tell Drew what to do after a match was found and processed, like continue or stop.

Simple example:

```
var input = 'hello, world!';
var query = '^^[/[a-z]/]';
function callback(token) {
  token.value = token.value.toUpperCase();
}
// always must define macro or constant for IS_BLACK and IS_NEWLINE
var textMacros = {
  IS_BLACK: '!(` ` | `\t` | IS_NEWLINE)',
  IS_NEWLINE: 'LF | CR',
  LF: '`\\x0A`',
  CR: '`\\x0D`',
};
var textConstants = {}; // none needed

// and to run:

var drew = require('./drew');
var splitter = require('../lib/splitter');
var tokens = splitter(input);
drew(tokens, query, textMacros, textConstants, callback);
console.log(tokens.map(function (t) { return t.value; }).join(''));
// -> 'Hello, world!'
```

Drew allows you to search through "tokenized" input. This means the input as a string is cut up in chunks called "tokens". What exactly constitutes a token really depends on the language. In natural language (but also in general) it would be words, spaces, and punctuations. Tokens can have a specific type, like "identifier", or "string". Drew only cares about a more global classification which assigns a label to a subset of all the tokens. These tokens are considered "black". All tokens, including the black tokens, are "white". The origin of this term comes from "whitespace" and when doing these kinds of searches you often don't care about the whitespace (or the comments). In that case you can search through just the black tokens and don't have to worry whether there are one or two spaces, some newlines, or a comment between two tokens.

The above example uses the built-in string "splitter" to cut the input up in a list of simple tokens:

```
[
  { value: 'h' },
  { value: 'e' },
  { value: 'l' },
  { value: 'l' },
  { value: 'o' },
  { value: ',' },
  { value: ' ' },
  { value: 'w' },
  { value: 'o' },
  { value: 'r' },
  { value: 'l' },
  { value: 'd' },
  { value: '!' }, 
]
```

For specific languages you'll need to use specific parsers. Drew comes with a parser for JavaScript (ES5) called ZeParser2 and a parser for CSS called (GssParser). They will deliver the tokens required for Drew to do its work.

You can define macros and constants and use them inside queries. Macros can be seen as recursive (sub) query definitions. On the other hand constants are symbols that execute actual code and whose output will be evaluated to a boolean. Both macros and constants are only used to match the value of a token. This means that you can do `[SPACE_OR_TAB]` to mean ``[` ` | `\t`]``, but `SPACE_THEN_TAB` to mean ``[` `][`\t`]`` will NOT work. Constants must always be an "expression" as well.

Drew applies the search in a recursive descent fashion, with naive backtracking. It basically means your query is processed from left to right and the parser will move forward on the input from left to right while the current part of the query matches. When a partial match fails the parser will "backtrack" (move back) and try to match the next part of the query. It will do so over and over until there is no current part of the query that can match and bail in that case. The parser applies the query starting at each token until a complete match is found. Continuation after a match depends on options as Drew can either stop completely, continue after the match, or continue with the would-be-next token regardless of a match.

The callback can be called with simply the start of a match when the query matches in full. The query can also fully control how the beginning and/or end of partial matches are passed back to the callback, either as a single object or as individual parameters. I've named these "designators" and you can read more about them below.

Drew doesn't return anything itself, instead you should manipulate the tokens directly and reconstruct the transformed source code after Drew finishes to run;

```
tokens.map(function (t) { return t.value; }).join('')
```

# Language presets

The repo contains example scripts for two languages and one for plain text. They will all parse your input in the designated language and supply the required built-in macros and constants for `IS_BLACK` and `IS_NEWLINE`. You can override them, though, through the `options` parameter, if you'd want to. 
 
[src/drew_js.js](src/drew_js.js) contains `drewJs` which you can call as `drewJs(jsCode, query, callback, options)`. 

[src/drew_css.js](src/drew_css.js) contains `drewCss` which you can call as `drewCss(cssCode, query, callback, options)`. 

[src/drew_txt.js](src/drew_txt.js) contains `drewTxt` which you can call as `drewTxt(txtCode, query, callback, options)`. 

# Queries

Drew queries look a bit like regular expressions. But since the goal of Drew is to work on tokens, tokens are explicitly delimited by either `[]` for "white tokens" or `{}` for "black tokens". Black tokens automatically skip tokens that do not match the macro `IS_BLACK`, which you must define yourself. Conceptually this macro will want to skip whitespace, newlines, and comments. Drew doesn't really care about the actual value of the macro, though, so if you want to use it to skip all tokens with the word "sheep" you are free to do so.

A query consists of "outside matching conditions" and "inside matching conditions". Outside conditions include the token wrapper, groups, seeks, invert, and line starts or ends. These conditions are more meta and apply to the type or position of the token in the token stream. Inside conditions should mostly concern themselves with the `token.value` contents, like matching the value directly or with an actual regular expression.

The atom of a query is an outer matching condition, optionally with an inner matching condition followed by an optional quantifier and optional designators (in that order). Whitespace consists of actual spaces, tabs, and newlines. 

Additionally there are three types of comments that can occur anywhere where they don't change the meaning of a query (I would say "between tokens", but that's probably too confusing in this context). All comments start with a colon and while the `::` and `:::` comment are equivalent to single and multi-line comments in JavaScript, the single colon comment is a simplified comment that is ended implicitly by the next part of the query or explicitly by a semi-colon.

## Query language CFG

The "cfg language" used below is hopefully pretty self explanatory.

### Whitespace

Whitespace, newlines, and comments can occur anywhere between other tokens in a query as long as they would not destroy other tokens. In other words, all whitespace tokens can be considered to be a single space, regardless of whether the actual representation of the token looks like a spaced break.

- whitespace: `' '` | `'\t'` | `newline` | `comment`
- comment: `comment-simple` | `comment-line` | `comment-multi`
- comment-simple: `':'` `simple-comment-chars` [`';'`]
- simple-comment-chars: `simple-comment-chars` | `simple-comment-char`
- simple-comment-char: `/[a-zA-Z0-9\s_]+/`
- comment-line: `'::'` `anything-except-newline` `newline`
- comment-multi: `':::'` `anything-except-triple-colons` `':::'`
- newline: `'\n'` // (and maybe \r \rn)

### Atoms

The atom matches a token, its quantifier, and its designators. An atom is a single token, a group of tokens, some form of seek, or conditional line start/end boundaries.

#### Atom core

- atoms: `atom-complete` | `atom-complete` `atoms`
- atom-complete: `atom` [ `quantifier` ] [ `designation` ]
- atom: `white-token` | `black-token` | `atom-group` | `line-boundary` | `seek`
- white-token: `'['` `conditions` `']'` 
- black-token: `'{'` `conditions` `'}'` 
- atom-group: `'('` `atoms` `')'` 
- line-boundary: `'^^'` | `'^'` | `'$'` | `'$$'`
- seek:`'<'` | `'<<'` | `'>'` | '`>>'` | `'~'` | `'-->'`

#### Quantifiers

- quantifier: `'*'` | `'?'` | `'+'` | `digits` [ `'..'` `digits` | `'...'` `digits` ] | `'...'` `digits`
- digits: `digit` | `digits`
- digit: `'0'` | `'1'` | `'2'` | `'3'` | `'4'` | `'5'` | `'6'` | `'7'` | `'8'` | `'9'`

#### Designators

- designation: `'='` `identifier` [ `','` `identifier` ] | `'='` `','` `identifier`
- identifier: `/[a-zA-Z0-9]+/` // note: can start with a number and be only a number... by design!

### Matching conditions

These are rules to match one token. There are a few ways to match a token and some logic options. The matching conditions can only be found inside `[]` or `{}` wrappers.
  
- conditions: `condition` | `condition` `'|'` `conditions` | `condition` `'&'` `conditions` | `'!'` `condition`
- condition: `literal` | `regex` | `macro` | `'*'` | `condition-group`
- condition-group: `'('` `conditions` `')'` 
- literal: ``'`'`` `literal-unit` ``'`'`` [``'`'`` `'i'` ``'`'``] // `foo` for case sensitive or or ``foo`i`` for case insensitive
- regex: `js-regex-literal`
- literal-unit: `any character except backslash` | `escape`
- escape: `'\'` `any character`
- macro: `any combination of letters`

# Concepts

This section describes some concepts and terminology I've used inside Drew.

## Atoms

Atoms are basically zero or more tokens that are matched or skipped with a certain condition. 

## Quantifiers

An atom can be matched any number of times, with or without a lower and/or upper bound. We call these bounds the quantifier and it optional. If you omit it, it is implicitly assumed to be "exactly one time".
 
The quantifier starts with a number or dots. As such they are not ambiguous with anything else that is valid in the outer matching condition. I would suggest to put spaces between the atom core and its quantifier, but that's not a requirement.

You can specify an atom must match exactly `n` times, minimally `n` times, maximally `m` times, or anywhere between `n` and `m` times, inclusive. There are three aliases, borrowed from regular expressions, which you can use as shortcuts: `*` means `0...`, `+` means `1...` and `?` means `0..1`.

## Designators

By default Drew will return you the start and end token (inclusive) of a matched query as the first and second parameter. You can override these in the query using something I'm calling "designators". They follow the quantifier if one is supplied and start with an `=` sign. If you use a `=` you must supply at least a start or end designator, but may also give both. 

You can use names for designators or digits only. If and only if all designators in a query that were part of a match were numbers, the values are passed on as individual parameters on the callback. If, however, there's at least one designator that has a letter in its name the callback will be called with one parameter; an object with a property for each designator and its value.

The examples, assuming `[x]` matches something:

```
[x]                 :: callback(1, 20)
[x] = start         :: callback({start: 1})
[x] = start, stop   :: callback({start: 1, stop: 20})
[x] = , stop        :: callback({stop: 20})
[x] = 0, 1          :: callback(1, 20)
[x] = 0, stop       :: callback({0: 1, stop: 20})
```

Note that the last token is _inclusive_. So if the query matches exactly one token, the start and stop value will be the same.

## Outer matching conditions

You can tell Drew to start matching at the next "white" or "black" token. If you want to match a black token, for example the `if` keyword in JavaScript, you would use ``{`if`}``. Drew will then skip the current token as long as it is not a black token, as determined by the `IS_BLACK` macro.

Besides black and white tokens, you can group any condition together. If part of the group does not match, the whole group is skipped. More importantly you can use groups to get specific repetitions and ranges with quantifiers and designators.

### Seeks

There are a couple of seeking conditions you can use as outer conditions:

- `<` will skip exactly one white token to the left of the token stream. The conditional only fails if the pointer is currently at the start of the stream (but you could use `<?` to ignore that).
- `<<` will skip any white tokens if the current is not black, and then exactly one black token. Only fails if it cannot skip a black token this way.
- `>` will skip exactly one white token to the right. Similar to `[*]`. Fails if it cannot skip a token (EOF).
- `>>` will skip exactly one black token to the right. Similar to `{*}`. Fails if it cannot skip a black token this way (EOF).
- `~` will skip the current token while it doesn't match the next atom. So it prefixes one atom in the query. It's a more efficient alias for `[*]*`.
- `-->` will seek to the end of the current line, always skipping at least one token. Fails if it cannot skip a token. To seek to the start of the next line use `-->>` :)

Note that as an optimization seeks will automatically fail if they would start the query, even if they're not actually at the start of a query. This is mostly important for callbacks because it means values for designators are not affected by seeks at start of a query.

```
~[`foo`]              :: matches "foo" (start=0) and "hello, foo" (start=3)
(-->[`foo`])          :: matches "foo" (start=0) and "hello, foo" (start=3)
([`bar`] | ~[`foo`])  :: matches "foo" (start=0) and "hello, foo" (start=3)
([`bar`]? ~[`foo`])   :: matches "foo" (start=0) and "hello, foo" (start=3)
([`bar`]? ~[`foo`])   :: matches "x foo" (start=2) and "bar to foo" (start=0)
```

So regardless of the physical appearance of a seek, if it would be the first thing to match in a query it will automatically "fail". This way they serve as noops.

Another thing to note is that `~` cannot be quantified, as it makes no sense to do so.

### Line conditionals

This may be the only condition that never consumes any token but only conveys a certain state of the current token; whether or not it is the first or last token of the input, or whether it is at the start or end of a line. Whether a token is a newline is governed by the `IS_NEWLINE` macro, which you have to define per language. The actual symbols for this token (obviously) are borrowed from regular expressions.

- `^` Returns true if the current token is the first of the entire input, or if it is preceded by a newline token (which would be equivalent to `<[IS_NEWLINE]`).
- `^^` Returns true if and only if the current token is the first of the entire input.
- `$` Returns true if the current token is the last of the entire input, or if it is succeded by a newline token (which would be equivalent to `>[IS_NEWLINE]< <`).
- `$$` Returns true if and only if the current token is the last of the entire input.

You can't quantify these conditionals, it wouldn't make sense. Designators also won't work on them.

### Groups

You can simply group pretty much any outer matching conditions together by wrapping them in parenthesis (`()`). This group itself can be quantified and can have designators (`([x][y]) 1..3 =a,b`). The group can be the argument to a tilde seek (`~([x][y])`) and can be inverted (`!([x][y])`).

### Or

While the and (`&`) is implied and therefor not allowed in an outer matching condition, the or can be used to match either the left or right atom, like so: `[x]|[y]`. 

Either side of the pipe can have its own quantifiers and designators. The operator is always processed from left to right so if precedence is an issue use groups to disambiguate: `[x]([y]|[z])`. 

If both sides of a pipe have designators only the first atom (left then right) that matches will have its designator actually used. If you want a designator for "regardless of which side matched", group it and add a designator to the group: `([x]=left | [y]=right) = either`.

### Macros and constants

Currently, macros and constants are not allowed in outer matching conditions. This may change in the future.

## Inner matching conditions

The part inside a `[]` or `{}` matches on token values. This would be the `token.value` property that each token should at least have. There are a few different types of inner matching conditions.

### Literal

The simplest of all is the literal. Backtick-quoted characters are matched as is. You can escape them if you desire so (especially useful for matching a backtick or backslash) and you can use the hex (`\x12`) or unicode (`\u1234`) notation as well: ``{`if`}``, ``[`\x67`]``, ``[`\u0020`]``

This literal notation has no support for partial matches, though you can add an `i` flag after it for case insensitive matches: ``{`iF`i}``. This merely does a `.toLowerString()` before the match. Support for other flags may follow in the future.

### Regular expressions

A more powerful though significantly slower way to match token values is by using regular expression literals. Drew will compile them in JavaScript as is: `{/while|IF/i}`.

The regular expression is compiled as a literal, as is. So that example translates to `/while|IF/i.test(token.value)`. 

### Star

As you might expect the star/asterix (`*`) matches the value of any token. It's similar to a dot in normal regular expressions: `[*]`. 

Note that in many cases there are more efficient seeks available than using the star:

- `[*]` is `>`
- `{*}` is `>>`
- `[*]*` is `~`
- `[*]*[IS_NEWLINE]<` is `-->`
- `[*]*[IS_NEWLINE]` is `-->>`

### Logic

You can use and `&` and or `|` between any matching condition: `[x | y]` `[x & y]` `[x & (y |z )]`

Logic operators on the same level are lazily resolved left to right. You can disambiguate with groups.

Using double characters (`&&` `||`) is allowed as well, it makes no difference but maybe you can't stand to look at binary ops.

## Whitespace

In Drew queries, any space, tab, and newline (`\n`) are actual whitespace. Additionally comments are also considered whitespace.
 
Whitespace can occur pretty much anywhere in a query but is completely optional. If it does occur it can not occur _inside_ a token and so anything to the left and right of whitespace will constitute their own token, if if they could be combined into one if the whitespace wasn't there.
  
### Simple comments

When a comment starts with a single colon it is considered to be a simple comment. Simple comments are used as short comments consisting of letters and spaces. They can either be explicitly terminated by semi-colons or will be implicitly terminated when encountering a character that is not a letter, an underscore, nor a space: 

```
[x] = 0: name, 1 : stops
```

### Single line comments

A comment starting with a double colon (`::`) will end at the end of line or end of file. Pretty much the same as single line comments in JS.

### Multi line comments

A comment starting with a triple colon (`:::`) will end at the first next triple colon. Similar to multi line comments in JS/CSS.
