/*
  Text Range utilities
  functions to simplify text range manipulation in ie
 */

var TextRangeUtils = {
	getOffset: function (range, bStart) {
		return Math.abs(range.duplicate()[bStart ? 'moveStart' : 'moveEnd']('character', -1000000));		
	},
	setOffset: function (range, bStart, offset) {
		range[bStart ? 'moveStart' : 'moveEnd']('character', offset - TextRangeUtils.getOffset(range, bStart));
	},
	findAnchorSearch: function (range, bStart) {
//console.log('Finding anchor at cursor ', TextRangeUtils.getOffset(range, bStart));
		var cursor = range.duplicate(), cursorOffset = TextRangeUtils.getOffset(range, bStart);
		cursor.collapse(bStart);
		var parent = cursor.parentElement(), container, offset = 0;
		var dummy = document.createElement('a'), dummyCursor = document.body.createTextRange();
		// search backwards through node
		do {
			// position dummy and get position
			parent.insertBefore(dummy, dummy.previousSibling);
			dummyCursor.moveToElementText(dummy);

			// if we exceed the cursor, then we've found the node
			var dummyCursorOffset = TextRangeUtils.getOffset(dummyCursor, true);
//console.log('Trying: cursor at ', dummyCursorOffset, ', child position ', DOMUtils.findChildPosition(dummy));
			if (dummyCursorOffset < cursorOffset) {
				// data node
				container = dummy.nextSibling;
				offset = cursorOffset - dummyCursorOffset;
				break;
			} else if (dummyCursorOffset == cursorOffset) {
				// element
				container = parent;
				offset = DOMUtils.findChildPosition(dummy);
				break;
			}
		} while (dummy.previousSibling);
		dummy.parentNode.removeChild(dummy);
//console.log('Found anchor at ', container, offset);
		return {container: container, offset: offset};
	},
	findAnchor: function (range, bStart) {
//[TODO] find a way to merge split text nodes while preserving selection?
		// insert anchor at beginning of range
		var newrange = range.duplicate();
		newrange.collapse(bStart);
		newrange.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
		var temp = document.getElementById('_IERANGE_OFFSET');

		// get container node
		var container = temp.parentNode, offset = DOMUtils.findChildPosition(temp);
		// merge split text nodes
//		DOMUtils.mergeDataNodes(temp.previousSibling, temp.nextSibling);

		// cleanup and return data
		temp.parentNode.removeChild(temp);
		return {container: container, offset: offset};
	},
	findAnchorSafe: function (range, bStart) {
		// find a suitable position to insert temp element (not splitting text nodes)
		var cursor = range.duplicate(), parentRange = document.body.createTextRange();
		parentRange.moveToElementText(cursor.parentElement());
		cursor.collapse(bStart);
		cursor.setEndPoint('EndToEnd', parentRange);
		var cursorOffset = cursor.htmlText.indexOf('<');
		cursor.move('character', cursorOffset);
		
		// insert dummy node
		cursor.pasteHTML('<a id="_IERANGE_OFFSET"></a>');
		var dummy = document.getElementById('_IERANGE_OFFSET');
		// get anchor position
		if (cursorOffset && DOMUtils.isDataNode(dummy.previousSibling))
			var container = dummy.previousSibling, offset = container.length - cursorOffset;
		else
			var container = dummy.parentNode, offset = DOMUtils.findChildPosition(dummy);
		// cleanup and return data
		dummy.parentNode.removeChild(dummy);
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