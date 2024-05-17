import { ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	OffscreenProps,
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProgress
} from './fiberNode';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	Fragment,
	ContextProvider,
	SuspenseComponent,
	OffscreenComponent
} from './workTag';
import { reconcileChildFibers, mountChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import {
	ChildDeletion,
	DidCapture,
	NoFlags,
	Placement,
	Ref
} from './fiberFlags';
import { pushProvider } from './fiberContext';
import { pushSuspenseHandler } from './suspenseContext';

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
		case SuspenseComponent:
			return updateSuspenseComponent(wip);
		case OffscreenComponent:
			return updateOffscreenComponent(wip);
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
	// functionComponent通过渲染函数获得子节点
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

function updateOffscreenComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateSuspenseComponent(wip: FiberNode) {
	const current = wip.alternate;
	const nextProps = wip.pendingProps;

	let showFallback = false;

	// 未挂起时disSuspense为false，挂起后经过unwind阶段，然后继续构建Suspense时，didSuspense为true
	const didSuspense = (wip.flags & DidCapture) !== NoFlags;

	if (didSuspense) {
		showFallback = true;
		// 去除DidCapture标识
		wip.flags &= ~DidCapture;
	}

	const nextPrimaryChildren = nextProps.children;
	const nextFallbackChildren = nextProps.fallback;

	pushSuspenseHandler(wip);

	if (current === null) {
		// mount
		if (showFallback) {
			// 挂起
			return mountSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 非挂起
			return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		// update
		if (showFallback) {
			// 挂起
			return updateSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 非挂起
			return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	}
}

// 挂载时，应该先走非挂起的流程，非挂起流程报错后，再走挂起流程，此时要显示fallback的情况，Offscreen节点和Fragment节点都要创建
function mountSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	// 创建离屏的节点，承载primaryChildren
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};
	// 创建离屏的节点，承载primaryChildren
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	// 创建fallback的容器Fragment
	const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

	// TODO:个人感觉似乎没必要给fallback添加挂载副作用吧，mount时挂载都是appendChildren来进行
	fallbackChildFragment.flags |= Placement;

	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}
// 挂载时，走非挂起的流程
function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	// 创建离屏的节点，承载primaryChildren
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};
	// 创建离屏的节点，承载primaryChildren，不需要创建fallback，因为未必需要用到fallback
	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	primaryChildFragment.return = wip;
	wip.child = primaryChildFragment;
	return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const current = wip.alternate;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null = current.child.sibling;
	// 创建离屏的节点，承载primaryChildren
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};
	// 创建离屏的节点，承载primaryChildren
	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);
	let fallbackChildFragment = null;
	// 创建fallback的容器Fragment
	if (currentFallbackChildFragment === null) {
		fallbackChildFragment = createWorkInProgress(
			currentFallbackChildFragment,
			fallbackChildren
		);
	} else {
		fallbackChildFragment = createFiberFromFragment(
			fallbackChildren,
			fallbackChildren
		);
		// TODO:个人感觉似乎没必要给fallback添加挂载副作用吧，mount时挂载都是appendChildren来进行
		fallbackChildFragment.flags |= Placement;
	}

	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}
// 更新时，走非挂起的流程
function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	// 创建离屏的节点，承载primaryChildren
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};
	const current = wip.alternate;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment = current.child.sibling;
	// 创建离屏的节点，承载primaryChildren，不需要创建fallback，因为未必需要用到fallback
	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = null;
	wip.child = primaryChildFragment;

	if (currentFallbackChildFragment !== null) {
		const deletions = wip.deletions;
		if (deletions === null) {
			wip.deletions = [currentFallbackChildFragment];
			wip.flags |= ChildDeletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}
	return primaryChildFragment;
}
