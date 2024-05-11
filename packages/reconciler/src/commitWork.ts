import {
	ContainerType,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
	removeChild
} from 'hostConfig';
import {
	ChildDeletion,
	Flags,
	MutationMask,
	NoFlags,
	PassiveEffect,
	Placement,
	Update
} from './fiberFlags';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiberNode';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTag';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	// 向下找，直到没有副作用的子树或者到叶子节点，
	// 然后再向上回退，类似completeWork的流程一样，将沿途的副作用执行
	nextEffect = finishedWork;
	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;
		// 当前fiber节点的子树上有副作用, 则继续向下遍历,否则向上
		if (
			(nextEffect.subtreeFlags & (MutationMask | PassiveEffect)) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 要么找到叶子节点，要么找到非副作用的子树，可以回退了
			up: while (nextEffect !== null) {
				// 执行nextEffect节点的副作用
				commitMutationEffectsOnFiber(nextEffect, root);
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

function commitMutationEffectsOnFiber(
	finishedWork: FiberNode,
	root: FiberRootNode
) {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== NoFlags) {
		// 有Placement的副作用，则执行
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}
	if ((flags & Update) !== NoFlags) {
		// 有Update的副作用，则执行
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}
	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root);
			});
		}
		finishedWork.flags &= ~ChildDeletion;
	}
	if ((flags & PassiveEffect) !== NoFlags) {
		// 有副作用，收集回调
		// update类型包含了mount和update
		commitPassiveEffects(finishedWork, root, 'update');
		finishedWork.flags &= ~PassiveEffect;
	}
}

function commitPassiveEffects(fiber, root, type: keyof PendingPassiveEffects) {
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
	)
		return;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.warn('未找到副作用');
		}
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect);
	}
}

function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	let effect = lastEffect.next;
	do {
		if ((effect.tag & flags) === flags) {
			callback(effect);
		}
		effect = effect.next;
	} while (effect !== lastEffect.next);
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
		// 移除HookHasEffect标记
		effect.tag &= ~HookHasEffect;
	});
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destroy = effect.destroy;
		if (typeof destroy === 'function') {
			destroy();
		}
	});
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') {
			effect.destroy = create();
		}
	});
}

function commitPlacement(finishedWork: FiberNode) {
	if (__DEV__) {
		console.log('commitPlacement', finishedWork);
	}
	const hostParent = getHostParent(finishedWork);

	// hostSibling: 用于进行节点插入
	const sibling = getHostSibling(finishedWork);

	// hostParent为null的情况，说明finishedWork是rootFiber了，不需要再插入
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
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

/**
 * 查找稳定的可作为host的兄弟节点
 * 1. 如果有兄弟节点
 *   1.1 兄弟节点是host类型，返回
 *   1.2 兄弟节点不是host类型，则从第一个兄弟节点开始向下找，找不到再返回从第二个兄弟节点依次查找
 * 2. 如果没有兄弟节点
 *   2.1 向上查找父节点，如果父节点是host类型，返回
 *   2.2 父节点不是host类型，继续按照1来查找
 * 3. 稳定的节点：不进行Placement的节点
 * @param fiber
 */
function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;
	FindSibling: while (true) {
		// 先向上查找一步，再找兄弟节点，没有兄弟节点再继续向上一步，依次查找
		while (node.sibling === null) {
			const parent = node.return;

			if (
				parent === null ||
				// TODO: 为什么parent.tag === HostComponent代表没找到？
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}

			node = parent;
		}

		if (node.sibling !== null) {
			node.sibling.return = node.return;
			node = node.sibling;

			// 向下查找过程
			while (node.tag !== HostText && node.tag !== HostComponent) {
				if ((node.flags & Placement) !== NoFlags) {
					// 说明当前节点要进行Placement, 该节点及其子树不稳定，不适合作为host
					continue FindSibling;
				}
				// 向下继续找
				if (node.child === null) {
					continue FindSibling;
				} else {
					node.child.return = node;
					node = node.child;
				}
			}

			if ((node.flags & Placement) === NoFlags) {
				return node.stateNode;
			} else {
				continue FindSibling;
			}
		}
	}
}

function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: ContainerType,
	before?: Instance
) {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(finishedWork.stateNode, hostParent);
		}
		return;
	}
	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}

/**
 * Fragment情形下，删除Fragment节点，要收集所有的host根节点
 * 先找到第一个host根节点
 * 每收集到一个host根节点，看看是否为上一步host根节点的兄弟节点，如果是就收集到数组
 * @param hostChildrenToDelete
 * @param unmountFiber
 */
function recordHostChildrenToDelete(
	hostChildrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	const last = hostChildrenToDelete[hostChildrenToDelete.length - 1];
	if (!last) {
		hostChildrenToDelete.push(unmountFiber);
	} else {
		let node = last.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				hostChildrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
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
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
	// let rootHostNode = null;
	// 要删除的根host节点，Fragment情形下可能会有多个
	const hostChildrenToDelete = [];

	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				// 1. 对于hostComponent，要解绑ref
				// commitDeletionHostComponent(unmountFiber);
				// 2. 赋值rootHostComponent
				if (hostChildrenToDelete.length === 0) {
					recordHostChildrenToDelete(hostChildrenToDelete, unmountFiber);
				}

				break;
			case HostText:
				// 因此组件的根节点一定是一个，而不是有多个(但是Fragment可能有多个)
				if (hostChildrenToDelete.length === 0) {
					recordHostChildrenToDelete(hostChildrenToDelete, unmountFiber);
				}
				break;
			case FunctionComponent:
				// 1. 对于FC组件，要处理useEffect的清除副作用函数
				commitPassiveEffects(unmountFiber, root, 'unmount');
				break;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	});

	if (hostChildrenToDelete.length !== 0) {
		// 3. 对于子树需要找到根hostComponent, 移除DOM
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			// removeChild(rootHostNode.stateNode, hostParent);
			hostChildrenToDelete.forEach((node) =>
				removeChild(node.stateNode, hostParent)
			);
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
