var logging = Drew.logging;
var LOG = logging.LOG;

var indent = '';
function go() {
  logging.setExternalLogging(function(level){
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
    CONTROLS._debug.appendChild(e);
    CONTROLS._debug.appendChild(document.createElement('hr'));
  });

  CONTROLS._debug.innerHTML = '';
  CONTROLS._output.value = '';

  var queryString = CONTROLS._query.value;
  var inputString = CONTROLS._input.value;
  var callbackBody = CONTROLS._callback.value;
  var callbackArgs = CONTROLS._args.value;

  var lang = CONTROLS.lang[document.querySelector('.lang .state-button.active').id].value;
  var repeatMode = CONTROLS.repeat[document.querySelector('.repeat .state-button.active').id].value;
  var copyInputMode = CONTROLS.copy[document.querySelector('.copy .state-button.active').id].value;
  var verboseMode = CONTROLS.verbose[document.querySelector('.verbose .state-button.active').id].value;

  logging.setMode(verboseMode);
  logging.setMax(5000);

  var callback = Function.apply(Function, callbackArgs.split(',').concat(callbackBody));
  var macros = eval(document.querySelector('#macros').value);
  var constants = eval(document.querySelector('#constants').value);

  LOG('Target input:', [inputString]);
  switch (lang) {
    case 'txt':
      LOG('Tokenizing as text with a simple split');
      CONTROLS._debug.appendChild(document.createTextNode(
        'Tokenizing input as plain text (one character per token)\n\n'
      ));
      var tokens = split(inputString);
      break;

    case 'js':
      LOG('Tokenizing as JS with ZeParser2');
      document.querySelector('#debug').value += 'Tokenized input as JavaScript (as per ZeParser2)\n\n';
      var tokens = Par.parse(inputString, {saveTokens: true}).whites;
      break;

    case 'css':
      LOG('Tokenizing as CSS with GssParser');
      CssParser.parse(inputString);
      var tokens= CssParser.getAllTokens();
      break;

    default:
      LOG('unknown language so dunno how to tokenize it');
      throw 'unknown lang ['+lang+']';
  }
  LOG('tokens:', tokens);

  var funcCode = Drew.compileDrew(queryString);
  document.querySelector('#compiled').value = funcCode;
  LOG(funcCode);

  Drew.drew(tokens, queryString, macros, constants, callback, {repeatMode: repeatMode, copyInputMode: copyInputMode});

  CONTROLS._output.value = tokens.map(function (t) {
    return t.value;
  }).join('');
}

function loadPreset() {
  var select = document.querySelector('#preset-list');
  var option = select.children[select.selectedIndex];

  var presets = JSON.parse(localStorage.getItem('drew-presets') || 'null') || PRESETS;
  var preset = presets[option.value];
  if (!preset) return console.warn('Dont know selection, unable to load it.', option.value, option, presets);

  document.querySelector('#preset-name').value = preset.name;
  document.querySelector('#query').value = preset.query;
  document.querySelector('#args').value = preset.args;
  document.querySelector('#callback').value = preset.callback;
  document.querySelector('#input').value = preset.input;
  document.querySelector('#macros').value = preset.macros;
  document.querySelector('#constants').value = preset.constants;

  CONTROLS.lang[preset.lang].e.onclick();
  CONTROLS.repeat[preset.repeatMode].e.onclick();
  CONTROLS.copy[preset.copyInputMode === 'copy' ? 'yescopy' : preset.copyInputMode].e.onclick();
  CONTROLS.verbose[preset.verboseMode].e.onclick();
}

function savePreset() {
  var name = document.querySelector('#preset-name').value;
  var query = document.querySelector('#query').value;
  var args = document.querySelector('#args').value;
  var callback = document.querySelector('#callback').value;
  var input = document.querySelector('#input').value;
  var macros = document.querySelector('#macros').value;
  var constants = document.querySelector('#constants').value;

  var lang = document.querySelector('.lang .state-button.active').id;
  var repeatMode = document.querySelector('.repeat .state-button.active').id;
  var copyInputMode = document.querySelector('.copy .state-button.active').id;
  var verboseMode = document.querySelector('.verbose .state-button.active').id;

  var presets = JSON.parse(localStorage.getItem('drew-presets') || 'null') || PRESETS;
  presets[name] = {
    name: name,
    lang: lang,
    repeatMode: repeatMode,
    copyInputMode: copyInputMode,
    verboseMode: verboseMode,
    query: query,
    args: args,
    callback: callback,
    input: input,
    macros: macros,
    constants: constants,
  };
  localStorage.setItem('drew-presets', JSON.stringify(presets));
  console.log(presets);
}

function deletePreset() {
  var select = document.querySelector('#preset-list');
  var option = select.children[select.selectedIndex];

  var target = option.innerHTML;
  switch (option.innerHTML) {
    case 'JavaScript':
    case 'CSS':
    case 'PlainText':
      return console.log('nahhhh');
  }

  var presets = JSON.parse(localStorage.getItem('drew-presets') || 'null') || PRESETS;
  delete presets[target];
  localStorage.setItem('drew-presets', JSON.stringify(presets));

  setupPresets();
}

function clearAll() {
  document.querySelector('#preset-name').value = '';
  document.querySelector('#query').value = '';
  document.querySelector('#args').value = '';
  document.querySelector('#callback').value = '';
  document.querySelector('#input').value = '';
  document.querySelector('#macros').value = '';
  document.querySelector('#constants').value = '';
  document.querySelector('#callback').value = '';
  document.querySelector('#output').value = '';
  document.querySelector('#compiled').value = '';
}

function setupPresets() {
  var select = document.querySelector('#preset-list');
  while (select.children.length) {
    select.removeChild(select.children[0]);
  }

  var presets = JSON.parse(localStorage.getItem('drew-presets') || 'null') || PRESETS;
  for (var key in presets) {
    var option = document.createElement('option');
    option.value = key;
    option.innerHTML = presets[key].name;
    select.appendChild(option);
  }
}

function clearLocalStorage() {
  localStorage.removeItem('drew-presets');
  setupPresets();
}

var maconstPresets = {
  js: {
    macros: '({\n  // default macros for js\n  // Cached matching conditions. Some are\n  // lang. dep. and used by Drew internally.\n  // "Shadows" constants. Use Drew syntax.\n\n  IS_BLACK: \'!WHITE\', // see constants\n  LF: \'`\\\\x0A`\', // \\n\n  CR: \'`\\\\x0D`\', // \\r\n  CRLF: \'`\\\\x0A\\\\x0D`\',\n  PS: \'`\\\\u2028`\',\n  LS: \'`\\\\u2029`\',\n  IS_NEWLINE: \'LF | CR | CRLF | PS | LS\', // you can recurse\n})\n',
    constants: '({\n  // default constants for js\n  WHITE: \'current().type === Par.WHITE\',\n  IS_NEWLINE: \'current().value === \\\'\\\\n\\\' || current().value === \\\'\\\\r\\\' || current().value === \\\'\\\\r\\\\n\\\'\',\n})\n',
  },
  txt: {
    macros: '({\n  // default macros for txt\n  // Cached matching conditions. Some are\n  // lang. dep. and used by Drew internally.\n  // Macros "shadow" constants. Uses Drew syntax.\n\n  IS_BLACK: \'!IS_WHITE\', // see constants\n  IS_WHITE: \'` ` | `\\t` | IS_NEWLINE\',\n  LF: \'`\\\\x0A`\', // \\n\n  CR: \'`\\\\x0D`\', // \\r\n  IS_NEWLINE: \'LF | CR\', // you can recurse\n})\n',
    constants: '({\n  // default constants for txt\n  // (but we can define all the necessities with macros)\n})\n',
  },
  css: {
    macros: '({\n  // default macros for css\n  IS_BLACK: \'!WHITE\', // see constants\n})\n',
    constants: '({\n  // default constants for css\n  // the css parser exposes its type as a property with\n  // numeric constants exposed in `window.Constants`, so:\n  WHITE: \'current().type === Constants.TOKEN_WHITESPACE\',\n  IS_NEWLINE: \'current().type === Constants.TOKEN_NEWLINE\',\n})\n',
  },
};

function resetMacros() {
  var id = document.querySelector('.lang .active').id;
  document.querySelector('#macros').value = maconstPresets[id].macros;
}

function resetConstants() {
  var id = document.querySelector('.lang .active').id;
  document.querySelector('#constants').value = maconstPresets[id].constants;
}

(function(){
  var state = {
    settings: {},
  };

  setopConfigurator(state);

  document.querySelector('#go').onclick = go;
  document.querySelector('#load').onclick = loadPreset;
  document.querySelector('#loadgo').onclick = function(){ loadPreset(); go(); };
  document.querySelector('#save').onclick = savePreset;
  document.querySelector('#delete').onclick = deletePreset;
  document.querySelector('#clear').onclick = clearAll;
  document.querySelector('#delstor').onclick = clearLocalStorage;
  document.querySelector('#reset-macros').onclick = resetMacros;
  document.querySelector('#reset-constants').onclick = resetConstants;


  setupPresets();
})();
