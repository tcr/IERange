// http://stackoverflow.com/questions/164147/character-offset-in-an-internet-explorer-textrange
// http://msdn.microsoft.com/en-us/library/ms535872.aspx#
// http://jorgenhorstink.nl/test/javascript/range/range.js
// http://dylanschiemann.com/articles/dom2Range/dom2RangeExamples.html
// http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html

//[TODO] better error reporting

function findChildPosition(node) {
	for (var i = 0; node = node.previousSibling; i++);
	return i;
}

function findPreviousSibling(refNode) {
	for (; !refNode.previousSibling && refNode.parentNode; refNode = refNode.parentNode);
	return refNode.previousSibling || refNode;
}

function findNextSibling(refNode) {
	for (; !refNode.nextSibling && refNode.parentNode; refNode = refNode.parentNode);
	return refNode.nextSibling || refNode;
}

//[TODO] eliminate use of this
function anchorWithTempNode(range, callback, bStart) {
	// insert anchor at beginning of range
	var newrange = range.duplicate();
	newrange.collapse(bStart);
	newrange.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
	var temp = document.getElementById('_IERANGE_OFFSET');

	// call callback
	callback(temp);

	// merge split text nodes
//[TODO] does this have to happen after removal to preserve selection?
	if (temp.nextSibling && temp.nextSibling.nodeType == 3)
	{
		container.appendData(temp.nextSibling.nodeValue);
		temp.parentNode.removeChild(temp.nextSibling);
	}

	// remove anchor
	temp.parentNode.removeChild(temp);
}

// class to simplify text range manipulation in ie
//[TODO] should this just be a set of utils?

function TextRangeProxy(range)
{
	this.getOffset(bStart) {
		return Math.abs(range.duplicate()[bStart ? 'moveStart' : 'moveEnd']('character', -1000000) );
	}
	
	this.setOffset(bStart, offset) {
		range[bStart ? 'moveStart' : 'moveEnd']('character', offset - this.getOffset(bStart));
	}
	
	this.findAnchor(bStart) {
		// returns
		var container, offset = 0;
		// find anchor using temp node
		anchorWithTempNode(range, function (temp) {
			if (temp.previousSibling)
			{
				// anchor is previous sibling
//[TODO] isn't anchor next sibling?
				container = temp.previousSibling;
				// get text node offset
				if (container.nodeType == 3)
					offset = container.nodeValue.length;
			}
			else
			{
				// anchor is container node
				container = temp.parentNode.parentNode;
				offset = findChildPosition(temp.parentNode);
			}
		}, bStart);
		return {container: container, offset: offset};
	}
	
	this.moveToAnchor(container, offset, bStart) {
		// parameters are based on anchor type (value vs. content)
		var anchorRef = container, tOffset = 0;
		// Text Node, Character Data (not Comment or Processing Instruction) data
		if (container.nodeType == 3 || container.nodeType == 4)	
			tOffset = offset;
		// Element, Attribute, Entity Reference, Document, Document Fragment, &c. children
		else if (!container.nodeValue && offset < container.childNodes.length)
			anchorRef = container.childNodes[offset];

		// create a dummy node to position range (since we can't select text nodes)
		var temp = document.createElement('a');
		anchorRef.parentNode.insertBefore(temp, anchorRef);
		var range = document.body.createTextRange();
		range.moveToElementText(anchor);
//[TODO] does this order screw up things?
		temp.parentNode.removeChild(temp);
		// get text offset and remove dummy
		tOffset += getTextOffset(range, true);
		this.setOffset(tOffset, bStart);
	}
	
	// copied methods
	this.getCommonAncestorContainer = range.parentElement;
//[TODO] save start position on setHTML
	this.setHTML = function (html) {
//		var start = this.getOffset(true);
		range.pasteHTML(html);
//		this.setOffset(true, start);
	}
	this.getHTML = function () { return range.htmlText; }
	this.getText = function () { return range.text; }
	this.collapse = range.collapse;
	this.duplicate = range.duplicate;
	this.select = range.select;
	this.getNative = function () { return range; }
}

function DOMSelection() {
//[TODO] support multiple ranges
	var textRange = document.selection.createRange();

	this.rangeCount = 1;

	this.addRange = function (range) {
		range.getTextRange().select();
	}

	this.removeRange = function (range) {
	}

	this.removeAllRanges = function () {
	}

	this.getRangeAt = function (index) {
		return new DOMRange(textRange);
	}

	this.toString = function () {
		return textRange.text;
	}
}

function DOMRange(range) {
//[TODO] take document parameter?
	// closure
	var editable = this;

	// private properties
	var textRange = null;
	// properties
	this.startContainer = null;
	this.startOffset = 0;
	this.endContainer = null;
	this.endOffset = 0;
	this.commonAncestorContainer = null;
	this.collapsed = false;

	function refreshProperties() {
		editable.collapsed = (editable.startContainer == editable.endContainer && editable.startOffset == editable.endOffset);
		editable.commonAncestorContainer = textRange.getCommonAncestorContainer();
	}

	// load text range
	function load(range) {
		textRange = new TextRangeProxy(range);
		var start = textRange.findAnchor(true);
		editable.startContainer = start.container;
		editable.startOffset = start.offset;
		var end = textRange.findAnchor(false);
		editable.endContainer = end.container;
		editable.endOffset = end.offset;
		refreshProperties();
	}
	
	// range methods

	this.setStart = function(container, offset) {
		this.startContainer = container;
		this.startOffset = offset;
		refreshProperties();
		
		// update internal text range
		textRange.moveToAnchor(container, offset, true);
	}

	this.setEnd = function(container, offset) {
		this.endContainer = container;
		this.endOffset = offset;
		refreshProperties();

		// update internal text range
		textRange.moveToAnchor(container, offset, false);
	}

	this.setStartBefore = function (refNode) {
		// set start to beore this node
		this.setStart(refNode.parentNode, findChildPosition(refNode));
	}

	this.setStartAfter = function (refNode) {
		// select next sibling
		this.setStartBefore(findNextSibling(refNode));
	}

	this.setEndBefore = function (refNode) {
		// set end to beore this node
		this.setEnd(refNode.parentNode, findChildPosition(refNode));
	}

	this.setEndAfter = function (refNode) {
		// select next sibling
		this.setEndBefore(findNextSibling(refNode));
	}

	this.selectNode = function (refNode) {
		this.setStartBefore(refNode);
		this.setEndAfter(refNode);
	}

	this.selectNodeContents = function (refNode) {
		this.setStart(refNode, 0);
		this.setEnd(refNode, refNode.nodeValue == null ? refNode.nodeValue.length - 1 : refNode.childNodes.length - 1);
	}

	this.collapse = function (toStart) {
		if (toStart)
			this.setEnd(this.startContainer, this.startOffset);
		else
			this.setStart(this.endContainer, this.endOffset);
	}

	// editing methods
//[TODO] the specs should really be followed on these (i.e. cloning vs. innerHTML)

	function iterateRange(partialText, partialElement) {
		// partial range iteration
		function iteratePartialRange(node, offset, bStart, partial) {
			var length = node.nodeValue ? node.length : node.childNodes.length;
			var offset = bStart ? offset < length ? offset: length - 1 : 0;
			var newNode = (node.nodeValue ? partialText : partialElement).call(this, node, length, offset);
			if (partial)
				newNode.insertBefore(partial, bStart ? newNode.firstChild : null);
			return node.parentNode == this.commonAncestorContainer ? newNode :
				iteratePartialRange(node.parentNode, findChildPosition(node) + bStart, bStart, newNode);
		}

		// handle case where common ancestor is anchor
		if (this.startContainer == this.commonAncestorContainer)
			return (this.startContainer.nodeValue ? partialText : partialElement)
			    .call(this, this.startContainer, this.startOffset, this.endOffset - this.startOffset);

		// find anchors
		for (var startAnchor = this.startContainer; startAnchor.parentNode != this.commonAncestorContainer; )
			startAnchor = startAnchor.parentNode;
		for (var endAnchor = this.endContainer; endAnchor.parentNode != this.commonAncestorContainer; )
			endAnchor = endAnchor.parentNode;
		// clone container
		var offset = findChildPosition(startAnchor) + 1, length = findChildPosition(endAnchor) - offset;
		var container = partialElement(this.commonAncestorContainer, offset, length);

		// append partials
		container.insertBefore(iteratePartialRange(this.startContainer, this.startOffset, true), container.firstChild);
		container.appendChild(iteratePartialRange(this.endContainer, this.endOffset, false));
		return container;
	}

	this.cloneContents = function () {
		// cloning methods
		function clonePartialText(node, offset, length) {
			return document.createTextNode(node.substringData(offset, length));
		}
		function clonePartialElement(node, offset, length) {
			var newNode = node.cloneNode(false);
			for (var child = node.childNodes[offset]; child && length--; child = child.nextSibling)
				newNode.appendChild(cloneSelectedNode(child));
			return newNode;
		}
		function cloneSelectedNode(node) {
			return node.cloneNode(true);
		}

		// clone contents
		return iterateRange(clonePartialText, clonePartialElement);
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
				newNode.appendChild(extractSelectedNode(node.childNodes[offset]));
			return newNode;
		}
		function extractSelectedNode(node) {
			return node.parentNode.removeChild(node);
		}

		// get new anchors
		var anchor = this.endContainer.nodeValue ? this.endContainer :
		    this.endContainer.childNodes[this.endOffset];
		// extract contents
		var content = iterateRange(extractPartialText, extractPartialElement);
		// set anchors
		this.selectNode(anchor);
		this.collapse(true);
		// return content
		return content;
	}

	this.insertNode = function (newNode) {
		// set original anchor and insert node
		if (newNode.nodeValue) {
			this.startContainer.parentNode.insertBefore(document.createTextNode(newNode.substringData(this.startOffset)), this.startContainer.nextSibling);
			this.startContainer.parentNode.insertBefore(newNode, this.startContainer.nextSibling);
			this.startContainer.deleteData(0, this.startOffset);
		} else {
			if (this.startOffset < this.startContainer.childNodes.length)
				this.startContainer.parentNode.insertBefore(newNode, this.startContainer);
			else
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
		// return a document fragment from the created node
		var range = textRange.duplicate();
		range.collapse(true);
		range.setHTML(tagString);
//[TODO] this may split text nodes...
//[TODO] moveToStartPoint (setHTML resets range to end)
		return (new DOMRange(range)).extractContents();
	}

	this.getTextRange = function () {
		// return IE text range
		return textRange.getNative();
	}

	// constructor
	load(range || document.body.createTextRange());
}

DOMRange.START_TO_START = 0;
DOMRange.START_TO_END = 1;
DOMRange.END_TO_END = 2;
DOMRange.END_TO_START = 3;

// document hooks

document.createRange = function () {
	return new DOMRange();
}

window.getSelection = function () {
	return new DOMSelection();
}
