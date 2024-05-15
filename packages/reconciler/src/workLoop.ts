import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitLayoutEffects,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiberNode';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTag';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	// shouldYield方法获取时间切片是否还有剩余时间，没有剩余时间返回true，有剩余时间返回false
	unstable_shouldYield as shouldYield,
	unstable_cancelCallback as cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

// 存储工作的fiber, 当中断当前工作之后再恢复执行时, 就从workInProgress开始恢复
let workInProgress: FiberNode | null = null;

// 本次更新的Lane
let wipRootRenderLane: Lane = NoLane;

let rootDoesHasPassiveEffects = false;

type RootExistStatus = number;

// 标识当前工作是否完成
const RootInComplete: RootExistStatus = 1;
const RootCompleted: RootExistStatus = 2;

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

/**
 * 每次产生更新，都会先记录更新到root上，然后调用ensureRootIsScheduled来调度渲染
 * @param root
 * @returns
 */
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const existingCallback = root.callbackNode;

	if (updateLane === NoLane) {
		// 没有更新需要调度了
		if (existingCallback !== null) {
			// 如果还有任务需要调度，取消掉
			cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}

	const currentPriority = updateLane;
	const prevPriority = root.callbackPriority;

	if (currentPriority === prevPriority) return;

	// 有更高优先级的更新需要调度，取消掉现有的需要调度的更新任务
	if (existingCallback !== null) {
		cancelCallback(existingCallback);
	}

	let newCallbackNode = null;

	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度，意味着在浏览器重绘之前要执行完
		if (__DEV__) {
			console.log('微任务中调度优先级', updateLane);
		}
		// 将同步更新入口函数作为调度的回调函数入队
		// 多次触发更新，则scheduleSyncCallback会入队多次更新任务，都会放在syncQueue中由下面调度的微任务一次性执行
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		// 将调度的任务在微任务中同步执行，尽管可能有多个更新回调任务，但因为有isFlushingSync的标志位，只会一次性执行完成
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级，宏任务调度
		if (__DEV__) {
			console.log('宏任务中调度优先级', updateLane);
		}
		// 转换当前的优先级为调度优先级
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		// 以当前优先级concurrent模式调度renderRoot的方法
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callbackNode = newCallbackNode;
	root.callbackPriority = currentPriority;
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
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	wipRootRenderLane = lane;
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
function performSyncWorkOnRoot(root: FiberRootNode) {
	// 第二次执行时，由于上一次的Lane已经被移除，再次获取时就不会是上一个Lane
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		ensureRootIsScheduled(root);
		return;
	}
	// 初始化
	// prepareFreshStack(root, nextLane);

	// do {
	// 	try {
	// 		workLoopSync();
	// 		break;
	// 	} catch (e) {
	// 		if (__DEV__) {
	// 			console.warn('workLoop发生错误', e);
	// 		}
	// 		workInProgress = null;
	// 	}
	// } while (true);

	const exitStatus = renderRoot(root, nextLane, false);

	if (exitStatus === RootCompleted) {
		// 完成后执行的工作
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		// 本次更新要消费的lane存储
		root.finishedLane = nextLane;

		wipRootRenderLane = NoLane;

		// 根据新的workInProgress树和副作用，执行DOM操作
		commitRoot(root);
	} else {
		// 同步更新未完成，这种情况不应该出现, 除非是出错了
		if (__DEV__) {
			console.error('performSyncWorkOnRoot未完成', exitStatus);
		}
	}
}

// 并发更新的入口方法，可以中断
function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean) {
	const currentCallback = root.callbackNode;
	// 在浏览器重绘重排后，执行effect，保证useEffect的回调被执行，因为可能会产生更高优先级的任务
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
	if (didFlushPassiveEffect) {
		if (currentCallback !== root.callbackNode) {
			return null;
		}
	}
	const lane = getHighestPriorityLane(root.pendingLanes);
	const currentCallbackNode = root.callbackNode;
	if (lane === NoLane) return null;
	// 是否需要同步更新
	const needSync = lane === SyncLane || didTimeout;

	const exitStatus = renderRoot(root, lane, !needSync);

	// 重新开启调度下一次render过程，同时更改了root.callbackNode，render过程将会在下一个时间切片执行
	ensureRootIsScheduled(root);

	// 渲染未完成跳出时（还在本轮时间切片，检查一下后返回，将主线程执行权交给浏览器），总是需要检查一下是否有更高优先级的任务，还是继续上一次的任务
	if (exitStatus === RootInComplete) {
		// 未完成， 中断了
		if (root.callbackNode !== currentCallbackNode) {
			// 说明已经调度了更高优先级的任务，本次渲染任务应该停止
			return null;
		}
		return performConcurrentWorkOnRoot.bind(null, root);
	}

	if (exitStatus === RootCompleted) {
		// 完成
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		// 本次更新要消费的lane存储
		root.finishedLane = lane;

		wipRootRenderLane = NoLane;

		// 根据新的workInProgress树和副作用，执行DOM操作
		commitRoot(root);
	} else {
		console.error('未实现的同步更新结束状态', exitStatus);
	}
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(
			`renderRoot begin render, ${shouldTimeSlice ? '并发' : '同步'}更新`
		);
	}
	// 如果之前的更新渲染被中断，本次渲染是新的更新造成的渲染，那么需要重新初始化
	// 如果仍然是之前的更新渲染，那么不需要重新初始化
	if (wipRootRenderLane !== lane) {
		// 如果当前的更新与现在将要render的更新不一致，说明不是一个更新（不是之前render中断），需要初始化
		prepareFreshStack(root, lane);
	}

	// workLoop如果出错，就会将workInProgress置为null，下一次循环时，由于wip为null, workLoop什么都不做，while循环break掉
	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	// 中断了
	if (shouldTimeSlice && workInProgress !== null) {
		if (__DEV__) {
			console.log(
				`中断执行, shouldTimeSlice is ${shouldTimeSlice}, lane is ${lane}`
			);
		}
		// 开启时间切片时，如果wip不为null，则说明没有完成
		return RootInComplete;
	}

	// 没有开启时间切片还未完成，说明有问题
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(`render阶段结束时wip不应该为null`, workInProgress);
	}

	// TODO: workLoop报错的情况，暂未处理

	// 不管是否开启了时间切片，逻辑到这里就是完成了(workInProgress === null)
	return RootCompleted;
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
	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('不应该是NoLane');
	}
	// 获取到finishedWork后重置
	root.finishedWork = null;

	root.finishedLane = NoLane;

	// 移除已消费的lane
	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		// 需要执行effect副作用
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;
			// 调度effect副作用
			scheduleCallback(NormalPriority, () => {
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}
	// 判断三个子阶段是否需要各自的操作

	const subtreeHasEffects =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffects = finishedWork.flags & MutationMask;
	if (subtreeHasEffects || rootHasEffects) {
		// 有副作用，需要进行副作用操作
		// beforeMutation

		// mutation
		commitMutationEffects(finishedWork, root);
		root.current = finishedWork;
		// layout
		commitLayoutEffects(finishedWork, root);
	} else {
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;
	// TODO: 为什么又重新调度
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false;
	// 执行卸载组件的destroy
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	// 执行更新组件的destroy
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});
	// 执行更新组件的create
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update = [];

	flushSyncCallbacks();
	return didFlushPassiveEffect;
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && !shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode | null) {
	const next: FiberNode | null = beginWork(fiber, wipRootRenderLane);
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
