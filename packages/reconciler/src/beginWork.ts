import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiberNode';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	Fragment,
	ContextProvider
} from './workTag';
import { reconcileChildFibers, mountChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { Ref } from './fiberFlags';
import { pushProvider } from './fiberContext';

/**
 * 构造fiberNode的children，返回子FiberNode
 * @wip 即传入的wip fiber
 * @return 返回第一个子节点
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
	switch (wip.tag) {
		case HostRoot:
			// renderLane要传给可以触发更新的组件
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case FunctionComponent:
			// renderLane要传给可以触发更新的组件
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		case ContextProvider:
			return updateContextProvider(wip);
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

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	const nextChildren = renderWithHooks(wip, renderLane);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
// TODO:对于HostRoot，要根据baseState和updateQueue计算出新的state，再reconcile children
// ???为什么hostRoot要计算状态？
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<ReactElementType | null>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
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
	markRef(wip.alternate, wip);
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
	children: ReactElementType | ReactElementType[] | null
) {
	const current = wip.alternate;
	if (current !== null) {
		// update, 首屏渲染(mount)时只有hostRoot会走该分支,
		// 因为createWorkInProgress创建了hostRootFiber的alternate
		// 因此, hostRoot的子节点（也就是App根组件节点）会触发收集副作用的逻辑，从而将离屏DOM挂载到DOM树上
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
	return wip.child;
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateContextProvider(wip: FiberNode) {
	const providerType = wip.type;
	const context = providerType._context;
	const newProps = wip.pendingProps;
	pushProvider(context, newProps.value);
	reconcileChildren(wip, newProps.children);
	return wip.child;
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref;
	// 在mount且ref存在的时候，需要标记ref
	// 在update且ref变更时，需要标记ref
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}
