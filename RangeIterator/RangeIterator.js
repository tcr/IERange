var DOMUtils = {
	findClosestAncestor: function (root, node) {
		if (!isAncestorOf(root, node))
			return node;
		while (node && node.parentNode != root)
			node = node.parentNode;
		return node;
	}
}

/*
  Range editing
 */

DOMRange.prototype.cloneContents = function () {
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

DOMRange.prototype.extractContents = function () {
	// move anchor
	this.setStartBefore(DOMUtils.findClosestAncestor(this.commonAncestorContainer, this.endContainer));
	this.collapse(true);
	// extract a range
	return (function extractSubtree(iterator) {
		for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
			node = !iterator.hasPartialSubtree() ? iterator.remove() : node.cloneNode(false);
			if (iterator.hasPartialSubtree())
				node.appendChild(extractSubtree(iterator.getSubtreeIterator()));
			frag.appendChild(node);
		}
		return frag;
	})(new RangeSubtreeIterator(this));
}

DOMRange.prototype.deleteContents = function () {
	// move anchor
	this.setStartBefore(DOMUtils.findClosestAncestor(this.commonAncestorContainer, this.endContainer));
	this.collapse(true);
	// delete a range
	(function deleteSubtree(iterator) {
		for (var node; node = iterator.next(); )
			!node.hasPartialSubtree() ?
			    iterator.remove() :
			    deleteSubtree(iterator.getSubtreeIterator());
	})(new RangeSubtreeIterator(this));
}

/*
  Range iterator
 */

function RangeIterator(range) {
	this.range = range;
	this._next = DOMUtils.findClosestAncestor(range.commonAncestorContainer, range.startContainer);
	this._end = DOMUtils.findClosestAncestor(range.commonAncestorContainer, range.endContainer);
}

RangeIterator.prototype = {
	// public properties
	range: null,
	// private properties
	_current: null,
	_next: null,
	_end: null

	// public methods
	next: function () {
		// move to next node
		this._current = this._next;
		this._next = this._current && this._current.nextSibling != this._end ?
		    this._current.nextSibling : null;

		// check for partial text nodes
		if (DOMUtils.isDataNode(this._current))
			if (this.range.startContainer = this._current)
				return document.createTextNode(this.range.startContainer.substringData(0, this.range.startOffset));
			else if (this.range.endContainer = this._current)
				return document.createTextNode(this.range.endContainer.substringData(this.range.endOffset));
		return this._current;
	},
	remove: function () {
		// check for partial text nodes
		if (DOMUtils.isDataNode(this._current))
			if (this.range.startContainer = this._current)
//[TODO] should return partial text nodes!
				return this._current.deleteData(this.range.startOffset);
			else if (this.range.endContainer = this._current)
				return this._current.deleteData(0, this.range.endOffset);
		return this._current.parentNode.removeChild(this._current);
	}
	hasPartialSubtree: function () {
		// check if this node be partially selected
		return isAncestorOf(this.range.startContainer, this._current) ||
		    isAncestorOf(this.range.endConainer, this._current);
	},
	getRangeSubtreeIterator: function () {
		// create a new range
		var subRange = new DOMRange(document);
		subRange.selectNodeContents(this._current);
		// find anchor points
		if (isAncestorOf(this.range.startContainer, this._current))
			subRange.setStart(this._current, DOMUtils.findClosestAncestor(this._current, this.range.startContainer));
		if (isAncestorOf(this.range.endContainer, this._current))
			subRange.setEnd(this._current, DOMUtils.findClosestAncestor(this._current, this.range.endContainer));
		// return iterator
		return new RangeSubtreeIterator(subRange);
	}
});
