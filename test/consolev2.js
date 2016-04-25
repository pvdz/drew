// CONFIG

var indent = '';
function go() {
  window.LOG_FUNC = function(level){
    var args = [].slice.call(arguments, 1);
    switch (level) {
      case 'log':
        var e = document.createTextNode(indent + args.join(', ') + '\n');
        break;
      case 'warn':
        var e = document.createTextNode(indent + '!! ' + args.join(', ') + '\n');
        break;
      case 'error':
        var e = document.createTextNode(indent + ':( ' + args.join(', ') + '\n');
        break;
      case 'gropen':
        var e = document.createTextNode(indent + '> '+args.join(', ') + '\n');
        indent += '  ';
        break;
      case 'grclose':
        indent = indent.slice(0, -2);
        var e = document.createTextNode(indent + '< '+args.join(', ') + '\n');
        break;
      default:
        throw 'unknown logging level';
    }
    CONFIG._debug.appendChild(e);
    CONFIG._debug.appendChild(document.createElement('hr'));
  };

  CONFIG._debug.innerHTML = '';
  CONFIG._output.value = '';

  var queryString = CONFIG._query.value;
  var inputString = CONFIG._input.value;
  var callbackBody = CONFIG._callback.value;
  var callbackArgs = CONFIG._args.value;

  var lang = CONFIG.lang[document.querySelector('.lang .state-button.active').id].value;
  var repeatMode = CONFIG.repeat[document.querySelector('.repeat .state-button.active').id].value;
  var copyInputMode = CONFIG.copy[document.querySelector('.copy .state-button.active').id].value;
  var verboseMode = CONFIG.verbose[document.querySelector('.verbose .state-button.active').id].value;

  VERBOSE = !!verboseMode;
  VERBOSEMAX = verboseMode;

  var callback = Function.apply(Function, callbackArgs.split(',').concat(callbackBody));

  LOG('Target input:', [inputString]);

  var funcCode = parse(queryString, constants, macros);

  switch (lang) {
    case 'text':
      CONFIG._debug.appendChild(document.createTextNode(
        'Tokenized input as plain text (one character per token)\n\n'
      ));
      window.TOKENS = split(inputString);
      break;

    case 'js':
      document.querySelector('#debug').value += 'Tokenized input as JavaScript (as per ZeParser2)\n\n';
      window.TOKENS = Par.parse(inputString, {saveTokens: true}).whites;
      break;

    case 'css':
      throw 'tbd';

    default:
      throw 'unknown lang ['+lang+']';
  }

  LOG(funcCode);
  LOG('tokens:', TOKENS);

  run(TOKENS, funcCode, callback, repeatMode, copyInputMode);

  CONFIG._output.value = TOKENS.map(function (t) {
    return t.value;
  }).join('');
}

(function(){
  var state = {
    settings: {},
  };

  setopConfigurator(state);

  document.querySelector('#go').onclick = go;
})();
