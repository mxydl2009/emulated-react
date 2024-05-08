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

// 记录当前正在渲染的fiber节点，用于在Hook执行中保存Hook的数据，在渲染完成后，需要重置为null，从而
// 继续记录下一个fiber节点的Hook数据
let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

const currentDispatcher = internals.currentDispatcher;

export interface Hook {
	// Hook都有需要保存的数据
	memoizedState: any;
	// Hook可以触发更新，所以需要更新队列
	updateQueue: unknown;
	// 每个函数组件内的Hook是链表结构，用于保存下一个Hook，因此Hook的相对顺序不能更改（所以Hook不能用于逻辑分支里）
	next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
	currentlyRenderingFiber = wip;
	workInProgressHook = null;

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
	currentlyRenderingFiber = null;
	return children;
}

// 定义mount阶段的Hooks集合
const HooksDispatcherOnMount: Dispatcher = {
	// React会在mount阶段调用useState
	useState: mountState
};

// 定义update阶段的Hooks集合
const HooksDispatcherOnUpdate: Dispatcher = {
	// React会在update阶段调用useState
	useState: updateState
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

function updateState<State>(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	initialState: State | (() => State)
): [State, Dispatch<State>] {
	// 获取当前的Hook数据
	const hook = updateWorkInProgressHook();
	// 计算新的state
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	if (pending !== null) {
		const { memoizedState } = processUpdateQueue(hook.memoizedState, pending);
		hook.memoizedState = memoizedState;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
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
	const update = createUpdate<Action<State>>(action);
	enqueueUpdate(updateQueue, update);
	// 从当前触发更新的fiber节点开始调度更新，逐层向上找到根节点，开始渲染fiber树进入更新流程
	scheduleUpdateOnFiber(fiber);
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
