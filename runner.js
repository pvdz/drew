function convert(input, obj) {
  var rules = obj.rules;
  var runs = obj.runs;
  var compiled = {};

  for (var key in rules) {
    console.group('Parsing rule ['+key+']');
    compiled[key] = parse(rules[key], constants, macros);
    console.group('Generated funcCode');
    console.log(compiled[key].replace(/|| true /g, ''));
    console.groupEnd();
    console.groupEnd();
  }

  var orgInput = input;
  var ruleCounter = 0;

  while (runs.length) {
    var details = runs.shift();
    console.group('Rule ' + (++ruleCounter));
    if (details.disabled) {
      console.log('skipping rule', ruleCounter);
    } else {
      var handler = details.handler.bind(undefined, tokens);

      details.handler.sub = function(ruleName, first, last, handler){
        run(tokens, compiled[details.rule], handler, details.mode, first, last);
      };

      do {
        var lastInput = input;
        try {
          var tokens = Par.parse(input, {saveTokens: true}).whites;
        } catch (e) {
          console.error('Input was invalid:');
          console.log([input]);
          throw 'invalid input';
        }

        console.group('run');
        console.log('Rule:', details.rule);
        run(tokens, compiled[details.rule], handler, details.mode);
        console.groupEnd();

        input = tokens.map(function(t){ return t.value; }).join('');
      } while (details.repeat && lastInput !== input);
    }
    console.groupEnd();
  }

  return input;
}

console.group('generating input...')
var inp = parse('[SPACE]|[TAB]', constants, macros);
//var inp = 'foo();\nif (bar)\n  baz();\ndoo();';
console.log(inp);
console.groupEnd();

var out = convert(inp, {
  rules: {
    asi: '{ASI}',
    curlyWrapper: '{IF}{PAREN_PAIR}[WHITE & !NEWLINE]*[NEWLINE][WHITE]*{!CURLY_OPEN & STATEMENT}=1,2',
    curlyFormatter: '{IF} [WHITE]*=1,2 {PAREN_PAIR}=,3 [WHITE]*=4,5 {CURLY_OPEN}',
    functionBody: '^' +
      '[WHITE]*=1,2:indentation' +
      '#0' +
      '[FUNCTION]' +
      '[WHITE]+ =1,2:white1' +
      '{IDENTIFIER}' +
      '[WHITE]* =3,4:white2' +
      '{PAREN_PAIR} =,5:paren_close' +
      '[WHITE]* =6,7:white3' +
      '{CURLY_OPEN} =8' +
      '[WHITE & !COMMENT]* =9,10:white4' +
      '#1' +
      '(' +
      '  (' +
      '    [COMMENT] =1:core' +
      '    [WHITE & !COMMENT]* =2,3:white3' +
      '  )*@2' +
      '  (' +
      '    {STATEMENT} =1,2' +
      '    #3' +
      '    [WHITE & !COMMENT]* =1,2:white3' +
      '    #4' +
        ')' +
      ')*' +
      '',
    ifFormatter:
      '{IF}=0:keyword' +
      '[WHITE]*=1,2:white1' +
      '{PAREN_PAIR}=,3:paren_close' +
      '[WHITE & !COMMENT]*=4,5:white2' +
      '(' +
      '  [COMMENT]=6,7:core' +
      '  [WHITE & !COMMENT]*=8,9:white3' +
      ')*@' +
      '  {STATEMENT}=6,7:core' +
      '',
  },
  runs: [
    {
      rule: 'asi',
      mode: 'after', // what to do after match? every, after, once
      repeat: false, // repeat until input===output?
      handler: function(tokens, asi){
        asi.value = ';';
      },
    }, {
      rule: 'curlyWrapper',
      mode: 'after', // what to do after match? every, after, once
      repeat: false, // repeat until input===output?
      handler: function(tokens, _, start, stop){
        start.value = '{' + start.value;
        stop.value += '}';
      },
    }, {
      rule: 'curlyFormatter',
      mode: 'after', // what to do after match? every, after, once
      repeat: false, // repeat until input===output?
      handler: function(tokens, start, wa1, wb1, paren, wa2, wb2){
        if (wa1) tokens.slice(wa1.white, wb1.white + 1).forEach(function(t){ t.value = ''; });
        if (wa2) tokens.slice(wa2.white, wb2.white + 1).forEach(function(t){ t.value = ''; });
        start.value += ' ';
        paren.value += ' ';
      },
    }, {
      rule: 'functionBody',
      mode: 'after', // what to do after match? every, after, once
      repeat: false, // repeat until input===output?
      this: {}, // `this` in each callback. like shared state.
      handler: [
        function detectIndentation(_, indentStart, indentStop){
          var indent = '';
          if (indentStart) indent = this.tokens.slice(indentStart, indentStop + 1).map(function(t){ return t.value; }).join('');
          indent += '  ';
          indent = indent.replace(/ /g, '\t');

          this.indent = indent;
        },
        function formatFunctionHead(tokens, _, whiteStart1, whiteStop1, whiteStart2, whiteStop2, closingParen, whiteStart3, whiteStop3, curly, whiteStart4, whiteStop4){
          tokens.slice(whiteStart1.white, whiteStop1.white + 1).forEach(function(t){ t.value = ''; });
          whiteStart1.value = '\t';
          if (whiteStart2) tokens.slice(whiteStart2.white, whiteStop2.white + 1).forEach(function(t){ t.value = ''; });
          if (whiteStart3) tokens.slice(whiteStart3.white, whiteStop3.white + 1).forEach(function(t){ t.value = ''; });
          closingParen.value = ') ';
          if (whiteStart4) tokens.slice(whiteStart4.white, whiteStop4.white + 1).forEach(function(t){ t.value = ''; });
          curly.value = '{\n';
        },
        function indentComments(tokens, _, coreStart, coreStop, whiteStart5, whiteStop5){
          coreStart.value = this.indent + coreStart.value;
          coreStop.value += '\n';
          if (whiteStart5) tokens.slice(whiteStart5.white, whiteStop5.white + 1).forEach(function(t){ t.value = ''; });
        },
        function processSubStatement(_, statementStart, statementStop) {
          this.sub(
            'ifFormatter',
            statementStart.white,
            statementStop.white,
            function again(keyword, white1start, white1stop, paren, white2start, white2stop, coreStart, coreStop, white3start, white3stop){
              // drop all whitespace
              if (white1start) tokens.slice(white1start.white, white1stop.white + 1).forEach(function(t){ t.value = ''; });
              if (white2start) tokens.slice(white2start.white, white2stop.white + 1).forEach(function(t){ t.value = ''; });
              if (white3start) tokens.slice(white3start.white, white3stop.white + 1).forEach(function(t){ t.value = ''; });
              // add specific whitespace
              keyword.value += ' ';
              if (coreStart.type === WHITE) {
                paren.value += ' {\n';
              }
              paren.value += ' ';



              var indent = '';
              if (indentStart) indent = tokens.slice(indentStart, indentStop + 1).map(function(t){ return t.value; }).join('');
              indent += '  ';
              indent = indent.replace(/ /g, '\t');

              tokens.slice(white1start.white, white1stop.white + 1).forEach(function(t){ t.value = ''; });
              paren.value += '\t';
              if (whiteStart3) tokens.slice(whiteStart3.white, whiteStop3.white + 1).forEach(function(t){ t.value = ''; });
              closingParen.value = ') ';
              if (whiteStart4) tokens.slice(whiteStart4.white, whiteStop4.white + 1).forEach(function(t){ t.value = ''; });
              if (whiteStart5) tokens.slice(whiteStart5.white, whiteStop5.white + 1).forEach(function(t){ t.value = ''; });
              paren.value = '{\n';
              coreStart.value = indent + coreStart.value;
              coreStop.value += '\n';

            }
          );
        },
        function formatStatement() {

        }
      ]
    }
  ]
});

console.warn(' in:\n%s', inp.replace(/\t/g, '\u21E5'));
console.warn('out:\n%s', out.replace(/\t/g, '\u21E5'));






// #0.before = UNDERSCORE + LF + #1..#2;
// #0>1
// #0>>2

