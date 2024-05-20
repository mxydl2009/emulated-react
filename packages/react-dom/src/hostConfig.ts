import { FiberNode } from 'reconciler/src/fiberNode';
import { HostComponent, HostText } from 'reconciler/src/workTag';
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
		case HostComponent:
			{
				updateProperties(
					fiber.stateNode,
					fiber.updateQueue as any[]
					// fiber.alternate.memoizedProps,
					// fiber.memoizedProps
				);
			}
			break;

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
		} else if (/^on[A-Z]/.test(propKey)) {
			// 事件类型的prop也不需要给DOM元素添加
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

// 更新阶段，计算props的差异返回updatePayload
export function prepareUpdate(
	instance: Instance,
	type: string,
	oldProps: Props,
	newProps: Props
) {
	return diffProperties(instance, type, oldProps, newProps);
}

// 计算props的差异并返回
// lastProps中的值都不为空
function diffProperties(
	instance: Instance,
	tag: string,
	lastProps: Props,
	nextProps: Props
): any[] {
	const updatePayload = [];

	// 先对lastProps进行遍历，找到需要删除的prop(lastProps中存在，nextProps中不存在), 记录该prop对应的值为''
	// lastProps和nextProps都有，则比较对应的prop，不一致时，记录该prop对应的值nextProps[prop]
	for (const propKey in lastProps) {
		if (Object.prototype.hasOwnProperty.call(lastProps, propKey)) {
			if (
				!Object.prototype.hasOwnProperty.call(nextProps, propKey) ||
				nextProps[propKey] === ''
			) {
				// 如果nextProps中不存在该propKey, 或者nextProps中该propKey的值为空, 则记录该propKey的值为空
				updatePayload.push(propKey, '');
			} else if (Object.prototype.hasOwnProperty.call(nextProps, propKey)) {
				if (lastProps[propKey] === nextProps[propKey]) {
					continue;
				}
				// 说明nextProps中存在该propKey并且不为''，需要找到前后的差异
				if (propKey === 'style') {
					// 因为style是只读的，不能给style赋值，必须通过style[prop] = value的方式更新，所以必须diff style
					diffStyleProperty(
						lastProps['style'],
						nextProps['style'],
						updatePayload
					);
					// updatePayload.push('style', nextProps['style']);
				} else if (propKey === 'children') {
					continue;
				} else {
					updatePayload.push(propKey, nextProps[propKey]);
				}
			}
		}
	}

	// 再对nextProps进行遍历，找到需要新增的prop(lastProps中不存在，nextProps中存在), 记录该prop对应的值为nextProp[prop]
	for (const propKey in nextProps) {
		if (
			Object.prototype.hasOwnProperty.call(nextProps, propKey) &&
			nextProps[propKey] !== '' &&
			!Object.prototype.hasOwnProperty.call(lastProps, propKey) &&
			!/^on[A-Z]/.test(propKey)
		) {
			// nextProps中存在，且不为事件类型，不为空，lastProps中不存在
			updatePayload.push(propKey, nextProps[propKey]);
		}
	}

	return updatePayload;
}

function diffStyleProperty(
	oldStyles: CSSStyleDeclaration,
	newStyles: CSSStyleDeclaration,
	updatePayload: any[]
) {
	const styles = {};
	if (oldStyles === newStyles) return;
	for (const style in oldStyles) {
		if (
			!Object.prototype.hasOwnProperty.call(newStyles, style) &&
			Object.prototype.hasOwnProperty.call(oldStyles, style)
		) {
			// oldStyle中存在，newStyle中不存在, 标记为删除
			// updatePayload.push(style, '');
			styles[style] = '';
		} else if (
			Object.prototype.hasOwnProperty.call(newStyles, style) &&
			Object.prototype.hasOwnProperty.call(oldStyles, style)
		) {
			// 新旧都存在
			const oldStyle = oldStyles[style];
			const newStyle = newStyles[style];
			if (oldStyle !== newStyle) {
				// oldStyle和newStyle不相等，标记为新值
				// updatePayload.push(style, newStyle);
				styles[style] = newStyle;
			}
		}
	}

	for (const style in newStyles) {
		if (
			Object.prototype.hasOwnProperty.call(newStyles, style) &&
			!Object.prototype.hasOwnProperty.call(oldStyles, style)
		) {
			// newStyle中存在，oldStyle中不存在，标记为新值
			// updatePayload.push(style, newStyles[style]);
			styles[style] = newStyles[style];
		}
	}

	updatePayload.push('style', styles);
}

function updateProperties(instance: Instance, updatePayload: any[]) {
	for (let i = 0; i < updatePayload.length; i += 2) {
		const propKey = updatePayload[i];
		const propValue = updatePayload[i + 1];
		if (propKey === 'style') {
			// 处理style
			const style = instance.style;
			for (const styleKey in propValue) {
				if (!Object.prototype.hasOwnProperty.call(propValue, styleKey)) {
					if (__DEV__) {
						console.warn('未知的style样式属性', styleKey);
					}
					continue;
				}
				style[styleKey] = ('' + propValue[styleKey]).trim();
			}
		} else if (propKey === 'className') {
			// className
			instance.className = propValue;
		} else {
			instance[propKey] = propValue;
		}
	}
}
