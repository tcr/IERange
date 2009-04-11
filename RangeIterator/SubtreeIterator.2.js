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

{
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
}

function SubtreeIterator() {
	if (arguments.length)
		this.init.apply(this, arguments);
}

SubtreeIterator.prototype = {
	init: function (node, offset, length) {
		if (isDataNode(node)) {
			// data nodes iterated as one node fragment
			var node = document.createTextNode(node.substringData(offset, length));
			this.length = 1;
			this.offset = 0;
			this.index = -1;
			this.next = function () { return ++this.index < this.length ? node : null; }
			this.current = function () { return this.index == 0 ? node : null; }
			this.remove = function () {
				if (!this.hasNext())
					node.deleteData(offset, length);
				this.init(document.createDocumentFragment());
			}
		}

		// element nodes
		this.node = node;
		this.offset = offset == null ? offset : 0;
		this.length = length == null ? length : DOMUtils.getNodeLength(node) - offset;
		this.index = -1;
	}
	next: function () { return this.index < this.length ? this.node.childNodes[this.offset + ++this.index] : null; },
	current: function () { return this.node.childNodes[this.offset + this.index]; },
	hasNext: function () { return this.index == this.length; },
	remove: function () {
		this.length--;
		return this.node.removeChild(this.node.childNodes[this.offset + this.index--]);
	},
	getSubtreeIterator: function (offset, length) { return new SubtreeIterator(this.current(), offset, length); }
}

function RangeSubtreeIterator() {
	if (arguments.length)
		this.init.apply(this, arguments);
}

RangeSubtreeIterator.prototype = augmentObject(new SubtreeIterator(), {
	init: function (range) {
		this.range = range;

		// create new iterator
		var ancestor = range.commonAncestorContainer;
		var offset = DOMUtils.findClosestAncestor(ancestor, range.startContainer);
		var length = DOMUtils.findClosestAncestor(ancestor, range.endContainer); - offset;
		this.iterator = new SubtreeIterator(ancestor, offset, length);
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
		if (isAncestorOf(this.range.startContainer, current))
			subRange.setStart(currentNode, DOMUtils.findClosestAncestor(currentNode, this.range.startContainer));
		if (isAncestorOf(this.range.endContainer, currentNode))
			subRange.setEnd(currentNode, DOMUtils.findClosestAncestor(currentNode, this.range.endContainer));
		// return iterator
		return new RangeSubtreeIterator(subRange);
	}
});
