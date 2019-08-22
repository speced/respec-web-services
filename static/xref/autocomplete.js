/*
 * Based on https://github.com/kraaden/autocomplete (v5.0.1)
 * Copyright (c) 2016 Denys Krasnoshchok
 * MIT License
 *
 * Converted to ES6 using https://lebab.unibtc.me/editor.
 * Converted to ES module.
 * Converted to use some modern Web APIs
 */
const doc = document;

const userAgent = navigator.userAgent;
const mobileFirefox =
  userAgent.includes('Firefox') && userAgent.includes('Mobile');
// 'keyup' event will not be fired on Mobile Firefox, so we have to use
// 'input' event instead
const keyUpEventName = mobileFirefox ? 'input' : 'keyup';

const defaults = {
  render(text, currentValue) {
    const option = doc.createElement('li');
    option.textContent = text || '';
    option.setAttribute('role', 'option');
    return option;
  }
};

export function autocomplete(settings) {
  const {
    input,
    debounceWaitMs = 0,
    minLen = 1,
    showOnFocus = false
  } = settings;
  const container = doc.createElement('ul');
  container.setAttribute('role', 'listbox');
  container.className = 'autocomplete';

  const containerStyle = container.style;
  containerStyle.position = 'fixed';

  let items = [];
  let inputValue = '';
  let selected;
  let keypressCounter = 0;
  let debounceTimer;

  /**
   * Detach the container from DOM
   */
  function detach() {
    container.remove();
  }

  /**
   * Clear debouncing timer if assigned
   */
  function clearDebounceTimer() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
  }

  /**
   * Attach the container to DOM
   */
  function attach() {
    if (!container.parentNode) {
      doc.body.appendChild(container);
    }
  }

  /**
   * Check if container for autocomplete is displayed
   */
  function containerDisplayed() {
    return !!container.parentNode;
  }

  /**
   * Clear autocomplete state and hide container
   */
  function clear() {
    keypressCounter++;
    items = [];
    inputValue = '';
    selected = undefined;
    detach();
  }

  /**
   * Update autocomplete position
   */
  function updatePosition() {
    if (!containerDisplayed()) {
      return;
    }
    const inputRect = input.getBoundingClientRect();
    const top = inputRect.top + input.offsetHeight;
    const maxHeight = Math.max(0, window.innerHeight - top);
    Object.assign(containerStyle, {
      height: 'auto',
      width: `${input.offsetWidth}px`,
      top: `${top}px`,
      bottom: '',
      left: `${inputRect.left}px`,
      maxHeight: `${maxHeight}px`
    });
  }

  /**
   * Redraw the autocomplete div element with suggestions
   */
  function update() {
    // delete all children from autocomplete DOM container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    // function for rendering autocomplete suggestions
    const render = settings.render || defaults.render;
    const fragment = doc.createDocumentFragment();
    for (const item of items) {
      const option = render(item, inputValue);
      // TODO: use event delegation maybe?
      option.addEventListener('click', ev => {
        settings.onSelect(item, input);
        clear();
        ev.preventDefault();
        ev.stopPropagation();
      });
      if (item === selected) {
        option.classList.add('selected');
      }
      fragment.appendChild(option);
    }

    container.appendChild(fragment);
    if (items.length < 1) {
      if (settings.emptyMsg) {
        const empty = doc.createElement('div');
        empty.className = 'empty';
        empty.textContent = settings.emptyMsg;
        container.appendChild(empty);
      } else {
        clear();
        return;
      }
    }
    attach();
    updatePosition();
    updateScroll();
  }

  function updateIfDisplayed() {
    if (containerDisplayed()) {
      update();
    }
  }

  function resizeEventHandler() {
    updateIfDisplayed();
  }

  function scrollEventHandler(e) {
    if (e.target !== container) {
      updateIfDisplayed();
    } else {
      e.preventDefault();
    }
  }

  function keyupEventHandler(ev) {
    const keyCode = ev.which || ev.keyCode || 0;
    const ignore = [
      38 /* Up */,
      13 /* Enter */,
      27 /* Esc */,
      39 /* Right */,
      37 /* Left */,
      16 /* Shift */,
      17 /* Ctrl */,
      18 /* Alt */,
      20 /* CapsLock */,
      91 /* WindowsKey */,
      9 /* Tab */
    ];
    for (let _i = 0, ignore_1 = ignore; _i < ignore_1.length; _i++) {
      const key = ignore_1[_i];
      if (keyCode === key) {
        return;
      }
    }
    // the down key is used to open autocomplete
    if (keyCode === 40 /* Down */ && containerDisplayed()) {
      return;
    }
    startFetch(0 /* Keyboard */);
  }

  /**
   * Automatically move scroll bar if selected item is not visible
   */
  function updateScroll() {
    const element = container.querySelector('selected');
    if (!element) return;
    if (element.offsetTop < container.scrollTop) {
      container.scrollTop = element.offsetTop;
    } else {
      const selectBottom = element.offsetTop + element.offsetHeight;
      const containerBottom = container.scrollTop + container.offsetHeight;
      if (selectBottom > containerBottom) {
        container.scrollTop += selectBottom - containerBottom;
      }
    }
  }

  /**
   * Select the previous item in suggestions
   */
  function selectPrev() {
    if (items.length < 1) {
      selected = undefined;
      return;
    }
    if (selected === items[0]) {
      selected = items[items.length - 1];
      return;
    }
    for (let i = items.length - 1; i > 0; i--) {
      if (selected === items[i] || i === 1) {
        selected = items[i - 1];
        break;
      }
    }
  }

  /**
   * Select the next item in suggestions
   */
  function selectNext() {
    if (items.length < 1) {
      selected = undefined;
    }
    if (!selected || selected === items[items.length - 1]) {
      selected = items[0];
      return;
    }
    for (let i = 0; i < items.length - 1; i++) {
      if (selected === items[i]) {
        selected = items[i + 1];
        break;
      }
    }
  }

  function keydownEventHandler(ev) {
    const keyCode = ev.which || ev.keyCode || 0;
    if (
      keyCode === 38 /* Up */ ||
      keyCode === 40 /* Down */ ||
      keyCode === 27 /* Esc */
    ) {
      const containerIsDisplayed = containerDisplayed();
      if (keyCode === 27 /* Esc */) {
        clear();
      } else {
        if (!containerDisplayed || items.length < 1) {
          return;
        }
        keyCode === 38 /* Up */ ? selectPrev() : selectNext();
        update();
      }
      ev.preventDefault();
      if (containerIsDisplayed) {
        ev.stopPropagation();
      }
      return;
    }
    if (keyCode === 13 /* Enter */ && selected) {
      settings.onSelect(selected, input);
      clear();
    }
  }

  function focusEventHandler() {
    if (showOnFocus) {
      startFetch(1 /* Focus */);
    }
  }

  function startFetch(trigger) {
    // if multiple keys were pressed, before we get update from server,
    // this may cause redrawing our autocomplete multiple times after the last key press.
    // to avoid this, the number of times keyboard was pressed will be
    // saved and checked before redraw our autocomplete box.
    const savedKeypressCounter = ++keypressCounter;
    const val = input.value;
    const onFetch = elements => {
      if (keypressCounter === savedKeypressCounter && elements) {
        items = elements;
        inputValue = val;
        selected = items.length > 0 ? items[0] : undefined;
        update();
      }
    };
    if (val.length >= minLen || trigger === 1 /* Focus */) {
      clearDebounceTimer();
      debounceTimer = window.setTimeout(
        () => settings.fetch(val, onFetch, 0 /* Keyboard */),
        trigger === 0 /* Keyboard */ ? debounceWaitMs : 0
      );
    } else {
      clear();
    }
  }

  function blurEventHandler() {
    // we need to delay clear, because when we click on an item, blur will be called before click and remove items from DOM
    setTimeout(() => doc.activeElement !== input && clear(), 200);
  }

  // setup event handlers
  /**
   * Fixes #26: on long clicks focus will be lost and onSelect method will not be called
   */
  container.addEventListener('mousedown', ev => {
    ev.stopPropagation();
    ev.preventDefault();
  });
  input.addEventListener('keydown', keydownEventHandler);
  input.addEventListener(keyUpEventName, keyupEventHandler);
  input.addEventListener('blur', blurEventHandler);
  input.addEventListener('focus', focusEventHandler);
  window.addEventListener('resize', resizeEventHandler);
  doc.addEventListener('scroll', scrollEventHandler, true);
}
