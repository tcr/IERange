// http://stackoverflow.com/questions/164147/character-offset-in-an-internet-explorer-textrange
// http://msdn.microsoft.com/en-us/library/ms535872.aspx#
// http://jorgenhorstink.nl/test/javascript/range/range.js
// http://dylanschiemann.com/articles/dom2Range/dom2RangeExamples.html
// http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html

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
	findAdjacentSibling: function (refNode, bPrev) {
		var dir = bPrev ? 'previousSibling' : 'nextSibling';
		for (; !refNode[dir] && refNode.parentNode; refNode = refNode.parentNode);
		return refNode[dir] || refNode;
	},
	isDataNode: function (node) {
		return node && node.nodeValue != null && node.data != null;
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
	},
	mergeDataNodes: function (nodeA, nodeB) {
		if (!DOMUtils.isDataNode(nodeA) || !DOMUtils.isDataNode(nodeB) || nodeA.nodeType != nodeB.nodeType)
			return false;
		nodeA.appendData(nodeB.data);
		nodeB.parentNode.removeChild(nodeB);
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
		// get current selection
//		var selection = document.selection.createRange();
		// insert anchor at beginning of range
		var newrange = range.duplicate();
		newrange.collapse(bStart);
		newrange.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
		var temp = document.getElementById('_IERANGE_OFFSET');

		// get container node
		var container = temp.parentNode, offset = DOMUtils.findChildPosition(temp);
		// merge split text nodes
//		DOMUtils.mergeDataNodes(temp.previousSibling, temp.nextSibling);

		// cleanup and return data
		temp.parentNode.removeChild(temp);
//		selection.select();
		return {container: container, offset: offset};
	},
	moveToAnchor: function (range, container, offset, bStart) {
		// parameters are based on anchor type (value vs. content)
		var anchorRef = container, tOffset = 0;
		// Text Node, Character Data (not Comment or Processing Instruction) data
		if (container.nodeType == 3 || container.nodeType == 4)
			tOffset = offset;
		// Element, Attribute, Entity Reference, Document, Document Fragment, &c. children
		else if (!DOMUtils.isDataNode(container) && offset < container.childNodes.length)
			anchorRef = container.childNodes[offset];

		// create a dummy node to position range (since we can't select text nodes)
		var temp = document.createElement('a');
		anchorRef.parentNode.insertBefore(temp, anchorRef);
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

window.DOMRange = function (document) {
	// closure
	var domRange = this;

	// properties
	this.startContainer = null;
	this.startOffset = 0;
	this.endContainer = null;
	this.endOffset = 0;
	this.commonAncestorContainer = null;
	this.collapsed = false;

	function refreshProperties() {
		// collapsed attribute
		domRange.collapsed = (domRange.startContainer == domRange.endContainer && domRange.startOffset == domRange.endOffset);
		// find common ancestor
		var node = domRange.startContainer;
		while (node && node != domRange.endContainer && !DOMUtils.isAncestorOf(node, domRange.endContainer))
			node = node.parentNode;
		domRange.commonAncestorContainer = node;
		
		// trigger listeners
		for (var i = 0; i < listeners.length; i++)
			listeners[i][this];
	}

	// load text range
	function load(textRange) {
		var start = TextRangeUtils.findAnchor(textRange, true);
		domRange.startContainer = start.container;
		domRange.startOffset = start.offset;
		var end = TextRangeUtils.findAnchor(textRange, false);
		domRange.endContainer = end.container;
		domRange.endOffset = end.offset;
		refreshProperties();
	}
	
	// range methods

	this.setStart = function(container, offset) {
		this.startContainer = container;
		this.startOffset = offset;
		refreshProperties();
	}

	this.setEnd = function(container, offset) {
		this.endContainer = container;
		this.endOffset = offset;
		refreshProperties();
	}

	this.setStartBefore = function (refNode) {
		// set start to beore this node
		this.setStart(refNode.parentNode, DOMUtils.findChildPosition(refNode));
	}

	this.setStartAfter = function (refNode) {
		// select next sibling
		this.setStart(refNode.parentNode, DOMUtils.findChildPosition(refNode) + 1);
	}

	this.setEndBefore = function (refNode) {
		// set end to beore this node
		this.setEnd(refNode.parentNode, DOMUtils.findChildPosition(refNode));
	}

	this.setEndAfter = function (refNode) {
		// select next sibling
		this.setEnd(refNode.parentNode, DOMUtils.findChildPosition(refNode) + 1);
	}

	this.selectNode = function (refNode) {
		this.setStartBefore(refNode);
		this.setEndAfter(refNode);
	}

	this.selectNodeContents = function (refNode) {
		this.setStart(refNode, 0);
		this.setEnd(refNode, DOMUtils.getNodeLength(redNode));
	}

	this.collapse = function (toStart) {
		if (toStart)
			this.setEnd(this.startContainer, this.startOffset);
		else
			this.setStart(this.endContainer, this.endOffset);
	}

	// editing methods

	this.cloneContents = function () {
		// cloning methods
		function clonePartialText(node, offset, length) {
			return document.createTextNode(node.substringData(offset, length));
		}
		function clonePartialElement(node, offset, length) {
			var newNode = node.cloneNode(false);
			for (var child = node.childNodes[offset]; child && length--; child = child.nextSibling)
				newNode.appendChild(child.cloneNode(true));
			return newNode;
		}

		// clone contents
		return (new RangeIterator(clonePartialText, clonePartialElement)).iterate(domRange);
	}

	this.deleteContents = function () {
		// extract contents and return nothing
		this.extractContents();
	}

	this.extractContents = function () {
		// extraction methods
		function extractPartialText(node, offset, length) {
			var newNode = document.createTextNode(node.substringData(offset, length));
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
		var content = (new RangeIterator(extractPartialText, extractPartialElement)).iterate(domRange);
		// set anchors
		this.selectNode(anchor);
		this.collapse(true);
		// return content
		return content;
	}

	this.insertNode = function (newNode) {
		// set original anchor and insert node
		if (DOMUtils.isDataNode(this.startContainer)) {
			DOMUtils.splitDataNode(this.startContainer, this.startOffset);
			this.startContainer.parentNode.insertBefore(newNode, this.startContainer.nextSibling);
		} else {
			this.startContainer.insertBefore(newNode, this.startContainer.childNodes[this.startOffset]);
		}
		// resync start anchor
		this.setStart(this.startContainer, this.startOffset);
	}

	this.surroundContents = function (newNode) {
		// extract and surround contents
		var content = this.extractContents();
		this.insertNode(newNode);
		newNode.appendChild(content);
		this.selectNode(newNode);
	}

	// other

	this.compareBoundaryPoints = function (how, sourceRange) {
//[TODO] Compares the boundary points of two Ranges. 
	}

	this.cloneRange = function () {
		var range = new DOMRange();
		range.setStart(this.startcontainer, this.startOffset);
		range.setEnd(this.endContainer, this.endOffset);
		return range;
	}

	this.detach = function () {
//[TODO] Releases Range from use to improve performance. 
	}

	this.toString = function () {
		return this.getTextRange().text;
	}

	this.createContextualFragment = function (tagString) {
		// parse the tag string in a context node
		var content = (DOMUtils.isDataNode(this.startContainer) ? this.startContainer.parentNode : this.startContainer).cloneNode(false);
		content.innerHTML = tagString;
		// return a document fragment from the created node
		for (var fragment = document.createDocumentFragment(); content.firstChild; )
			fragment.appendChild(content.firstChild);
		return fragment;
	}

	this.getTextRange = function () {
		// return an IE text range
		var textRange = document.body.createTextRange();
		TextRangeUtils.moveToAnchor(textRange, this.startContainer, this.startOffset, true);
		TextRangeUtils.moveToAnchor(textRange, this.endContainer, this.endOffset, false);
		return textRange;
	}
	
	// selection hooks
	var listeners = [];
	this.addListener = function (listener) {
		listeners.push(listener);
	}
	this.removeListener = function (listener) {
		for (var i = 0; i < listeners.length; i++) {
			if (listeners[i] = listener)
				listeners = listeners.splice(i, 1);
		}
	}

	// constructor
	load(arguments.length > 1 ? arguments[1] : document.body.createTextRange());
}

DOMRange.START_TO_START = 0;
DOMRange.START_TO_END = 1;
DOMRange.END_TO_END = 2;
DOMRange.END_TO_START = 3;

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
		for (var nodes = document.createDocumentFragment(); container.firstChild; )
			nodes.appendChild(container.firstChild);
		return nodes;
	}
}

/*
  DOM Selection
 */


window.DOMSelection = function () {
	var ranges = [];
	var domSelection = this;
	this.rangeCount = 0;
	
	var selectionEnabled = true;
	
	// update range objects when selection is changed
	function selectionHandler() {
		// check if we can update selection
		if (!selectionEnabled)
			return;
		selectionEnabled = false;

		// get new anchor points
		selection = document.selection.createRange();
		var start = TextRangeUtils.findAnchor(selection, true);
		var end = TextRangeUtils.findAnchor(selection, false);

		// update ranges
		selectionEnabled = false;
		for (var i = 0; i < ranges.length; i++) {
			ranges[i].setStart(start.container, start.offset);
			ranges[i].setEnd(end.container, end.offset);
		}
		// create range if none exists
		if (!ranges.length)
			domSelection.addRange(new DOMRange(selection));
			
		// enable selection
		selectionEnabled = true;
	}	
	// add DOM selection handler
	document.attachEvent('onselectionchange', selectionHandler);
	
	// update on-screen selection when ranges are changed
	function updateSelection() {
		// check if we can update selection
		if (!selectionEnabled)
			return;
		selectionEnabled = false;
			
		// iterate ranges
		for (var start = [], end = [], i = 0; i < ranges.length; i++) {
			var range = ranges[i].getTextRange();
			start.push(TextRangeUtils.getOffset(range, true));
			end.push(TextRangeUtils.getOffset(range, false));
		}

		// select new range
		var range = document.body.createTextRange();
		TextRangeUtils.setOffset(range, true, Math.min.apply(null, start));
		TextRangeUtils.setOffset(range, false, Math.max.apply(null, end));
		range.select();
		
		// enable selection
		selectionEnabled = true;
	}

	this.addRange = function (range) {
		ranges.push(range);
		this.rangeCount = ranges.length;
		range.addListener(updateSelection);
		updateSelection();
	}

	this.removeRange = function (range) {
		for (var i = 0; i < ranges.length; i++) {
			if (ranges[i] == range) {
				ranges = ranges.splice(i, 1);
				range.removeListener(updateSelection);
			}
		}
	}

	this.removeAllRanges = function () {
		while (ranges.length)
			this.removeRange(ranges[0]);
	}

	this.getRangeAt = function (index) {
		return ranges[index];
	}

	this.toString = function () {
		return document.selection.createRange().text;
	}
	
	// add initial range
	var range = document.selection.createRange();
	if (TextRangeUtils.getOffset(range, true) != 0 && TextRangeUtils.getOffset(range, false) != 0)
		this.addRange(new DOMRange(range));
}

/*
  scripting hooks
 */

document.createRange = function () {
	return new DOMRange(document);
}

window.getSelection = function () {
	var selection = new DOMSelection();
	window.getSelection = function () { return selection; }
	return selection;
}

})();
