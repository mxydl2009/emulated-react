import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
/*
 * 表示更新的数据结构，action代表更新的payload，payload可以是partialState，也可以是返回partialState的函数
 */
export interface Update<State> {
	action: Action<State>;
	next: Update<State>;
}

export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return {
		action,
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
	pendingUpdate: Update<State> | null
): { memoizedState: State } => {
	if (pendingUpdate === null) {
		return {
			memoizedState: baseState
		};
	}
	const result = {
		memoizedState: baseState
	};
	const { action } = pendingUpdate;
	if (action instanceof Function) {
		result.memoizedState = action(baseState);
	} else {
		result.memoizedState = action;
	}
	return result;
};
