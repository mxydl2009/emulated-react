import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes';
/*
 * 表示更新的数据结构，action代表更新的payload，payload可以是partialState，也可以是返回partialState的函数
 */
export interface Update<State> {
	action: Action<State>;
	next: Update<State>;
	lane: Lane;
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null
	};
};

export interface UpdateQueue<State> {
	shared: {
		// 存储新的更新
		pending: Update<State> | null;
	};
	// 存储触发更新的方法
	dispatch: Dispatch<State>;
}

export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

/**
 * 入队, pending指向最后入队的update元素，要形成一个环状链表
 * @param updateQueue 队列
 * @param update 更新
 */
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		update.next = update;
	} else {
		// pending.next指向的是第一个元素，而update需要插入到最后，所以这里将第一个元素赋值到update.next,
		// 这样update在入队后，update.next就会指向第一个元素, 这样保存了pending.next不至于丢掉;
		update.next = pending.next;
		// 保存了pending.next后，pending此时作为倒数第二个，需要用next指向update
		pending.next = update;
	}
	// 将update插入到最后
	updateQueue.shared.pending = update;
};

/**
 *
 * @param baseState 原始State
 * @param pendingUpdate 等待消费的更新，该参数是原pendingUpdate与baseQueue合并的结果
 * @returns 由原始State和消费更新产生的新State
 */
export const processUpdateQueue = <State>(
	baseState: State,
	// pendingUpdate是baseQueue与原pendingUpdate合并的结果
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	if (pendingUpdate === null) {
		return {
			memoizedState: baseState,
			baseState,
			baseQueue: null
		};
	}
	const result = {
		memoizedState: baseState,
		baseState,
		baseQueue: null
	};
	// pendingUpdate是baseQueue与pendingUpdate合并的结果
	const first = pendingUpdate.next;
	let pending = pendingUpdate.next;

	// 缓存baseState, baseQueue，在下面的计算中会更新
	let newBaseState = baseState;
	let newBaseQueueFirst: Update<State> | null = null;
	let newBaseQueueLast: Update<State> | null = null;
	// 计算新的state，初始为baseState
	let newState = baseState;
	// 遍历更新链表，将与renderLane一致优先级的更新逐次计算出新的state
	do {
		// 获取第一个更新对应的lane
		const updateLane = pending.lane;
		if (!isSubsetOfLanes(renderLane, updateLane)) {
			// 优先级不足（不属于本批次优先级），会被跳过，同时更新baseQueue
			const clonedUpdate = createUpdate(pending.action, pending.lane);
			if (newBaseQueueFirst === null) {
				newBaseQueueFirst = clonedUpdate;
				newBaseQueueLast = clonedUpdate;
				// newBaseQueueLast.next = newBaseQueueFirst;
				// 遇到第一个被跳过的update，那么需要将跳过之前的Update计算得到的newState赋值给newBaseState
				newBaseState = newState;
			} else {
				// 不是第一个被跳过的Update时，则只更新newBaseQueue
				newBaseQueueLast.next = clonedUpdate;
				newBaseQueueLast = clonedUpdate;
			}
		} else {
			// 属于本批次更新，计算新的state
			if (newBaseQueueLast !== null) {
				// 需要判断当前Update之前的Update有没有被跳过，有跳过则该Update要加入baseQueue, 并且是NoLane优先级
				// TODO: 为什么是NoLane优先级
				const clonedUpdate = createUpdate(pending.action, NoLane);
				newBaseQueueLast.next = clonedUpdate;
				newBaseQueueLast = clonedUpdate;
			}
			// 如果第一个更新的lane与当前渲染的lane一致，那就计算该更新
			const { action } = pending;
			if (action instanceof Function) {
				// result.memoizedState = action(baseState);
				newState = action(newState);
			} else {
				newState = action;
			}
		}
		// if (updateLane === renderLane) {
		// 	// 如果第一个更新的lane与当前渲染的lane一致，那就计算该更新
		// 	const { action } = pending;
		// 	if (action instanceof Function) {
		// 		// result.memoizedState = action(baseState);
		// 		baseState = action(baseState);
		// 	} else {
		// 		baseState = action;
		// 	}
		// } else {
		// 	if (__DEV__) {
		// 		console.error('暂时不该进入该分支');
		// 	}
		// }
		pending = pending.next;
	} while (pending !== first);
	if (newBaseQueueLast === null) {
		// 本次没有跳过的Update，那么newBaseState和newState一致,与memoizedState一样
		newBaseState = newState;
	} else {
		// 最后形成环状链表
		newBaseQueueLast.next = newBaseQueueFirst;
	}
	pending = null;
	// 最后计算得到的state返回
	result.memoizedState = newState;
	result.baseState = newBaseState;
	result.baseQueue = newBaseQueueLast;
	return result;
};
