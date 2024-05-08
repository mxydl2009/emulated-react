import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiberNode';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';
import { reconcileChildFibers, mountChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';

/**
 * 构造fiberNode的children，返回子FiberNode
 * @wip 即传入的wip fiber
 * @return 返回第一个子节点
 */
export const beginWork = (wip: FiberNode) => {
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case FunctionComponent:
			return updateFunctionComponent(wip);
		case HostText:
			return null;
		default:
			if (__DEV__) {
				console.warn('beginWork未实现的类型', wip.tag);
			}
			break;
	}
	return null;
};

function updateFunctionComponent(wip: FiberNode) {
	const nextChildren = renderWithHooks(wip);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
// TODO:对于HostRoot，要根据baseState和updateQueue计算出新的state，再reconcile children
// ???为什么hostRoot要计算状态？
function updateHostRoot(wip: FiberNode) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<ReactElementType | null>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending);
	wip.memoizedState = memoizedState;
	const nextChildren = wip.memoizedState;

	reconcileChildren(wip, nextChildren);
	return wip.child;
}

/**
 * HostComponent只需要更新children，不需要计算状态
 * @param wip
 */
function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren as ReactElementType[]);
	return wip.child;
}

/**
 * 通过fiber的alternate(也就是老的fiber)与React Element进行对比，来生成新的fiber
 * @param wip
 * @param children
 */
function reconcileChildren(
	wip: FiberNode,
	children: ReactElementType[] | null
) {
	const current = wip.alternate;
	if (current !== null) {
		// update
		wip.child = reconcileChildFibers(wip, current, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
	return wip.child;
}
