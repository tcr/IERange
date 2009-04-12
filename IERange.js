/*
  DOM Ranges for Internet Explorer (m1)
  
  Copyright (c) 2009 Tim Cameron Ryan
  Released under the MIT/X License
 */
 
/*
  Range reference:
    http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html
    http://mxr.mozilla.org/mozilla-central/source/content/base/src/nsRange.cpp
    https://developer.mozilla.org/En/DOM:Range
  Selection reference:
    http://trac.webkit.org/browser/trunk/WebCore/page/DOMSelection.cpp
  TextRange reference:
    http://msdn.microsoft.com/en-us/library/ms535872.aspx#  
  Other links:
    http://stackoverflow.com/questions/164147/character-offset-in-an-internet-explorer-textrange
    http://jorgenhorstink.nl/test/javascript/range/range.js
    http://jorgenhorstink.nl/2006/07/05/dom-range-implementation-in-ecmascript-completed/
    http://dylanschiemann.com/articles/dom2Range/dom2RangeExamples.html
*/

//[TODO] better exception support

(function () {	// sandbox

/*
  DOM functions
 */

var DOMUtils = {
	findChildPosition: function (node) {
		for (var i = 0; node = node.previousSibling; i++);
		return i;
	},
	isDataNode: function (node) {
		return node && node.nodeValue !== null && node.data !== null;
	},
	isAncestorOf: function (parent, node) {
		return !DOMUtils.isDataNode(parent) &&
		    (parent.contains(DOMUtils.isDataNode(node) ? node.parentNode : node) ||		    
		    node.parentNode == parent);
	},
	getNodeLength: function (node) {
		return DOMUtils.isDataNode(node) ? node.nodeValue.length : node.childNodes.length;
	},
	splitDataNode: function (node, offset) {
		if (!isDataNode(node))
			return false;
		var newNode = node.parentNode.insertBefore(node.cloneNode(true), node.nextSibling);
		node.deleteData(0, offset);
		newNode.deleteData(offset, newNode.length);
	}
};

/*
  Text Range utilities
  functions to simplify text range manipulation in ie
 */

var TextRangeUtils = {
	getOffset: function (range, bStart) {
		return Math.abs(range.duplicate()[bStart ? 'moveStart' : 'moveEnd']('character', -1000000));		
	},
	setOffset: function (range, bStart, offset) {
		range[bStart ? 'moveStart' : 'moveEnd']('character', offset - TextRangeUtils.getOffset(range, bStart));
	},
	findAnchor: function (range, bStart) {
//[TODO] find a way to avoid splitting text nodes while preserving selection
		// insert anchor at beginning of range
		var cursor = range.duplicate();
		cursor.collapse(bStart);
		cursor.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
		var temp = document.getElementById('_IERANGE_OFFSET');

		// get container node
		var container = temp.parentNode, offset = DOMUtils.findChildPosition(temp);
		// cleanup and return data
		temp.parentNode.removeChild(temp);
		return {container: container, offset: offset};
	},
	moveToAnchor: function (range, container, offset, bStart) {
		// parameters are based on anchor type (value vs. content)
		var anchorContainer, anchorNode, tOffset = 0;
		// Text Node, Character Data (not Comment or Processing Instruction) data
		if (container.nodeType == 3 || container.nodeType == 4)
		{
			anchorContainer = container.parentNode;
			anchorNode = container;
			tOffset = offset;
		}
		// Element, Attribute, Entity Reference, Document, Document Fragment, &c. children
		else if (!DOMUtils.isDataNode(container))
		{
			anchorContainer = container;
			anchorNode = container.childNodes[offset];
		}

		// create a dummy node to position range (since we can't select text nodes)
		var temp = document.createElement('a');
		anchorContainer.insertBefore(temp, anchorNode);
		var tempRange = document.body.createTextRange();
		tempRange.moveToElementText(temp);
		temp.parentNode.removeChild(temp);
		// get text offset and remove dummy
		tOffset += TextRangeUtils.getOffset(tempRange, bStart);
		TextRangeUtils.setOffset(range, bStart, tOffset);
	}
};

/*
  DOM Range
 */
 
function DOMRange(document, range) {
	// save document parameter
	this._document = document;
	
	// initialize range
//[TODO] should encompass body?
	this.startContainer = this.endContainer = document.body;
	this.endOffset = DOMUtils.getNodeLength(document.body);
	if (range)
		this.loadTextRange(range);
}
DOMRange.START_TO_START = 0;
DOMRange.START_TO_END = 1;
DOMRange.END_TO_END = 2;
DOMRange.END_TO_START = 3;

DOMRange.prototype = {
	// public properties
	startContainer: null,
	startOffset: 0,
	endContainer: null,
	endOffset: 0,
	commonAncestorContainer: null,
	collapsed: false,
	// private properties
	_document: null,
	
	// private methods
	_refreshProperties: function () {
		// collapsed attribute
		this.collapsed = (this.startContainer == this.endContainer && this.startOffset == this.endOffset);
		// find common ancestor
		var node = this.startContainer;
		while (node && node != this.endContainer && !DOMUtils.isAncestorOf(node, this.endContainer))
			node = node.parentNode;
		this.commonAncestorContainer = node;
	},
	
	// range methods
	setStart: function(container, offset) {
		this.startContainer = container;
		this.startOffset = offset;
		this._refreshProperties();
	},
	setEnd: function(container, offset) {
		this.endContainer = container;
		this.endOffset = offset;
		this._refreshProperties();
	},
	setStartBefore: function (refNode) {
		// set start to beore this node
		this.setStart(refNode.parentNode, DOMUtils.findChildPosition(refNode));
	},
	setStartAfter: function (refNode) {
		// select next sibling
		this.setStart(refNode.parentNode, DOMUtils.findChildPosition(refNode) + 1);
	},
	setEndBefore: function (refNode) {
		// set end to beore this node
		this.setEnd(refNode.parentNode, DOMUtils.findChildPosition(refNode));
	},
	setEndAfter: function (refNode) {
		// select next sibling
		this.setEnd(refNode.parentNode, DOMUtils.findChildPosition(refNode) + 1);
	},
	selectNode: function (refNode) {
		this.setStartBefore(refNode);
		this.setEndAfter(refNode);
	},
	selectNodeContents: function (refNode) {
		this.setStart(refNode, 0);
		this.setEnd(refNode, DOMUtils.getNodeLength(redNode));
	},
	collapse: function (toStart) {
		if (toStart)
			this.setEnd(this.startContainer, this.startOffset);
		else
			this.setStart(this.endContainer, this.endOffset);
	},

	// editing methods
	insertNode: function (newNode) {
		// set original anchor and insert node
		if (DOMUtils.isDataNode(this.startContainer)) {
			DOMUtils.splitDataNode(this.startContainer, this.startOffset);
			this.startContainer.parentNode.insertBefore(newNode, this.startContainer.nextSibling);
		} else {
			this.startContainer.insertBefore(newNode, this.startContainer.childNodes[this.startOffset]);
		}
		// resync start anchor
		this.setStart(this.startContainer, this.startOffset);
	},
	surroundContents: function (newNode) {
		// extract and surround contents
		var content = this.extractContents();
		this.insertNode(newNode);
		newNode.appendChild(content);
		this.selectNode(newNode);
	},

	// other methods
	compareBoundaryPoints: function (how, sourceRange) {
		// get anchors
		var containerA, offsetA, containerB, offsetB;
		switch (how) {
		    case DOMRange.START_TO_START:
		    case DOMRange.START_TO_END:
			containerA = this.startContainer;
			offsetA = this.startOffset;
			break;
		    case DOMRange.END_TO_END:
		    case DOMRange.END_TO_START:
			containerA = this.endContainer;
			offsetA = this.endOffset;
			break;
		}
		switch (how) {
		    case DOMRange.START_TO_START:
		    case DOMRange.END_TO_START:
			containerB = sourceRange.startContainer;
			offsetB = sourceRange.startOffset;
			break;
		    case DOMRange.START_TO_END:
		    case DOMRange.END_TO_END:
			containerB = sourceRange.endContainer;
			offsetB = sourceRange.endOffset;
			break;
		}
		
		// compare
		return containerA.sourceIndex < containerB.sourceIndex ? -1 :
		    containerA.sourceIndex == containerB.sourceIndex ?
		        offsetA < offsetB ? -1 : offsetA == offsetB ? 0 : 1
		        : 1;
	},
	cloneRange: function () {
		// return cloned range (directly copying properties for speed)
		var range = new DOMRange(this._document);
		range.startContainer = this.startContainer;
		range.startOffset = this.startOffset;
		range.endContainer = this.endContainer;
		range.endOffset = this.endOffset;
		range.commonAncestorContainer = this.commonAncestorContainer;
		range.collapsed = this.collapsed;
		return range;
	},
	detach: function () {
//[TODO] Releases Range from use to improve performance. 
	},
	toString: function () {
		return this.getTextRange().text;
	},
	createContextualFragment: function (tagString) {
		// parse the tag string in a context node
		var content = (DOMUtils.isDataNode(this.startContainer) ? this.startContainer.parentNode : this.startContainer).cloneNode(false);
		content.innerHTML = tagString;
		// return a document fragment from the created node
		for (var fragment = this._document.createDocumentFragment(); content.firstChild; )
			fragment.appendChild(content.firstChild);
		return fragment;
	},

	// text range manipulation
	getTextRange: function () {
		// return an IE text range
		var textRange = this._document.body.createTextRange();
		TextRangeUtils.moveToAnchor(textRange, this.startContainer, this.startOffset, true);
		TextRangeUtils.moveToAnchor(textRange, this.endContainer, this.endOffset, false);
		return textRange;
	},
//[TODO] move this to TextRangeUtils?
	loadTextRange: function (textRange) {
		var start = TextRangeUtils.findAnchor(textRange, true);
		this.startContainer = start.container;
		this.startOffset = start.offset;
		var end = TextRangeUtils.findAnchor(textRange, false);
		this.endContainer = end.container;
		this.endOffset = end.offset;
		this._refreshProperties();
	}
}

/*
  Range Iterator
 */

//[TODO] make this a real iterator class

function RangeIterator(partialText, partialElement) {
	this.iterate = function (domRange) {
		// partial range iteration
		function iteratePartialRange(node, offset, bStart, partial) {
			var pOffset = bStart ? offset : 0;
			var pLength = bStart ? DOMUtils.getNodeLength(node) - offset : offset;
			var newNode = (DOMUtils.isDataNode(node) ? partialText : partialElement).call(domRange, node, pOffset, pLength);
//[TODO] partial as argument to partialElement?			
			if (partial)
				newNode.insertBefore(partial, bStart ? newNode.firstChild : null);
			return node.parentNode == domRange.commonAncestorContainer ? newNode :
				iteratePartialRange(node.parentNode, DOMUtils.findChildPosition(node) + bStart, bStart, newNode);
		}
		
		// handle case where common ancestor is anchor
		if (domRange.startContainer == domRange.endContainer)
			return (DOMUtils.isDataNode(domRange.startContainer) ? partialText : partialElement)
			    .call(domRange, domRange.startContainer, domRange.startOffset, domRange.endOffset - domRange.startOffset);

		// find root anchors
		for (var startAnchor = domRange.startContainer; startAnchor.parentNode != domRange.commonAncestorContainer; )
			startAnchor = startAnchor.parentNode;
		for (var endAnchor = domRange.endContainer; endAnchor.parentNode != domRange.commonAncestorContainer; )
			endAnchor = endAnchor.parentNode;
		// clone container
		var offset = DOMUtils.findChildPosition(startAnchor) + 1, length = DOMUtils.findChildPosition(endAnchor) - offset;
		var container = partialElement(domRange.commonAncestorContainer, offset, length);
		// append partials
		container.insertBefore(iteratePartialRange(domRange.startContainer, domRange.startOffset, true), container.firstChild);
		container.appendChild(iteratePartialRange(domRange.endContainer, domRange.endOffset, false));
		// convert to document fragment
		for (var nodes = this._document.createDocumentFragment(); container.firstChild; )
			nodes.appendChild(container.firstChild);
		return nodes;
	}
}

// range editing methods
DOMRange.prototype.cloneContents = function () {
	// cloning methods
	var range = this;
	function clonePartialText(node, offset, length) {
		return range._document.createTextNode(node.substringData(offset, length));
	}
	function clonePartialElement(node, offset, length) {
		var newNode = node.cloneNode(false);
		for (var child = node.childNodes[offset]; child && length--; child = child.nextSibling)
			newNode.appendChild(child.cloneNode(true));
		return newNode;
	}

	// clone contents
	return (new RangeIterator(clonePartialText, clonePartialElement)).iterate(this);
}
DOMRange.prototype.deleteContents = function () {
	// extract contents and return nothing
	this.extractContents();
}
DOMRange.prototype.extractContents = function () {
	// extraction methods
	var range = this;
	function extractPartialText(node, offset, length) {
		var newNode = range._document.createTextNode(node.substringData(offset, length));
		node.deleteData(offset, length);
		return newNode;
	}
	function extractPartialElement(node, offset, length) {
		var newNode = node.cloneNode(false);
		while (node.childNodes[offset] && length--)
			newNode.appendChild(node.removeChild(node.childNodes[offset]));
		return newNode;
	}

	// get new anchors
	var anchor = DOMUtils.isDataNode(this.endContainer) || this.endOffset >= this.endContainer.childNodes.length ?
	    this.endContainer : this.endContainer.childNodes[this.endOffset];
	// extract contents
	var content = (new RangeIterator(extractPartialText, extractPartialElement)).iterate(this);
	// set anchors
	this.selectNode(anchor);
	this.collapse(true);
	// return content
	return content;
}

/*
  DOM Selection
 */
 
//[NOTE] This is a very shallow implementation of the Selection object, based on Webkit's
// implementation and without redundant features. Complete selection manipulation is still
// possible with just removeAllRanges/addRange/getRangeAt.

function DOMSelection(document) {
	// save document parameter;
	this._document = document
	
	// add DOM selection handler
	var selection = this;
	document.attachEvent('onselectionchange', function (e) { selection._selectionChangeHandler(e); });
}

DOMSelection.prototype = {
	// public properties
	rangeCount: 0,
	// private properties
	_ranges: [],
	_canChangeSelection: true,
	_document: null,
	
	// private methods
	_selectionChangeHandler: function (e) {
		// check if we can update selection
		if (!this._canChangeSelection)
			return;
		
		// clear ranges list
		this._ranges = [];
		// add any existing selection, or a cursor position in content editable mode
		var textRange = this._document.selection.createRange();
		if (textRange.compareEndPoints('StartToEnd', textRange) != 0 ||
		    textRange.parentElement().isContentEditable)
			this._ranges.push(new DOMRange(this._document, this._document.selection.createRange()));
		this.rangeCount = this._ranges.length;
	},
	_refreshSelectionFromRanges: function () {
		// check if we can update selection
		this._canChangeSelection = false;
		
		// update range count
		this.rangeCount = this._ranges.length;
		// select ranges
		for (var i = 0; i < this._ranges.length; i++)
			this._ranges[i].getTextRange().select();
		
		// enable selection
		this._canChangeSelection = true;
	},
	
	// public methods
	addRange: function (range) {
		// add range or combine with existing range
		if (!this._ranges.length)
			this._ranges.push(range.cloneRange());
		else {
			// only modify range if it intersects with current range
			var selection = this._ranges[0];
			if (range.compareBoundaryPoints(DOMRange.START_TO_START, selection) == -1)
				if (range.compareBoundaryPoints(DOMRange.START_TO_END, selection) > -1 &&
				    range.compareBoundaryPoints(DOMRange.END_TO_END, selection) == -1)
					selection.setStart(range.startContainer, range.startOffset);
			else
				if (range.compareBoundaryPoints(DOMRange.END_TO_START, selection) < 1 &&
				    range.compareBoundaryPoints(DOMRange.END_TO_END, selection) > -1)
					selection.setEnd(range.endContainer, range.endOffset);
		}
		this._refreshSelectionFromRanges();
	},
	removeAllRanges: function () {
		// remove all ranges
		this._document.selection.empty();
		this._ranges = [];
		this._refreshSelectionFromRanges();
	},
	getRangeAt: function (index) {
		// get specified range
		return this._ranges[index] && this._ranges[index].cloneRange();
	},
	toString: function () {
		// get selection text
		return this._document.selection.createRange().text;
	}
}

/*
  scripting hooks
 */

document.createRange = function () {
	return new DOMRange(document);
}

var selection = new DOMSelection(document);
window.getSelection = function () {
	return selection;
}

//[TODO] expose DOMRange/DOMSelection to window.?

})();
