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

/*
  Range iterator
 */

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
