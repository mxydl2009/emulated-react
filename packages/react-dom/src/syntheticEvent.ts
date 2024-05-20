import { ContainerType } from 'hostConfig';
import { Props } from 'shared/ReactTypes';
import {
	// unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_runWithPriority as runWithPriority
} from 'scheduler';

// 保存组件的props
export const elementPropsKey = '__component_props__';

export interface DOMElement extends HTMLElement {
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

export const validEventList = ['click', 'dblclick'];

/**
 * 将fiber的props保存到DOM元素上
 * 需要对className style 特殊处理
 * @param node
 * @param props
 */
export function updateFiberPropsToInstance(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

/**
 * 真实的React监听了两次，一次监听capture事件流，一次监听bubble事件流
 * React在触发两次dispatchEvent，第一次是capture事件流，第二次是bubble事件流
 * 在dispatchEvent时，根据事件流的类型（capture或者bubble），从事件目标对象开始逐级向上找到各级的祖先fiber
 * 从祖先fiber对象的stateNode[internalPropsKey]中获取到props，根据事件流类型，获取props中事件名称对应的处理函数
 * 将事件处理函数加入到队列，然后刷新队列
 *
 * 初始化事件系统
 * 1. 在container中添加事件监听，container作为代理，然后分发事件
 *
 */
export function initEvent(container: ContainerType, eventType: string) {
	if (!validEventList.includes(eventType)) {
		console.warn('不支持的事件类型', eventType);
		return;
	}
	if (__DEV__) {
		console.log('初始化事件系统', eventType);
	}
	container.addEventListener(eventType, function (event) {
		dispatchEvent(container, eventType, event);
	});
}

export function initEvents(container: ContainerType, events: string[]) {
	events.forEach((event) => initEvent(container, event));
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

//
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
		click: ['onClickCapture', 'onClick'],
		dblclick: ['onDoubleClickCapture', 'onDoubleClick']
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

// 触发更新的回调函数用指定优先级调度
export function triggerEventFlow(eventCallbacks: eventCallback[], se) {
	for (let i = 0; i < eventCallbacks.length; i++) {
		const callback = eventCallbacks[i];
		const priority = eventTypeToSchedulerPriority(se.type);
		// 触发更新的回调函数用指定优先级调度
		runWithPriority(priority, callback.bind(null, se));
		// callback.call(null, se);
		if (se.__stopPropagation) {
			break;
		}
	}
}

// 根据事件类型确定调度器内部需要的优先级，实际上意味着产生更新的上下文（事件）对应着不同的优先级
export function eventTypeToSchedulerPriority(eventType: string) {
	switch (eventType) {
		// case 'click':
		// case 'keydown':
		// case 'keyup':
		// 	return ImmediatePriority;
		case 'scroll':
			// case 'click':
			return UserBlockingPriority;
		case 'click':
			return NormalPriority;
		case 'dblclick':
			return UserBlockingPriority;
		default:
			return NormalPriority;
	}
}
