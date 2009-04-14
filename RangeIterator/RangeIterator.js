var DOMUtils = {
	isDataNode: function (node) {
		return node && node.nodeValue !== null && node.data !== null;
	},
	isAncestorOf: function (parent, node) {
		return parent.compareDocumentPosition(node) & 16;
		/*
		return !DOMUtils.isDataNode(parent) &&
		    (parent.contains(DOMUtils.isDataNode(node) ? node.parentNode : node) ||		    
		    node.parentNode == parent);*/
	},
	findClosestAncestor: function (root, node) {
		if (node == null || !DOMUtils.isAncestorOf(root, node))
			return node;
		while (node && node.parentNode != root)
			node = node.parentNode;
		return node;
	},
	isAncestorOrSelf: function (root, node) {
		return DOMUtils.isAncestorOf(root, node) || root == node;
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
			if (iterator.hasPartialSubtree())
				node.appendChild(cloneSubtree(iterator.getSubtreeIterator()));
			frag.appendChild(node);
		}
		return frag;
	})(new RangeIterator(range));
}

RangeUtils.extractContents = function (range) {
	// extract a range
	var extract = (function extractSubtree(iterator) {
		for (var node, frag = document.createDocumentFragment(); node = iterator.next(); ) {
			iterator.hasPartialSubtree() ? node = node.cloneNode(false) : iterator.remove();
			if (iterator.hasPartialSubtree())
				node.appendChild(extractSubtree(iterator.getSubtreeIterator()));
			frag.appendChild(node);
		}
		return frag;
	})(new RangeIterator(range));
	// move range and return value
	range.setStartBefore(DOMUtils.findClosestAncestor(range.commonAncestorContainer, range.endContainer));
	range.collapse(true);
	return extract;
}

RangeUtils.deleteContents = function (range) {
	// delete a range
	(function deleteSubtree(iterator) {
		while (iterator.next())
			iterator.hasPartialSubtree() ? deleteSubtree(iterator.getSubtreeIterator()) : iterator.remove();
	})(new RangeIterator(range));
	// move range
	range.setStartBefore(DOMUtils.findClosestAncestor(range.commonAncestorContainer, range.endContainer));
	range.collapse(true);
}

/*
  Range iterator
 */

function RangeIterator(range) {
	this.range = range;
	if (range.collapsed)
		return;
	this._next = DOMUtils.findClosestAncestor(range.commonAncestorContainer,
	    DOMUtils.isDataNode(range.startContainer) ? range.startContainer : range.startContainer.childNodes[range.startOffset]);
	this._end = DOMUtils.findClosestAncestor(range.commonAncestorContainer,
	    DOMUtils.isDataNode(range.endContainer) ? range.endContainer : range.endContainer.childNodes[range.endOffset]);
}

RangeIterator.prototype = {
	// public properties
	range: null,
	// private properties
	_current: null,
	_next: null,
	_end: null,

	// public methods
	hasNext: function () {
		return !!this._next;
	},
	next: function () {
		// move to next node
		var current = this._current = this._next;
		this._next = this._current && this._current != this._end ?
		    this._current.nextSibling : null;

		// check for partial text nodes
		if (DOMUtils.isDataNode(this._current)) {
			if (this.range.endContainer == this._current)
				(current = current.cloneNode(true)).deleteData(this.range.endOffset, current.length - this.range.endOffset);
			if (this.range.startContainer == this._current)
				(current = current.cloneNode(true)).deleteData(0, this.range.startOffset);
		}
		return current;
	},
	remove: function () {
		// check for partial text nodes
		if (DOMUtils.isDataNode(this._current) &&
		    (this.range.startContainer == this._current || this.range.endContainer == this._current)) {
			var start = this.range.startContainer == this._current ? this.range.startOffset : 0;
			var end = this.range.endContainer == this._current ? this.range.endOffset : this._current.length;
			this._current.deleteData(start, end - start);
		} else
			this._current.parentNode.removeChild(this._current);
	},
	hasPartialSubtree: function () {
		// check if this node be partially selected
		return !DOMUtils.isDataNode(this._current) &&
		    (DOMUtils.isAncestorOrSelf(this._current, this.range.startContainer) ||
		        DOMUtils.isAncestorOrSelf(this._current, this.range.endContainer));
	},
	getSubtreeIterator: function () {
		// create a new range
		var subRange = document.createRange();//new DOMRange(document);
		subRange.selectNodeContents(this._current);
		// handle anchor points
		if (DOMUtils.isAncestorOrSelf(this._current, this.range.startContainer))
			subRange.setStart(this.range.startContainer, this.range.startOffset);
		if (DOMUtils.isAncestorOrSelf(this._current, this.range.endContainer))
			subRange.setEnd(this.range.endContainer, this.range.endOffset);
		// return iterator
		return new RangeIterator(subRange);
	}
};