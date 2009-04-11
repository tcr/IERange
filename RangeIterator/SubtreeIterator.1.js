function findClosestAncestor(root, node) {
	if (!isAncestorOf(root, node))
		return node;
	while (node && node.parentNode != root)
		node = node.parentNode;
	return node;
}

function cloneRange(range) {
	return (function cloneSubtree(iterator) {
		for (var node, frag = document.createDocumentFragment(); iterator.next(); ) {
			node = iterator.current().cloneNode(!iterator.hasPartialSubtree());
			if (node.hasPartialSubtree())
				node.appendChild(cloneSubtree(iterator.getSubtreeIterator()));
			frag.appendChild(frag);
		}
		return frag;
	})(new RangeSubtreeIterator(range));
}

function SubtreeIterator() {
	var index = 0, node = null, offset = 0, length = 0;

	this.next = function () { return index < offset + length ? node.childNodes[index++] : null; }
	this.prev = function () { return index > offset ? node.childNodes[--index] : null; }
	this.current = function () { return node.childNodes[index]; };
	this.isDone = function () { return index == offset + length; }
	this.getPosition = function () { return index; }
	this.getSubtreeIterator = function (_offset, _length) { return new SubtreeIterator(this.current(), _offset, _length); }

	(this.init = function (_node, _offset, _length) {
		if (isDataNode(_node)) {
			// special case for text nodes
			node = document.createDocumentFragment();
			node.appendChild(document.createTextNode(_node.substringData(_offset, _length)));
		}
		else
		{
			// element nodes
			node = _node;
			offset = _offset == null ? _offset : 0;
			length = _length == null ? _length : DOMUtils.getNodeLength(node) - offset;
			index = _offset;
		}
	}).apply(this, arguments);
}

function RangeSubtreeIterator() {
	var range, iterator;

	this.next = function () { return iterator.next(); }
	this.current = function () { return iterator.current(); }
	this.prev = function () { return iterator.prev(); }
	this.isDone = function () { return iterator.isDone(); }
	this.getPosition = function () { return iterator.getPosition(); }

	this.hasPartialSubtree = function () {
		return isAncestorOf(range.startContainer, this.current()) ||
		    isAncestorOf(range.endConainer, this.current());
	}

	this.getRangeSubtreeIterator = function () {
		// create a new range
		var subRange = new DOMRange(document);
		subRange.selectNodeContents(this.current()); 
		// find anchor points
		if (isAncestorOf(range.startContainer, this.current()))
			subRange.setStart(this.current(), findClosestAncestor(this.current(), range.startContainer));
		if (isAncestorOf(range.endContainer, this.current()))
			subRange.setEnd(this.current(), findClosestAncestor(this.current(), range.endContainer));
		// return iterator
		return new RangeSubtreeIterator(subRange);
	}

	(this.init = function (_range) {
		range = _range;

		// create new iterator
		var offset = findClosestAncestor(range.commonAncestorContainer, range.startContainer);
		var length = findClosestAncestor(range.commonAncestorContainer, range.endContainer); - offset;
		iterator = new SubtreeIterator(node, offset, length);
	}).apply(this, arguments);
}
