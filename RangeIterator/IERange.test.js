// http://stackoverflow.com/questions/164147/character-offset-in-an-internet-explorer-textrange
// http://msdn.microsoft.com/en-us/library/ms535872.aspx#
// http://jorgenhorstink.nl/test/javascript/range/range.js
// http://dylanschiemann.com/articles/dom2Range/dom2RangeExamples.html
// http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html

//[TODO] better error reporting

// sandboxing
(function () {

// DOM functions

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
		return node && node.nodeValue != null;
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
		if (!isDataNode(nodeA) || !isDataNode(nodeB) || nodeA.nodeType != nodeB.nodeType)
			return false;
		nodeA.appendData(nodeB.data);
		nodeB.parentNode.removeChild(nodeB);
	}
	findClosestAncestor: function (root, node) {
		if (!isAncestorOf(root, node))
			return node;
		while (node && node.parentNode != root)
			node = node.parentNode;
		return node;
	}
};

function augmentObject(obj, props) {
	for (var i in props)
		obj[i] = props[i];
	return obj;
}
// functions to simplify text range manipulation in ie

var TextRangeUtils = {
	getOffset: function (range, bStart) {
		return Math.abs(range.duplicate()[bStart ? 'moveStart' : 'moveEnd']('character', -1000000));
	},
	setOffset: function (range, bStart, offset) {
		range[bStart ? 'moveStart' : 'moveEnd']('character', offset - TextRangeUtils.getOffset(range, bStart));
	},
	findAnchor: function (range, bStart) {
		// get current selection
		var selection = document.selection.createRange();
		// insert anchor at beginning of range
		var newrange = range.duplicate();
		newrange.collapse(bStart);
		newrange.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
		var temp = document.getElementById('_IERANGE_OFFSET');

		// get container node
		var container = temp.parentNode, offset = DOMUtils.findChildOffset(temp);
		// merge split text nodes
		DOMUtils.mergeDataNodes(temp.previousSibling, temp.nextSibling);

		// cleanup and return data
		temp.parentNode.removeChild(temp);
		selection.select();
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

function SubtreeIterator() {
	if (arguments.length)
		this.init.apply(this, arguments);
}

SubtreeIterator.prototype = {
	init: function (node, offset, length) {
		this.node = node;
		this.offset = offset == null ? offset : 0;
		this.length = length == null ? length : DOMUtils.getNodeLength(node) - offset;
		this.index = -1;
	}
	next: function () {
		this.index++;
		return this.current();
	},
	current: function () {
		return this.isDataNode() ?
		    this.index == 0 ? document.createTextNode(this.node.substringData(this.offset, this.length) : null :
		    this.node.childNodes[this.offset + this.index];
	},
	remove: function () {
		if (this.isDataNode()) {
			this.node.deleteData(this.offset, this.length);
			this.length = 0;
		} else {
			this.length--;
			return this.node.removeChild(this.node.childNodes[this.offset + this.index--]);
		}
	},
	isDataNode: function () {
		return isDataNode(this.node);
	}
	getSubtreeIterator: function (offset, length) {
		return new SubtreeIterator(this.current(), offset, length);
	}
}

function RangeIterator() {
	if (arguments.length)
		this.init.apply(this, arguments);
}

RangeIterator.prototype = augmentObject(new SubtreeIterator(), {
	init: function (range) {
		// create new iterator
		this.node = range.commonAncestorContainer;
		this.offset = DOMUtils.findClosestAncestor(this.node, range.startContainer);
		this.length = DOMUtils.findClosestAncestor(this.node, range.endContainer); - this.offset;
		this.index = -1;
	},
	hasPartialSubtree: function () {
		// check if this node be partially selected
		var currentNode = this.current();
		return isAncestorOf(this.range.startContainer, currentNode) ||
		    isAncestorOf(this.range.endConainer, currentNode);
	},
	getRangeSubtreeIterator: function () {
		// create a new range
		var subRange = new DOMRange(document), currentNode = this.current();
		subRange.selectNodeContents(currentNode);
		// find anchor points
		if (isAncestorOf(this.range.startContainer, currentNode))
			subRange.setStart(currentNode, DOMUtils.findClosestAncestor(currentNode, this.range.startContainer));
		if (isAncestorOf(this.range.endContainer, currentNode))
			subRange.setEnd(currentNode, DOMUtils.findClosestAncestor(currentNode, this.range.endContainer));
		// return iterator
		return new RangeSubtreeIterator(subRange);
	}
});


window.DOMSelection = function () {
//[TODO] support multiple ranges, callbacks, for fdynamic range-modification selection support
	var ranges = [];
	this.rangeCount = 0;
	
	// add DOM selection handler
	document.attachEvent('onselectionchange', function () {
	console.log('hai');
		// get new anchor points
		selection = document.selection.createRange();
		var start = TextRangeUtils.getOffset(selection, true);
		var end = TextRangeUtils.getOffset(selection, false);
		
		// create range if none exists
		if (!ranges.length)
			this.addRange(new DOMRange(document.selection.createRange()));
		// update ranges
		for (var i = 0; i < ranges.length; i++) {
			ranges[i].setStart(start.container, start.offset);
			ranges[i].setEnd(end.container, end.offset);
		}
	});
	
	function updateSelection() {
//[TODO] inhibit DOM selection handler here?
		// iterate ranges
		for (var start = null, end = [0], i = 0; i < ranges.length; i++) {
			var range = ranges[i].getTextRange();
			start = Math.min(TextRangeUtils.getOffset(ranges[i], true), start);
			end = Math.max(TextRangeUtils.getOffset(ranges[i], false), end);
		}
		// set new range
		var range = document.createTextRange();
		TextRangeUtils.setOffset(range, start, true);
		TextRangeUtils.setOffset(range, end, false);
		range.select();
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
	this.addRange(new DOMRange(document, document.selection.createRange()));
}

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
		
		// update internal text range
		TextRangeUtils.moveToAnchor(textRange, container, offset, true);
	}

	this.setEnd = function(container, offset) {
		this.endContainer = container;
		this.endOffset = offset;
		refreshProperties();

		// update internal text range
		TextRangeUtils.moveToAnchor(textRange, container, offset, false);
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
		// clone a subtree
		return (function cloneSubtree(iterator) {
			for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
				node = node.cloneNode(!iterator.hasPartialSubtree());
				if (node.hasPartialSubtree())
					node.appendChild(cloneSubtree(iterator.getSubtreeIterator()));
				frag.appendChild(node);
			}
			return frag;
		})(new RangeSubtreeIterator(this));
	}

	this.extractContents = function () {
		// move anchor
		this.setStartBefore(DOMUtils.findClosestAncestor(this.commonAncestorContainer, this.endContainer));
		this.collapse(true);
		// extract a range
		return (function extractSubtree(iterator) {
			for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
				node = !iterator.hasPartialSubtree() ? iterator.remove() : node.cloneNode(false);
				if (node.hasPartialSubtree())
					node.appendChild(extractSubtree(iterator.getSubtreeIterator()));
				frag.appendChild(node);
			}
			return frag;
		})(new RangeSubtreeIterator(this));
	}

	this.deleteContents = function () {
		// move anchor
		this.extractContents();
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

// document hooks

document.createRange = function () {
	return new DOMRange(document);
}

window.getSelection = function () {
	var selection = new DOMSelection();
	window.getSelection = function () { return selection; }
	return selection;
}

})();
