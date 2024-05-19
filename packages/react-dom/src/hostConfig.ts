import { FiberNode } from 'reconciler/src/fiberNode';
import { HostText } from 'reconciler/src/workTag';
import { Props, Type } from 'shared/ReactTypes';
import { updateFiberPropsToInstance } from './syntheticEvent';
import { DOMElement } from './syntheticEvent';

export type ContainerType = Element;
export type Instance = HTMLElement;

export function createInstance(type: Type, props: Props): any {
	const element = document.createElement(type as string) as unknown;
	updateFiberPropsToInstance(element as DOMElement, props);
	return element;
}

export function createTextInstance(content: string | number): any {
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

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		// 需要使用花括号来包裹声明的变量，否则eslint会报错
		case HostText: {
			const text = fiber.memoizedProps.content;
			return commitTextUpdate(fiber.stateNode, text);
		}

		default:
			if (__DEV__) {
				console.warn('commitUpdate未实现的类型', fiber.tag);
			}
			break;
	}
}

function commitTextUpdate(textInstance: Text, content: string | number) {
	textInstance.textContent = String(content);
}

export function removeChild(child: Element | Text, container: Element) {
	container.removeChild(child);
}

export function insertChildToContainer(
	child: Instance,
	container: Instance | ContainerType,
	before: Instance
) {
	container.insertBefore(child, before);
}

export const scheduleMicroTask = (function () {
	if (typeof queueMicrotask === 'function') {
		return queueMicrotask;
	}
	if (typeof Promise === 'function') {
		return (cb) => Promise.resolve(null).then(cb);
	}
	return setTimeout;
})();

export function hideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.setProperty('display', 'none', 'important');
}

export function unhideInstance(instance: Instance) {
	const style = (instance as HTMLElement).style;
	style.display = '';
}

export function hideTextInstance(textInstance: Instance) {
	textInstance.nodeValue = '';
}

export function unhideTextInstance(textInstance: Instance, content: string) {
	textInstance.nodeValue = content;
}

export function setInitialProperties(instance: Instance, nextProps: Props) {
	for (const propKey in nextProps) {
		if (!Object.prototype.hasOwnProperty.call(nextProps, propKey)) {
			continue;
		}
		const nextProp = nextProps[propKey];
		if (propKey === 'style') {
			// 处理style
			setStyleProperty(instance, nextProp);
		} else if (propKey === 'children') {
			// children不需要处理, children为string或者number时，由placeSingleChild方法处理
		} else if (propKey === 'className') {
			// className
			setClassNameProperty(instance, nextProp);
		} else {
			// 其他属性
			instance[propKey] = nextProp;
		}
	}
}

function setStyleProperty(instance: Instance, styles: CSSStyleDeclaration) {
	const style = instance.style;
	for (const stylesProp in styles) {
		if (!Object.prototype.hasOwnProperty.call(styles, stylesProp)) {
			if (__DEV__) {
				console.warn('未知的style样式属性', stylesProp);
			}
			continue;
		}
		if (isEmpty(styles[stylesProp])) {
			continue;
		}
		style[stylesProp] = ('' + styles[stylesProp]).trim();
	}
}

function isEmpty(value: any) {
	return (
		value === null ||
		value === undefined ||
		value === '' ||
		typeof value === 'boolean'
	);
}

function setClassNameProperty(instance: Instance, className: string) {
	if (isEmpty(className)) return;
	instance.setAttribute('class', className);
}
