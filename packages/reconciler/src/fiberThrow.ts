import { Weakable } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';
import { FiberRootNode } from './fiberNode';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';
import { getSuspenseHandler } from './suspenseContext';
import { ShouldCapture } from './fiberFlags';

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
	// Error Boundary

	// Thenable
	if (
		value !== null &&
		typeof value === 'object' &&
		typeof value.then === 'function'
	) {
		// value is Thenable type, 给value添加resolve回调, 触发新的更新
		const weakable: Weakable<any> = value;

		const suspenseBoundary = getSuspenseHandler();

		if (suspenseBoundary) {
			suspenseBoundary.flags |= ShouldCapture;
		}

		attachPingListener(root, weakable, lane);
	}
}

// 唤醒新的更新
export function ping() {}
export function attachPingListener(
	root: FiberRootNode,
	weakable: Weakable<any>,
	lane: Lane
) {
	// 处理weakable的缓存，相同的weakable只需要触发一次更新
	let pingCache = root.pingCache;

	let threadIDs: Set<Lane> | undefined = undefined;

	if (pingCache === null) {
		threadIDs = new Set();
		pingCache = root.pingCache = new WeakMap();
		pingCache.set(weakable, threadIDs);
	} else {
		threadIDs = pingCache.get(weakable);
		if (threadIDs === undefined) {
			threadIDs = new Set();
			pingCache.set(weakable, threadIDs);
		}
	}

	if (!threadIDs.has(lane)) {
		threadIDs.add(lane);
		function ping() {
			if (pingCache !== null) {
				pingCache.delete(weakable);
			}
			markRootUpdated(root, lane);
			ensureRootIsScheduled(root);
		}
		weakable.then(ping, ping);
	}
}
