import { Props, Type } from 'shared/ReactTypes';

export type ContainerType = Element;
export type Instance = Element;

export function createInstance(type: Type, props: Props): any {
	console.log(type, props);
	const element = document.createElement(type);
	return element;
}

export function createTextInstance(content: string | number): any {
	console.log(content);
	const textNode = document.createTextNode(String(content));
	return textNode;
}

export function appendInitialChild(
	parent: Instance | ContainerType,
	child: Instance
) {
	parent.appendChild(child);
}

export function appendChildToContainer(
	child: Instance,
	parent: Instance | ContainerType
) {
	parent.appendChild(child);
}
