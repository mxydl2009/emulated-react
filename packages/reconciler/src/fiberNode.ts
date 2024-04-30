import { FunctionComponent, WorkTag, HostComponent } from './workTag';
import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { Flags, NoFlags } from './fiberFlags';
import { ContainerType } from 'hostConfig';
// import { UpdateQueue } from './updateQueue';÷

// FiberNode既作为数据存储的单元，也作为工作单元
export class FiberNode {
	type: any;
	tag: WorkTag;
	key: Key;
	pendingProps: Props;
	ref: Ref;
	memoizedProps: Props;
	memoizedState: any;

	stateNode: any;

	return: FiberNode;
	sibling: FiberNode;
	child: FiberNode;
	index: number;
	// 指向对应的FiberNode，双缓存技术
	alternate: FiberNode;
	// 存储副作用标识
	flags: Flags;
	// 存储子树的副作用
	subtreeFlags: Flags;
	updateQueue: unknown | null;
	/**
	 *
	 * @param tag 区分组件的类型，函数组件，类组件，host组件，hostRoot等等
	 * @param pendingProps 接收的props
	 * @param key 组件的key标识
	 */
	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 存储单元属性
		this.tag = tag;
		this.key = key;
		// 存储真实DOM节点或者类组件实例对象
		this.stateNode = null;
		this.type = null;

		// 工作单元属性
		// 存储父fiber节点
		this.return = null;
		// 存储下一个兄弟fiber节点
		this.sibling = null;
		// 存储第一个子fiber节点
		this.child = null;
		// 存储自身在兄弟节点中的索引
		this.index = 0;
		this.ref = null;
		// pendingProps是最新的props，memoizedProps是老的props，用于工作单元
		this.pendingProps = pendingProps;
		this.memoizedProps = null;
		this.memoizedState = null;
		this.alternate = null;
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.updateQueue = null;
	}
}

/**
 * 双缓存技术的管理节点
 */
export class FiberRootNode {
	// 宿主环境的挂载节点，浏览器环境则为root div
	container: ContainerType;
	// 当前UI对应的fiber根节点
	current: FiberNode;
	// 更新完成后的fiber根节点，与current都是服务于双缓存技术
	finishedWork: FiberNode | null;

	constructor(container: ContainerType, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		this.finishedWork = null;
		hostRootFiber.stateNode = this;
	}
}

// 根据当前UI的fiber节点，创建一个新的fiber节点
export const createWorkInProgress = (
	// hostRootFiber节点
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	// 复用老的fiber节点
	let wip = current.alternate;
	if (wip === null) {
		// mount, 而且只有hostRootFiber节点是fiber，子节点还是ReactElement
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		// 清除老节点的副作用
		wip.flags = NoFlags;
	}
	// TODO: 复用老节点的属性(究竟应该复用哪些属性)
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	// wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	return wip;
};

/**
 * 根据reactelement创建Fiber节点
 * @param element
 */
export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props } = element;
	let tag: WorkTag = FunctionComponent; // 默认为FunctionComponent;
	if (typeof type === 'string') {
		tag = HostComponent;
	} else if (typeof type !== 'function') {
		if (__DEV__) {
			console.warn('unKnown type.');
		}
		tag = HostComponent;
	}
	const fiber = new FiberNode(tag, props, key);
	fiber.type = type;
	return fiber;
}
