import {
	ContainerType,
	appendChildToContainer,
	commitUpdate,
	removeChild
} from 'hostConfig';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import { FiberNode, FiberRootNode } from './fiberNode';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	// 向下找，直到没有副作用的子树或者到叶子节点，
	// 然后再向上回退，类似completeWork的流程一样，将沿途的副作用执行
	nextEffect = finishedWork;
	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;
		// 当前fiber节点的子树上有副作用, 则继续向下遍历,否则向上
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 要么找到叶子节点，要么找到非副作用的子树，可以回退了
			up: while (nextEffect !== null) {
				// 执行nextEffect节点的副作用
				commitMutationEffectsOnFiber(nextEffect);
				const sibling = nextEffect.sibling;
				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				} else {
					nextEffect = nextEffect.return;
				}
			}
		}
	}
};

function commitMutationEffectsOnFiber(finishedWork: FiberNode) {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== NoFlags) {
		// 有Placement的副作用，则执行
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	if ((flags & Update) !== NoFlags) {
		// 有Placement的副作用，则执行
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
}

function commitPlacement(finishedWork: FiberNode) {
	if (__DEV__) {
		console.log('commitPlacement', finishedWork);
	}
	const hostParent = getHostParent(finishedWork);
	// hostParent为null的情况，说明finishedWork是rootFiber了，不需要再插入
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
	}
}

// 向上查找类型为HostComponent或者hostRoot的节点，只有这两种节点才能作为容器插入元素
function getHostParent(finishedWork: FiberNode) {
	let parent = finishedWork.return;
	while (parent !== null) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as ContainerType;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	return null;
}

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: ContainerType
) {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(finishedWork.stateNode, hostParent);
		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}

/**
 * 删除子节点, 即要删除子树，子树内的节点都需要进行不同的处理，所以需要向下遍历子树，与beginWork的流程一致
 * 1. 对于FC组件，要处理useEffect的清除副作用函数
 * 2. 对于hostComponent，要解绑ref
 * 3. 对于子树需要找到根hostComponent, 移除DOM
 * @param childToDelete
 */
function commitDeletion(childToDelete: FiberNode) {
	let rootHostNode = null;

	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				// 1. 对于hostComponent，要解绑ref
				// commitDeletionHostComponent(unmountFiber);
				// 2. 赋值rootHostComponent
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}

				break;
			case HostText:
				// 因此组件的根节点一定是一个，而不是有多个
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				break;
			case FunctionComponent:
				// 1. 对于FC组件，要处理useEffect的清除副作用函数
				// commitUnmount(unmountFiber);
				break;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	});

	if (rootHostNode !== null) {
		// 3. 对于子树需要找到根hostComponent, 移除DOM
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			removeChild(rootHostNode, hostParent);
		}
	}
	// 脱离fiber树 TODO: 兄弟节点关系需不需要重置？这里重置fiber的意义是什么
	childToDelete.return = null;
	childToDelete.child = null;
}

/**
 *
 * @param root 子树的根节点
 * @param onCommitUnmount 遍历子树的回调，用于根据节点类型做相对应的处理
 * @returns
 */
function commitNestedComponent(root: FiberNode, onCommitUnmount) {
	let node = root;
	while (true) {
		onCommitUnmount(node);
		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === root) {
			return;
		}

		// 向上归，所以要node.sibling === null的循环
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
}
