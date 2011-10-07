/**
 * ierange.js with IFrame Demo
 *
 * Copyright (c) 2011 hashnote.net, Alisue allright reserved
 * License under the MIT License
 *
 * Author: Alisue (lambdalisue@hashnote.net)
 * URL: http://hashnote.net/
 *
 */
window.Richarea = function(aID){
    var self = this;
    self.initialize = function(){
        self.window = self.element.contentWindow;
        self.document = self.window.document;
        if (!(self.window.getSelection)){
            self.document.createRange = function(){
                return new DOMRange(self.document);
            };
            var selection = new DOMSelection(self.document);
            self.window.getSelection = function(){
                self.focus();
                return selection;
            };
        }
    };                     
    self.element = document.getElementById(aID);
    if (!!(self.element.contentWindow)) {
        self.initialize();
    } else {
        self.element.onload = self.initialize;
    }
    self.focus = function(){
        self.document.body.focus();
    };
};
window.onload = function(){
    window.richarea = new Richarea('content');
};
window.info = function() {
    var selection = richarea.window.getSelection();
    console.group('Selection Info');
    console.log('Selection:', selection);
    console.log('Range count:', selection.rangeCount);
    console.groupEnd();
    for(var range, i=0, len=selection.rangeCount; i < len; i++){
        range = selection.getRangeAt(i);
        console.group('Selection Range Info');
        console.log('Range:', range);
        console.log('Start:', range.startContainer, range.startOffset);
        console.log('End:', range.endContainer, range.endOffset);
        console.log('Common Ancestor:', range.commonAncestorContainer);
        console.groupEnd();
    }
};
window.makeSelection = function() {
    var selection = richarea.window.getSelection();
    var range = richarea.document.createRange();
    var select = richarea.document.getElementById('select');
    range.setStart(select.firstChild, 2);
    range.setEnd(select.lastChild, 2);
    selection.removeAllRanges();
    selection.addRange(range);
};
window.boldSelection = function() {
    var strong = document.createElement('strong');
    var selection = richarea.window.getSelection();
    var range = selection.getRangeAt(0);
    range.surroundContents(strong);
    // re-select
    range = richarea.document.createRange();
    range.selectNode(strong);
    selection.removeAllRanges();
    selection.addRange(range);
};
window.highlightSelection = function() {
    var span = document.createElement('span');
    span.style.background = 'yellow';
    var selection = richarea.window.getSelection();
    var range = selection.getRangeAt(0);
    range.surroundContents(span);
    // re-select
    range = richarea.document.createRange();
    range.selectNode(span);
    selection.removeAllRanges();
    selection.addRange(range);
};
