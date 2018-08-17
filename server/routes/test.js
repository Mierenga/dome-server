'use strict';

var cycleTimer = new function() {

  this._items = undefined;
  this._timer = undefined;
  this._index = 0;

  this.start = (colors) => {
    this._items = colors;
    this._timer = setInterval(() => {

      console.log(this._items[this._getIndex()])
      
    }, 1000);
  };

  this.stop = () => {
    clearInterval(this._timer);
    this._timer = undefined;
  };

  this._getIndex = () => {
    this._index = (this._index+1)%this._items.length
    return this._index;
  };

  this.start(['hi', 'emily']);
};

