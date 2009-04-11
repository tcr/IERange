// http://stackoverflow.com/questions/164147/character-offset-in-an-internet-explorer-textrange
// http://msdn.microsoft.com/en-us/library/ms535872.aspx#
// http://jorgenhorstink.nl/test/javascript/range/range.js
// http://dylanschiemann.com/articles/dom2Range/dom2RangeExamples.html
// http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html

//[TODO] better error reporting

// class to simplify text range manipulation in ie
function IETextRange(range) {
	this.getOffset(bStart) {
		return Math.abs(range.duplicate()[bStart ? 'moveStart' : 'moveEnd']('character', -1000000) );
	}
	
	this.setOffset(bStart, offset) {
		range[bStart ? 'moveStart' : 'moveEnd']('character', offset - this.getOffset(bStart));
	}
	
	this.findAnchor(bStart) {
		
	}
	
	this.loadFromAnchor(container, offset, bStart) {
		
	}
}

function getTextOffset(r, bStart) {
	return Math.abs( r.duplicate()[bStart ? 'moveStart' : 'moveEnd']('character', -1000000) );
}

function findChildPosition(node) {
	for (var i = 0; node.previousSibling; node = node.previousSibling)
		i++;
	return i;
}

function textOffsetToAnchor(tOffset) {
	// returns
	var container, offset = 0;

	var range = document.body.createTextRange();
	range.move('character', tOffset);
	range.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
	var anchor = document.getElementById('_IERANGE_OFFSET');
	if (anchor.previousSibling)
	{
		// anchor is previous sibling
		container = anchor.previousSibling;
		// get text node offset
		if (container.nodeType == 3)
		{
			offset = container.nodeValue.length;
			// merge split text nodes
			if (container.nextSibling && container.nextSibling.nodeType == 3)
			{
				container.appendData(container.nextSibling.nodeValue);
				container.parentNode.removeChild(container.nextSibling);
			}
		}
	}
	else
	{
		// anchor is container node
		container = anchor.parentNode.parentNode;
		offset = findChildPosition(anchor.parentNode);
	}
	anchor.parentNode.removeChild(anchor);
	return {container: container, offset: offset};
}

function anchorToTextOffset(container, offset) {
	// parameters based on anchor type
	var anchorRef = container, tOffset = 0;
	switch (container.nodeType)
	{
		case 3: // Text Node
		case 4: // Character Data
		case 8: // Comment
		case 7: // Processing Instruction
			// find text offset
			tOffset = offset;
			break;

		case 1: // Element
		case 2:	// Attribute
		case 5: // Entity Reference
		case 9: // Document
		case 11: // Document Fragment
		default:
			// find specified child
			anchorRef = container.childNodes[offset];
			break;
	}

	// create a dummy node to position range
	var anchor = document.createElement('a');
	anchorRef.parentNode.insertBefore(anchor, anchorRef);
	var range = document.body.createTextRange();
	range.moveToElementText(anchor);
	// get text offset and remove dummy
	tOffset += getTextOffset(range, true);
	anchor.parentNode.removeChild(anchor);
	return tOffset;
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

//[TODO] find a way to sync textrange with DOM changes: ranges should be more
// DOM-oriented, less reliant on text postion (this means load(range))
// maybe we don't maintain a running text range, but only update it as necessary

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
		editable.commonAncestorContainer = textRange.parentElement();
	}

	// loads text range
	function load(range) {
		// load this text range
		textRange = range;
		var start = textOffsetToAnchor(getTextOffset(textRange, true));
		editable.startContainer = start.container;
		editable.startOffset = start.offset;
		var end = textOffsetToAnchor(getTextOffset(textRange, false));
		editable.endContainer = end.container;
		editable.endOffset = end.offset;
		refreshProperties();
	}
	
	// range methods

	this.setStart = function(container, offset) {
		this.startContainer = container;
		this.startOffset = offset;
		refreshProperties();
		
		// move start cursor
		textRange.moveStart('character', anchorToTextOffset(container, offset) - getTextOffset(textRange, true));
	}

	this.setEnd = function(container, offset) {
		this.endContainer = container;
		this.endOffset = offset;
		refreshProperties();

		// move end cursor
		textRange.moveEnd('character', anchorToTextOffset(container, offset) - getTextOffset(textRange, false));
	}

	this.setStartBefore = function (refNode) {
		// set start to beore this node
		this.setStart(refNode.parentNode, findChildPosition(refNode));
	}

	this.setStartAfter = function (refNode) {
		// find next sibling
		for (; !refNode.nextSibling; refNode = refNode.parentNode);
		this.setStartBefore(refNode.nextSibling);
	}

	this.setEndBefore = function (refNode) {
		// set end to beore this node
		this.setEnd(refNode.parentNode, findChildPosition(refNode));
	}

	this.setEndAfter = function (refNode) {
		// find next sibling
		for (; !refNode.nextSibling; refNode = refNode.parentNode);
		this.setEndBefore(refNode.nextSibling);
	}

	this.selectNode = function (refNode) {
		this.setStartBefore(refNode);
		this.setEndAfter(refNode);
	}

	this.selectNodeContents = function (refNode) {
		if (!refNode.firstChild)
//[TODO] is that right?
			this.selectNode(refNode);
		else {
			this.setStartBefore(refNode.firstChild);
			this.setEndAfter(refNode.lastChild);
		}
	}

	this.collapse = function (toStart) {
		if (toStart)
			this.setEnd(this.startContainer, this.startOffset);
		else
			this.setStart(this.endContainer, this.endOffset);
	}

	// editing methods

	this.cloneContents = function () {
		// return a document fragment copying the range nodes
		var content = document.createDocumentFragment();
		var temp = document.createElement('div');
		temp.innerHTML = textRange.htmlText;
		while (temp.firstChild)
			content.appendChild(temp.firstChild);
		return content;
	}

	this.deleteContents = function () {
//[TODO] non-TextRange method of doing this?
		// delete content and refresh
		textRange.pasteHTML('');
		load(textRange);
	}

	this.extractContents = function () {
		// clone and delete contents
		var content = this.cloneContents();
		this.deleteContents();
		return content;
	}

	this.insertNode = function (newNode) {
//[TODO] test if this works and preserves range! also, could we make this less hacky
		// insert node at beginning of range
		var range = document.body.createTextRange();
		range.move('character', getTextOffset(textRange, true));
		range.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
		var anchor = document.getElementById('_IERANGE_OFFSET');
		anchor.parentNode.replaceChild(newNode, anchor);
		// refresh range
		this.setStartBefore(newNode);
		this.setEnd(this.endContainer, this.endOffset);
	}

	this.surroundContents = function (newNode) {
		// extract and surround contents
		var content = this.extractContents();
		this.insertNode(newNode);
		newNode.appendChild(content);
		this.setStartBefore(newNode);
		this.setStartAfter(newNode);
	}

	// other

	this.compareBoundaryPoints = function (how, sourceRange) {
//[TODO] Compares the boundary points of two Ranges. 
	}

	this.cloneRange = function () {
		return new DOMRange(textRange.duplicate());
	}

	this.detach = function () {
//[TODO] Releases Range from use to improve performance. 
	}

	this.toString = function () {
		return textRange.text;
	}

	this.createContextualFragment = function (tagString) {
		// return a document fragment from the created node
		var range = document.body.createTextRange();
		range.move('character', getTextOffset(textRange, true));
		range.pasteHTML(tagString);
		return (new DOMRange(range)).extractContents();
	}

	this.getTextRange = function () {
		// return IE text range
		return textRange;
	}

	// constructor
	load(range || document.body.createTextRange());
}

DOMRange.START_TO_START = 0;
DOMRange.START_TO_END = 1;
DOMRange.END_TO_END = 2;
DOMRange.END_TO_START = 3;

document.createRange = function () {
	return new DOMRange();
}

window.getSelection = function () {
	return new DOMSelection();
}
