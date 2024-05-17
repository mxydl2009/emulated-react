import { Weakable } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';
import { FiberRootNode } from './fiberNode';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';
import { getSuspenseHandler } from './suspenseContext';
import { ShouldCapture } from './fiberFlags';

// 在render时发生了错误，本帧或者下一帧继续workLoop时会调用throwException
/**
 *
 * @param root
 * @param value 引发挂起的thenable
 * @param lane 触发挂起的更新lane
 */
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

		// 获取最近的Suspense组件（边界）
		const suspenseBoundary = getSuspenseHandler();

		if (suspenseBoundary) {
			// 如果找到了Suspense，为该节点添加ShouldCapture副作用标识
			// 这是为了在unwind向上查找Suspense时，可以找到离触发挂起最近的Suspense，从这个Suspense重新构建挂起时的fallback节点
			suspenseBoundary.flags |= ShouldCapture;
		}

		// 为weakable添加唤醒更新：weakable一旦有了异步响应（resolve或者reject），触发更新
		attachPingListener(root, weakable, lane);
	}
}

// 唤醒新的更新
// export function ping() {}
/**
 *
 * @param root
 * @param weakable 引发挂起的thenbale
 * @param lane 引发挂起的lane
 */
export function attachPingListener(
	root: FiberRootNode,
	weakable: Weakable<any>,
	lane: Lane
) {
	// 处理weakable的缓存，相同的weakable只需要触发一次更新
	let pingCache = root.pingCache;
	// 可能相同的weakable会有不同的更新lane，所以这里用set存储这些不同的lane，由于不同的lane会是并发更新，所以用了thread这个词
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
			// 在thenable有异步响应后，以上一次挂起的lane重新调度更新
			markRootUpdated(root, lane);
			ensureRootIsScheduled(root);
		}
		// 注册唤醒更新的ping函数
		weakable.then(ping, ping);
	}
}
