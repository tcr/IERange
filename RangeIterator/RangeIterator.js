var DOMUtils = {
	findClosestAncestor: function (root, node) {
		if (!isAncestorOf(root, node))
			return node;
		while (node && node.parentNode != root)
			node = node.parentNode;
		return node;
	},
	isAncestorOrSelf: function (root, node) {
		return isAncestorOf(root, node) || root == node;
	}
}

/*
  Range editing
 */

var RangeUtils = {};

RangeUtils.cloneContents = function (range) {
	// clone a subtree
	return (function cloneSubtree(iterator) {
		for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
			node = node.cloneNode(!iterator.hasPartialSubtree());
			if (node.hasPartialSubtree())
				node.appendChild(cloneSubtree(iterator.getSubtreeIterator()));
			frag.appendChild(node);
		}
		return frag;
	})(new RangeIterator(range));
}

RangeUtils.extractContents = function (range) {
	// move anchor
	range.setStartBefore(DOMUtils.findClosestAncestor(range.commonAncestorContainer, range.endContainer));
	range.collapse(true);
	// extract a range
	return (function extractSubtree(iterator) {
		for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
			iterator.hasPartialSubtree() ? node = node.cloneNode(false) : iterator.remove();
			if (iterator.hasPartialSubtree())
				node.appendChild(extractSubtree(iterator.getSubtreeIterator()));
			frag.appendChild(node);
		}
		return frag;
	})(new RangeIterator(range));
}

RangeUtils.deleteContents = function (range) {
	// move anchor
	range.setStartBefore(DOMUtils.findClosestAncestor(range.commonAncestorContainer, range.endContainer));
	range.collapse(true);
	// delete a range
	(function deleteSubtree(iterator) {
		for (var node; node = iterator.next(); )
			!node.hasPartialSubtree() ?
			    iterator.remove() :
			    deleteSubtree(iterator.getSubtreeIterator());
	})(new RangeIterator(range));
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
	hasNext: function () {
		return !!this._next;
	},
	next: function () {
		// move to next node
		var current = this._current = this._next;
		this._next = this._current && this._current.nextSibling != this._end ?
		    this._current.nextSibling : null;

		// check for partial text nodes
		if (DOMUtils.isDataNode(this._current)) {
			if (this.range.endContainer == this._current)
				(current = current.cloneNode(true)).deleteData(this.range.endOffset);
			if (this.range.startContainer == this._current)
				(current = current.cloneNode(true)).deleteData(0, this.range.startOffset);
		}
		return current;
	},
	remove: function () {
		// check for partial text nodes
		if (DOMUtils.isDataNode(this._current)) {
			if (this.range.endContainer == this._current)
				return this._current.deleteData(0, this.range.endOffset);
			if (this.range.startContainer == this._current)
				return this._current.deleteData(this.range.startOffset)
		}
		this._current.parentNode.removeChild(this._current);
	}
	hasPartialSubtree: function () {
		// check if this node be partially selected
		return !isDataNode(this._current) &&
		    (isAncestorOrSelf(this.range.startContainer, this._current) ||
		        isAncestorOrSelf(this.range.endContainer, this._current));
	},
	getSubtreeIterator: function () {
		// create a new range
		var subRange = new DOMRange(document);
		subRange.selectNodeContents(this._current);
		// handle anchor points
		if (isAncestorOrSelf(this.range.startContainer, this._current))
			subRange.setStart(this.range.startContainer, this.range.startOffset);
		if (isAncestorOrSelf(this.range.endContainer, this._current))
			subRange.setEnd(this.range.endContainer, this.range.endOffset);
		// return iterator
		return new RangeIterator(subRange);
	}
});
