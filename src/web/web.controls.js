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
      desc: 'Uses <a href="https://github.com/qfox/zeparser2">ZeParser2</a> to create a token stream',
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
  copy: {
    _e: document.querySelector('.copy'),
    _desc: document.querySelector('.copy .desc'),
    _default: 'yescopy',
    yescopy: {
      e: document.querySelector('#yescopy'),
      desc: 'Read original input from a backup property so you can safely update <code>.value</code>',
      value: 'copy',
    },
    nocopy: {
      e: document.querySelector('#nocopy'),
      desc: 'Use <code>.value</code> as is, even if you updated it previously',
      value: 'nocopy',
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