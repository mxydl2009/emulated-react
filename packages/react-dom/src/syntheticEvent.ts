import { ContainerType } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

// 保存组件的props
export const elementPropsKey = '__component_props__';

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

export interface SyntheticEvent extends Event {
	__stopPropagation: boolean;
	stopPropagation: () => void;
}

type eventCallback = (event: SyntheticEvent) => void;

export interface Paths {
	capture: Array<Element>;
	bubble: Array<Element>;
}

const validEventList = ['click'];

/**
 * 将组件的props保存到DOM元素上
 * @param node
 * @param props
 */
export function updateFiberPropsToInstance(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

/**
 * 初始化事件系统
 * 1. 在container中添加事件监听，container作为代理，然后分发事件
 */
export function initEvent(container: ContainerType, eventType: string) {
	if (!validEventList.includes(eventType)) {
		console.warn('不支持的事件类型', eventType);
		return;
	}
	if (__DEV__) {
		console.warn('初始化事件系统', eventType);
	}
	container.addEventListener(eventType, function (event) {
		dispatchEvent(container, eventType, event);
	});
}

/**
 * 1. 收集事件的目标对象与container之间的所有节点上的事件，捕获类型和冒泡类型分别存储
 * 2. 遍历收集的事件，模拟捕获和冒泡阶段的顺序
 * @param container
 * @param eventType
 * @param event
 */
export function dispatchEvent(
	container: ContainerType,
	eventType: string,
	event: Event
) {
	const target = event.target;
	if (target === null) {
		console.warn(`${eventType}不存在`);
		return;
	}
	// 按捕获和冒泡的顺序收集事件
	const paths = collectPaths(container, target, eventType);
	const se = createSyntheticEvent(event);
	triggerEventFlow(paths.capture, se);
	if (!se.__stopPropagation) {
		triggerEventFlow(paths.bubble, se);
	}
}

export function collectPaths(container, target, eventType) {
	const paths = {
		capture: [],
		bubble: []
	};
	while (target && target !== container) {
		const elementProps = target[elementPropsKey];
		if (elementProps) {
			const eventCallbackList = getEventCallbackNameFromEventType(eventType);
			if (eventCallbackList) {
				eventCallbackList.forEach((callbackName, index) => {
					if (elementProps[callbackName]) {
						if (index === 0) {
							paths.capture.unshift(elementProps[callbackName]);
						} else {
							paths.bubble.push(elementProps[callbackName]);
						}
					}
				});
			}
		}
		target = target.parentNode;
	}
	return paths;
}

export function getEventCallbackNameFromEventType(
	eventType: string
): string[] | undefined {
	return {
		click: ['onClickCapture', 'onClick']
	}[eventType];
}

export function createSyntheticEvent(event: Event) {
	const syntheticEvent = event as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originalStopPropagation = event.stopPropagation;
	syntheticEvent.stopPropagation = function (...args) {
		syntheticEvent.__stopPropagation = true;
		originalStopPropagation.apply(this, args);
	};
	return syntheticEvent;
}

export function triggerEventFlow(eventCallbacks: eventCallback[], se) {
	for (let i = 0; i < eventCallbacks.length; i++) {
		const callback = eventCallbacks[i];
		callback.call(null, se);
		if (se.__stopPropagation) {
			break;
		}
	}
}
