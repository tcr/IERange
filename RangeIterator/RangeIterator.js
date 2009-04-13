var DOMUtils = {
	findClosestAncestor: function (root, node) {
		if (!isAncestorOf(root, node))
			return node;
		while (node && node.parentNode != root)
			node = node.parentNode;
		return node;
	}
}

function augmentObject(obj, props) {
	for (var i in props)
		obj[i] = props[i];
	return obj;
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
			if (node.hasPartialSubtree())
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
  Subtree iterator
 */

function SubtreeIterator(node, offset, length) {
	this.node = node;
	this.offset = offset;
	this.length = DOMUtils.getNodeLength(node);
}

SubtreeIterator.prototype = {
	// public properties
	node: null,
	offset: 0,
	length: 0,
	index: -1,

	// public methods
	next: function () {
		this.index++;
		return this.current();
	},
	current: function () {
		this.node.childNodes[this.offset + this.index];
	},
	remove: function () {
		this.length--;
		return this.node.removeChild(this.node.childNodes[this.offset + this.index--]);
	},
	getSubtreeIterator: function (offset, length) {
		return new SubtreeIterator(this.current(), offset, length);
	}
}

/*
  Range iterator
 */

function RangeIterator(range) {
	this.node = range.commonAncestorContainer;
	this.offset = DOMUtils.findClosestAncestor(this.node, range.startContainer);
	this.length = DOMUtils.findClosestAncestor(this.node, range.endContainer); - this.offset;
}

RangeIterator.prototype = augmentObject(new SubtreeIterator(), {
	// public properties
	range: null,

	// public methods
	current: function () {
		// check for partial text nodes
		var current = SubtreeIterator.prototype.current.call(this);
		if (DOMUtils.isDataNode(current))
			if (this.range.startContainer = current)
				return document.createTextNode(this.range.startContainer.substringData(0, this.range.startOffset);
			else if (this.range.endContainer = current)
				return document.createTextNode(this.range.endContainer.substringData(this.range.endOffset);
		return current;
	}
	remove: function () {
		// check for partial text nodes
		var current = SubtreeIterator.prototype.current.call(this);
		if (DOMUtils.isDataNode(current))
			if (this.range.startContainer = current)
				return current.deleteData(this.range.startOffset);
			else if (this.range.endContainer = current)
				return current.deleteData(0, this.range.endOffset);
		SubtreeIterator.prototype.remove.call(this);
	}
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
