import {
	Instance,
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiberNode';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';
import { NoFlags, Update } from './fiberFlags';

/**
 * 将子节点的实例挂载到父实例上
 */
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case FunctionComponent:
			bubbleProperties(wip);
			return null;
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
			} else {
				// mount
				const instance = createInstance(wip.type, newProps);
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
				bubbleProperties(wip);
			}
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				// mount
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
				bubbleProperties(wip);
			}
			return null;
		case HostRoot:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('completeWork未实现的类型', wip.tag);
			}
			break;
	}
};

/**
 * 把所有子节点实例都挂载到父实例上，包括组件类型的节点，要把组件类型节点的子节点挂载到组件的父节点上
 * @param parent
 * @param wip
 */
function appendAllChildren(parent: Instance, wip: FiberNode) {
	let node = wip.child;
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			// 针对的是组件类型的情况，当node是组件时，要把组件的child实例挂载到parent实例上.
			node.child.return = node;
			node = node.child;
			continue;
		}
		// 当node是当前父节点时，返回(node会在处理完子节点和兄弟节点后，返回到父节点上，所以需要判断是否父节点)
		if (node === wip) return;
		// 这里必须用while循环来判断是否是最后一个兄弟节点，因为涉及到组件节点嵌套
		while (node.sibling === null) {
			if (node === null || node === wip) {
				return;
			}
			// 最后一个兄弟节点，要向上归了
			node = node?.return;
		}
		// 不是最后一个兄弟节点，那么就把node赋值为兄弟节点，继续循环
		node.sibling.return = node.return;
		node = node.sibling;
	}
	return null;
}

/**
 * 副作用冒泡，收集子节点的副作用，然后把副作用挂载到父节点上，这样方便获悉子树有没有副作用
 * 这是一种优化策略，没有副作用就不必再理会，有副作用的时候再遍历找到副作用的fiber节点
 * @param wip
 */
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	let child = wip.child;
	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}
	wip.subtreeFlags |= subtreeFlags;
}

/**
 * 标记更新flag
 * @param wip
 */
function markUpdate(wip: FiberNode) {
	wip.flags |= Update;
}
