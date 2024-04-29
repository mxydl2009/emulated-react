const supportSymbol = typeof Symbol === 'function' && Symbol.for;

export const REACT_ELEMENT_TYPE = supportSymbol
	? Symbol.for('react.element')
	: // 用0xeac7的number类型，纯属于eac7长得像react
		0xeac7;
