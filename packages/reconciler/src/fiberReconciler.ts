import { ContainerType } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiberNode';
import { HostRoot } from './workTag';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate
} from './updateQueue';
import { ReactElementType } from 'packages/shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

/**
 * createRoot方法内部执行，用于创建FiberRootNode
 * @param container
 */
export function createContainer(container: ContainerType) {
	// 由HostRoot tag创建hostRootFiber
	const hostRootFiber = new FiberNode(HostRoot, {}, null);
	// 将container通过FiberRootNode与hostRootFiber绑定
	const root = new FiberRootNode(container, hostRootFiber);
	hostRootFiber.updateQueue = createUpdateQueue();
	return root;
}

/**
 * render方法内部执行，用于渲染, render(<App />)
 * @param element ReactElement，即jsx的调用结果
 * @param root fiberRootNode
 * @returns
 */
export function updateContainer(
	element: ReactElementType | null,
	root: FiberRootNode
) {
	const hostRootFiber = root.current;
	// 由element生成更新
	const update = createUpdate<ReactElementType | null>(element);
	// 将更新插入到hostRoot的队列中
	enqueueUpdate(
		hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
		update
	);
	// 开启hostRootFiber的更新调度
	scheduleUpdateOnFiber(hostRootFiber);
	return element;
}
