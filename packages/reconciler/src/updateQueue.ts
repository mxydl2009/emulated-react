import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';
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
 * @param pendingUpdate 等待消费的更新
 * @returns 由原始State和消费更新产生的新State
 */
export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): { memoizedState: State } => {
	if (pendingUpdate === null) {
		return {
			memoizedState: baseState
		};
	}
	const result = {
		memoizedState: baseState
	};
	const first = pendingUpdate.next;
	let pending = pendingUpdate.next;
	// 遍历更新链表，将与renderLane一致优先级的更新逐次计算出新的state
	do {
		// 获取第一个更新对应的lane
		const updateLane = pending.lane;
		if (updateLane === renderLane) {
			// 如果第一个更新的lane与当前渲染的lane一致，那就计算该更新
			const { action } = pending;
			if (action instanceof Function) {
				// result.memoizedState = action(baseState);
				baseState = action(baseState);
			} else {
				baseState = action;
			}
		} else {
			if (__DEV__) {
				console.error('暂时不该进入该分支');
			}
		}
		pending = pending.next;
	} while (pending !== first);
	pending = null;
	// let current = pendingUpdate;
	// do {
	// 	// 移除已消费的lane对应的update
	// 	if (current.next.lane === renderLane) {
	// 		// 移除pending对应的update
	// 		current.next = current.next.next;
	// 	} else {
	// 		current = current.next;
	// 	}
	// } while (current.next !== first);
	// current = null;
	// 最后计算得到的state返回
	result.memoizedState = baseState;
	return result;
};
