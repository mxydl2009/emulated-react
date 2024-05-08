import { ContainerType, appendChildToContainer } from 'hostConfig';
import { MutationMask, NoFlags, Placement } from './fiberFlags';
import { FiberNode, FiberRootNode } from './fiberNode';
import { HostComponent, HostRoot, HostText } from './workTag';

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
