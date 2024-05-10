let syncQueue: ((...args: any) => void)[] | null = null;
let isFlushingSyncQueue = false;

/**
 * 回调函数入队
 * @param callback
 */
export function scheduleSyncCallback(callback: (...args: any) => void) {
	if (syncQueue === null) {
		syncQueue = [callback];
	} else {
		syncQueue.push(callback);
	}
}

/**
 * 同步形式执行队列所有回调函数
 */
export function flushSyncCallbacks() {
	if (!isFlushingSyncQueue && syncQueue !== null) {
		isFlushingSyncQueue = true;
		try {
			syncQueue.forEach((cb) => cb());
		} catch (e) {
			if (__DEV__) {
				console.error('flushSyncCallbacks报错', e);
			}
		} finally {
			isFlushingSyncQueue = false;
		}
	}
}