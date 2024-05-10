import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { MutationMask, NoFlags } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	mergeLanes
} from './fiberLanes';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiberNode';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTag';

// 存储工作的fiber
let workInProgress: FiberNode | null = null;

/**
 * 由产生更新的fiber找到hostRootFiber，因为每次更新渲染都从顶层的fiber开始构建fiber树
 * @param fiber 当前需要调用更新的fiber，或者说是产生更新的fiber
 */
function markUpdateFromFiberToRoot(fiber: FiberNode): FiberRootNode | null {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

/**
 * 记录本次要消费的Lane到FiberRootNode上
 * @param root FiberRootNode
 * @param lane
 */
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	if (updateLane === NoLane) {
		return;
	}
	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度，意味着在浏览器重绘之前要执行完
		if (__DEV__) {
			console.log('微任务中调度优先级', updateLane);
		}
		// 将同步更新入口函数作为调度的回调函数入队
		// 多次触发更新，则scheduleSyncCallback会调度多次更新任务，都会放在syncQueue中由微任务一次性执行
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		// 将调度的任务在微任务中同步执行，尽管可能有多个更新回调任务，但因为有isFlushingSync的标志位，只会一次性执行完成
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级，宏任务调度
	}
}
/**
 * 将产生的更新进行调度，开启新的渲染
 * @param fiber 当前需要调用更新的fiber，或者说是产生更新的fiber
 * @param lane 当前要消费的lane
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	const root = markUpdateFromFiberToRoot(fiber);
	// 记录lane到FiberRootNode上
	markRootUpdated(root, lane);
	// 开始render阶段
	// renderRoot(root);
	ensureRootIsScheduled(root);
	// 通过requestIdleCallback执行更新
	// requestIdleCallback(renderRoot);
}
/**
 * 初始化开始构建的节点
 * @param root FiberRoot
 */
function prepareFreshStack(root: FiberRootNode) {
	// createWorkInProgress方法根据初始的rootFiber创建workInProgress的rootFiber，当新的rootFiber
	// 创建完成后，root.current将指向新的rootFiber，原来的rootFiber会被垃圾回收
	workInProgress = createWorkInProgress(root.current, {});
}
/**
 * 同步更新的入口方法
 * performSyncWorkOnRoot方法由触发更新的方法调用，不管是mount还是update，都统一抽象为update流程
 * 只是根据mount还是update而有差别
 * @param root FiberRoot节点
 */
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	console.log(lane);

	// 初始化
	prepareFreshStack(root);

	do {
		try {
			workLoop();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	// 根据新的workInProgress树和副作用，执行DOM操作
	commitRoot(root);
}

/**
 * commit阶段的入口方法，执行具体的DOM操作
 * beforeMutation、Mutation、layout三个阶段
 * @param root
 */
function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}
	if (__DEV__) {
		console.log('commitRoot', finishedWork);
	}
	// 获取到finishedWork后重置
	root.finishedWork = null;
	// 判断三个子阶段是否需要各自的操作

	const subtreeHasEffects =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffects = finishedWork.flags & MutationMask;
	if (subtreeHasEffects || rootHasEffects) {
		// 有副作用，需要进行副作用操作
		// beforeMutation

		// mutation
		commitMutationEffects(finishedWork);
		root.current = finishedWork;
		// layout
	} else {
		root.current = finishedWork;
	}
}

function workLoop() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode | null) {
	const next: FiberNode | null = beginWork(fiber);
	// 当前fiber执行完毕，将pendingProps缓存到memoizedProps;
	fiber.memoizedProps = fiber.pendingProps;
	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

/**
 * 完成子节点实例挂载到父节点实例上
 * 更新workInProgress
 * @param fiber
 * @returns
 */
function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	do {
		completeWork(node);
		const sibling = node.sibling;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
