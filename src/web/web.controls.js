var CONTROLS = {
  _query: document.querySelector('#query'),
  _input: document.querySelector('#input'),
  _callback: document.querySelector('#callback'),
  _args: document.querySelector('#args'),
  _output: document.querySelector('#output'),
  _debug: document.querySelector('#debug'),

  lang: {
    _e: document.querySelector('.lang'),
    _desc: document.querySelector('.lang .desc'),
    _default: 'js',
    txt: {
      e: document.querySelector('#txt'),
      desc: 'Considers each character a token',
      value: 'txt',
    },
    js: {
      e: document.querySelector('#js'),
      desc: 'Uses <a href="https://github.com/qfox/zeparser2">ZeParser2</a> to create a token stream for ES5 JS code',
      value: 'js',
    },
    css: {
      e: document.querySelector('#css'),
      desc: 'Uses <a href="https://github.com/qfox/gssparser">GssParser</a> to create a token stream',
      value: 'css',
    },
  },
  repeat: {
    _e: document.querySelector('.repeat'),
    _desc: document.querySelector('.repeat .desc'),
    _default: 'after',
    once: {
      e: document.querySelector('#once'),
      desc: 'Stop searching after the first match is found',
      value: 'once',
    },
    after: {
      e: document.querySelector('#after'),
      desc: 'Don\'t start searching from tokens that were part of a previous match',
      value: 'after',
    },
    every: {
      e: document.querySelector('#every'),
      desc: 'After a match continue with the next token even if it was part of the match',
      value: 'every',
    },
  },
  curryTokens: {
    _e: document.querySelector('.curry_tokens'),
    _desc: document.querySelector('.curry_tokens .desc'),
    _default: 'curry-no',
    'curry-yes': {
      e: document.querySelector('#curry-yes'),
      desc: 'Pass on the list of all tokens before all other parameters of callback, moves the rest',
      value: 'yes',
    },
    'curry-no': {
      e: document.querySelector('#curry-no'),
      desc: 'Do not pass on list of all tokens to callback',
      value: 'no',
    },
  },
  tokenMode: {
    _e: document.querySelector('.token_mode'),
    _desc: document.querySelector('.token_mode .desc'),
    _default: 'object',
    index: {
      e: document.querySelector('#index'),
      desc: 'Callback receives the (white) index numbers of token results',
      value: 'index',
    },
    object: {
      e: document.querySelector('#object'),
      desc: 'Callback receives the token objects of matches at (white) index',
      value: 'object',
    },
  },
  verbose: {
    _e: document.querySelector('.verbose'),
    _desc: document.querySelector('.verbose .desc'),
    _default: 'verbose-med',
    'verbose-off': {
      e: document.querySelector('#verbose-off'),
      desc: 'Squash logging output',
      value: 0,
    },
    'verbose-lo': {
      e: document.querySelector('#verbose-lo'),
      desc: 'Only show LOW() volume logging calls, no groups',
      value: 1,
    },
    'verbose-med': {
      e: document.querySelector('#verbose-med'),
      desc: 'Show LOW() and MED() volume logging calls, no groups',
      value: 2,
    },
    'verbose-hi': {
      e: document.querySelector('#verbose-hi'),
      desc: 'Show all logging calls and groups',
      value: 3,
    },
  },
};

function setopConfigurator(state) {
  for (var choiceClassName in CONTROLS) {
    if (choiceClassName[0] !== '_') {
      setupChoices(choiceClassName, CONTROLS[choiceClassName]);
    }
  }

  function setupChoices(choiceClassName, options) {
    var descElement = options._desc;
    for (var optionId in options) {
      if (optionId[0] !== '_') {
        setupChoice(choiceClassName, optionId, options, descElement)
      }
    }

    // update state and activate default option in ui
    options[options._default].e.onclick();
  }

  function setupChoice(choiceClassName, optionId, options, descElement) {
    options[optionId].e.onclick = function () {
      clickOption(choiceClassName, optionId, options, descElement);
    };
  }

  function clickOption(choiceClassName, optionId, options, descElement) {
    state.settings[choiceClassName] = optionId;
    // update ui
    descElement.innerHTML = options[optionId].desc;
    for (var id in options) {
      if (id[0] !== '_') {
        if (id === optionId) {
          options[id].e.classList.add('active');
        } else {
          options[id].e.classList.remove('active');
        }
      }
    }
  }
}