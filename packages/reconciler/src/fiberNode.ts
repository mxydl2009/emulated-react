import {
	FunctionComponent,
	WorkTag,
	HostComponent,
	Fragment,
	ContextProvider,
	SuspenseComponent,
	OffscreenComponent
} from './workTag';
import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { Flags, NoFlags } from './fiberFlags';
import { ContainerType } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
// import { UpdateQueue } from './updateQueue';
import { CallbackNode } from 'scheduler';
import { REACT_PROVIDER_TYPE, REACT_SUSPENSE_TYPE } from 'shared/ReactSymbols';

export interface PendingPassiveEffects {
	// 收集卸载时的destroy回调
	unmount: Effect[];
	// 收集更新时的create回调
	update: Effect[];
}

export interface OffscreenProps {
	mode: 'hidden' | 'visible';
	children: any;
}

// FiberNode既作为数据存储的单元，也作为工作单元
export class FiberNode {
	type: any;
	tag: WorkTag;
	key: Key | null;
	pendingProps: Props;
	ref: Ref | null;
	memoizedProps: Props | null;
	memoizedState: any;

	stateNode: any;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;
	// 指向对应的FiberNode，双缓存技术
	alternate: FiberNode | null;
	// 存储副作用标识
	flags: Flags;
	// 存储子树的副作用
	subtreeFlags: Flags;
	updateQueue: unknown | null;
	// 存储需要删除的子节点
	deletions: FiberNode[] | null;
	/**
	 *
	 * @param tag 区分组件的类型，函数组件，类组件，host组件，hostRoot等等
	 * @param pendingProps 接收的props
	 * @param key 组件的key标识
	 */
	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 存储单元属性
		this.tag = tag;
		this.key = key || null;
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
		this.deletions = null;
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
	// 所有未被消费的Lane集合
	pendingLanes: Lanes;
	// 本次更新要消费的Lane
	finishedLane: Lane;

	pendingPassiveEffects: PendingPassiveEffects | null;

	callbackNode: CallbackNode | null;
	callbackPriority: Lane;

	constructor(container: ContainerType, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		this.finishedWork = null;
		hostRootFiber.stateNode = this;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
		this.callbackNode = null;
		this.callbackPriority = NoLane;
	}
}

// 根据当前UI的fiber节点，创建一个新的fiber节点，即复用老的节点
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
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		// 清除老节点的副作用
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	// TODO: 复用老节点的属性(究竟应该复用哪些属性)
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	// wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	wip.ref = current.ref;
	wip.child = current.child;
	return wip;
};

/**
 * 根据react element创建Fiber节点
 * @param element
 */
export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props, ref } = element;
	let fiberTag: WorkTag = FunctionComponent; // 默认为FunctionComponent;
	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (
		typeof type === 'object' &&
		type.$$typeof === REACT_PROVIDER_TYPE
	) {
		fiberTag = ContextProvider;
	} else if (
		typeof type === 'object' &&
		type.$$typeof === REACT_SUSPENSE_TYPE
	) {
		fiberTag = SuspenseComponent;
	} else if (typeof type !== 'function') {
		if (__DEV__) {
			console.warn('unKnown type.');
		}
		fiberTag = HostComponent;
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	fiber.ref = ref ? ref : null;
	return fiber;
}

export function createFiberFromFragment(element: ReactElementType, key: Key) {
	const fiber = new FiberNode(Fragment, element.props, key);
	return fiber;
}

export function createFiberFromOffscreen(pendingProps: OffscreenProps) {
	const fiber = new FiberNode(OffscreenComponent, pendingProps, null);
	return fiber;
}
