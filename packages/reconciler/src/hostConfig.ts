import { Props, Type } from 'shared/ReactTypes';

export type ContainerType = any;
export type Instance = HTMLElement | Text;

export function createInstance(type: Type, props: Props): HTMLElement {
	const ele = document.createElement(type);
	for (const key in props) {
		ele.setAttribute(key, props[key]);
	}
	return ele;
}

export function createTextInstance(content: string | number): Text {
	content = String(content);
	const ele = document.createTextNode(content);
	return ele;
}
