import { Dispatch, Dispatcher } from 'react/src/currentDispatcher';
import { FiberNode } from './fiberNode';
import internals from 'shared/internals';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, requestUpdateLane } from './fiberLanes';
import { Passive, HookHasEffect } from './hookEffectTags';
import { Flags, PassiveEffect } from './fiberFlags';

// 记录当前正在渲染的fiber节点，用于在Hook执行中保存Hook的数据，在渲染完成后，需要重置为null，从而
// 继续记录下一个fiber节点的Hook数据
let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = null;

const currentDispatcher = internals.currentDispatcher;

type EffectCallback = () => void;
type EffectDeps = any[] | undefined | null;

export interface Hook {
	// Hook都有需要保存的数据
	memoizedState: any;
	// Hook可以触发更新，所以需要更新队列
	updateQueue: unknown;
	// 每个函数组件内的Hook是链表结构，用于保存下一个Hook，因此Hook的相对顺序不能更改（所以Hook不能用于逻辑分支里）
	next: Hook | null;
}

export interface Effect {
	// 区分是哪种类型的副作用: Passive | Layout
	tag: Flags;
	// 回调函数
	create: EffectCallback;
	destroy: EffectCallback | void;
	// 依赖数组
	deps: EffectDeps;
	next: Effect;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	currentlyRenderingFiber = wip;
	// 重置hooks链表
	wip.memoizedState = null;
	// 重置effects链表
	wip.updateQueue = null;
	workInProgressHook = null;
	currentHook = null;

	renderLane = lane;

	const current = wip.alternate;

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount, 所以当前hooks集合就应该是mount阶段定义的hooks
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const component = wip.type;
	const children = component(wip.pendingProps);
	// reset global variables
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = null;
	return children;
}

// 定义mount阶段的Hooks集合
const HooksDispatcherOnMount: Dispatcher = {
	// React会在mount阶段调用useState
	useState: mountState,
	useEffect: mountEffect
};

// 定义update阶段的Hooks集合
const HooksDispatcherOnUpdate: Dispatcher = {
	// React会在update阶段调用useState
	useState: updateState,
	useEffect: updateEffect
};

function mountState<State>(
	initialState: State | (() => State)
): [State, Dispatch<State>] {
	// 获取当前useState对应的Hook数据
	const hook = mountWorkInProgressHook();
	let memoizedState: State;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}
	// Hook可以触发更新，所以需要创建更新队列, 以便未来触发更新时，将更新数据添加到队列中
	const updateQueue = createUpdateQueue<State>();
	hook.updateQueue = updateQueue;
	hook.memoizedState = initialState;
	const dispatch = dispatchSetState.bind(
		null,
		currentlyRenderingFiber,
		updateQueue
	);
	updateQueue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

// 为函数组件生成更新队列，用于形成Effect环状链表
function createFCUpdateQueue<State>(): FCUpdateQueue<State> {
	const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}

/**
 * 创建一个effect数据对象，将其存储在当前fiber的updateQueue中形成环状链表, 并返回该Effect数据
 * @param hookFlags
 * @param create
 * @param destroy
 * @param deps
 * @param next
 */
function pushEffect(
	hookFlags: Flags,
	create: EffectCallback,
	destroy: EffectCallback | void,
	deps: EffectDeps
) {
	const effect: Effect = {
		tag: hookFlags,
		create,
		deps,
		destroy,
		next: null
	};
	const fiber = currentlyRenderingFiber;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

	if (updateQueue === null) {
		const initUpdateQueue = createFCUpdateQueue<any>();
		fiber.updateQueue = initUpdateQueue;
		effect.next = effect;
		initUpdateQueue.lastEffect = effect;
	} else {
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
		}
		updateQueue.lastEffect = effect;
	}

	return effect;
}

function mountEffect(create: EffectCallback, deps: EffectDeps) {
	// 获取useEffect对应的Hook
	const hook = mountWorkInProgressHook();
	// 解析依赖数组
	const nextDeps = deps === undefined ? null : deps;
	// 将当前fiber节点需要commit的flag置为有副作用
	currentlyRenderingFiber.flags |= PassiveEffect;
	// 将该useEffect的effect数据存储在fiber节点的updateQueue中形成环状链表, 然后effect也存储于memoizedState中
	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateState<State>(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	initialState: State | (() => State)
): [State, Dispatch<State>] {
	// 获取当前的Hook数据
	const hook = updateWorkInProgressHook();
	// 计算新的state
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	// TODO: 消费pending后，reset，事实上，pending中可能有不同优先级的更新，不能直接reset为null
	// 这里只处理了SyncLane这种简单的情形（或者说pending中的更新都是一个优先级）
	queue.shared.pending = null;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(
			hook.memoizedState,
			pending,
			renderLane
		);
		hook.memoizedState = memoizedState;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(nextDeps[i], prevDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}
function updateEffect(create: () => void, deps) {
	// 获取useEffect对应的Hook
	const hook = updateWorkInProgressHook();
	// 解析依赖数组
	const nextDeps = deps === undefined ? null : deps;
	let destroy: EffectCallback | void;

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect;
		destroy = prevEffect.destroy;

		if (nextDeps !== null) {
			// 浅比较依赖
			const prevDeps = prevEffect.deps;
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				// 依赖数据没变化，effect不该触发，所以这里只有Passive, 没有 Passive | HookHasEffect
				hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
				return;
			}
		}
		// 依赖数据有变化，或者依赖为null，那么将当前fiber节点需要commit的flag置为有副作用，并且当前effect有副作用
		currentlyRenderingFiber.flags |= PassiveEffect;
		// 将该useEffect的effect数据存储在fiber节点的updateQueue中形成环状链表
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destroy,
			nextDeps
		);
	}
}
/**
 * 创建更新，将更新入队，从当前fiber节点调度更新
 * @param fiber
 * @param updateQueue
 * @param action
 */
function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
): void {
	// 接入更新流程，与updateContainer类似
	// 获取此次更新的优先级, requestUpdateLane可以获取触发更新的上下文，根据不同上下文返回不同的优先级
	const lane = requestUpdateLane();
	const update = createUpdate<Action<State>>(action, lane);
	enqueueUpdate(updateQueue, update);
	// 从当前触发更新的fiber节点开始调度更新，逐层向上找到根节点，开始渲染fiber树进入更新流程
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	// mount时创建Hook
	const hook = {
		memoizedState: null,
		updateQueue: null,
		next: null
	};
	if (workInProgressHook === null) {
		// mount阶段第一个Hook
		if (currentlyRenderingFiber === null) {
			// 先检测hook的调用是否在函数内部
			throw new Error('请在函数组件中使用useState');
		}
		// fiberNode.memoizedState -> 第一个Hook -> 第二个hook -> ... -> 最后一个hook
		currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
	} else {
		// 非第一个Hook，需要构建链表
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return hook;
}

/**
 * 考虑交互触发的更新
 * 先找到当前fiber的currentHook，然后由currentHook的数据创建新的Hook链表
 * TODO: render阶段触发的更新未处理
 */
function updateWorkInProgressHook(): Hook {
	let nextCurrentHook: Hook | null = null;
	if (currentHook === null) {
		// update时的第一个hook
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			nextCurrentHook = current.memoizedState;
		} else {
			nextCurrentHook = null;
		}
	} else {
		// update时后续的Hook
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		// 说明Hook在update前后不一致
		throw new Error(`${currentlyRenderingFiber}组件的Hook比上次更新的Hook多`);
	}

	currentHook = nextCurrentHook as Hook;

	const newHook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null
	};

	if (workInProgressHook === null) {
		// mount阶段第一个Hook
		if (currentlyRenderingFiber === null) {
			// 先检测hook的调用是否在函数内部
			throw new Error('请在函数组件中使用useState');
		}
		// fiberNode.memoizedState -> 第一个Hook -> 第二个hook -> ... -> 最后一个hook
		currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
	} else {
		// 非第一个Hook，需要构建链表
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook;
}
