import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
/*
 * 表示更新的数据结构，action代表更新的payload，payload可以是partialState，也可以是返回partialState的函数
 */
export interface Update<State> {
	action: Action<State>;
}

export const createUpdate = <State>(action: Action<State>): Update<State> => {
	return {
		action
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
 * 入队
 * @param updateQueue 队列
 * @param update 更新
 */
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
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
