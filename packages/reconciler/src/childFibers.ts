import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';
import {
	FiberNode,
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress
} from './fiberNode';
import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import { Fragment, HostText } from './workTag';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildrenMap = Map<string, FiberNode>;

/**
 * mount时不需要根据effects，因为mount只是placement；
 * @param shouldTrackEffects
 * @returns
 */
function childReconciler(shouldTrackEffects: boolean) {
	/**
	 * 待删除的子节点加入父节点的待删除数组中，并标记删除副作用
	 * @param returnFiber 父节点
	 * @param childToDelete 子节点
	 * @returns
	 */
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return;
		}
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}
	/**
	 * 复用fiber节点
	 * @param fiber 需要被复用的节点
	 * @param pendingProps 新的props
	 * @returns
	 */
	function reuseFiber(fiber: FiberNode, pendingProps: Props) {
		const cloneFiber = createWorkInProgress(fiber, pendingProps);
		cloneFiber.sibling = null;
		cloneFiber.index = 0;
		return cloneFiber;
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		childToDelete: FiberNode
	) {
		if (!shouldTrackEffects) return;
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			childToDelete = childToDelete.sibling;
		}
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		while (currentFiber !== null) {
			// update
			if (currentFiber.key === key) {
				// key相同
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// let props = element.props;
						// if (element.type === REACT_FRAGMENT_TYPE) {
						// 	props = element.props.children;
						// }
						// type相同 直接复用, 返回节点, 标记剩下的节点要删除
						const cloneFiber = reuseFiber(currentFiber, element.props);
						cloneFiber.return = returnFiber;
						// TODO: 是不是需要检查一下复用的节点是否有属性更新？
						// completeWork会回到每个生成的节点中，再进行属性上的diff来确定是否有属性更新
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return cloneFiber;
					} else {
						// type不同 删除所有的节点，break，创建新节点
						deleteRemainingChildren(returnFiber, currentFiber);
						break;
					}
				} else {
					if (__DEV__) {
						console.warn('不支持的类型');
						throw new Error('不支持的类型');
					}
				}
			} else {
				// key不同，删除当前fiber，继续遍历
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}
		let child;
		if (element.type === REACT_FRAGMENT_TYPE) {
			child = createFiberFromFragment(element, key);
		} else {
			child = createFiberFromElement(element);
		}
		child.return = returnFiber;
		return child;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				// tag相同，说明都是文本节点，复用
				const cloneFiber = reuseFiber(currentFiber, { content });
				cloneFiber.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return cloneFiber;
			} else {
				// 不能复用，删除节点，继续遍历
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}
		const child = new FiberNode(HostText, { content }, null);
		child.return = returnFiber;
		return child;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}
		return fiber;
	}

	function updateFragment(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType,
		key: Key,
		existingChildren: ExistingChildrenMap
	) {
		const props = element.props;
		let fiber;
		if (currentFiber !== null && currentFiber.tag === Fragment) {
			// 复用
			existingChildren.delete(key);
			fiber = reuseFiber(currentFiber, props);
		} else {
			// 创建
			fiber = createFiberFromFragment(element, key);
		}
		fiber.return = returnFiber;
		return fiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildrenMap,
		element: any,
		key: string
	): FiberNode | null {
		const before = existingChildren.get(key);

		if (typeof element === 'string' || typeof element === 'number') {
			// HostText
			if (before) {
				// 能找到旧节点
				if (before.tag === HostText) {
					// 能复用, 要返回fiber节点
					existingChildren.delete(key);
					return reuseFiber(before, { content: String(element) });
				}
			}
			// before不存在时，表示新节点的索引超过了老节点的索引，应该创建一个fiber节点作为复用
			return new FiberNode(HostText, { content: String(element) }, null);
		}
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						// Fragment
						return updateFragment(
							returnFiber,
							before,
							element,
							key,
							existingChildren
						);
					}
					if (before) {
						if (before.type === element.type) {
							// 能复用
							existingChildren.delete(key);
							return reuseFiber(before, element.props);
						}
					}
					// 不能复用，创建一个fiber节点
					return createFiberFromElement(element);

				default:
					if (__DEV__) {
						console.warn('不支持的类型', element.$$typeof);
						throw new Error('不支持的类型' + element.$$typeof);
					}
					break;
			}
			if (Array.isArray(element)) {
				// TODO:element是数组时，暂未实现, 如{[<li>2</li>, <li>3</li>]}
			}
		}

		// 找不到，不能复用，
		return null;
	}

	function reconcileChildArray(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		children: any[]
	) {
		// 老节点中上一个可复用节点的索引，标记移动的判断标准就是节点之间的相对顺序
		let lastPlacedIndex = 0;

		// 准备形成fiber链表
		let firstNewFiber: FiberNode | null = null;
		let lastNewFiber: FiberNode | null = null;
		// 存储currentFiber到Map
		const existingChildren: ExistingChildrenMap = new Map();
		while (currentFiber !== null) {
			const key = currentFiber.key
				? currentFiber.key
				: String(currentFiber.index);
			existingChildren.set(key, currentFiber);
			currentFiber = currentFiber.sibling;
		}
		// 遍历children
		// 用index索引作为key
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const key = child.key ? child.key : String(i);
			// 找到旧节点，就复用旧节点，否则创建新节点，那么就会形成新节点的链表(除了Boolean、null、undefined)
			const newFiber = updateFromMap(returnFiber, existingChildren, child, key);

			// newFiber为null时，表示element的类型不满足要求(如boolean, null, undefined)
			if (newFiber === null) {
				continue;
			} else {
				newFiber.index = i;
				newFiber.return = returnFiber;
			}

			if (firstNewFiber === null) {
				firstNewFiber = newFiber;
				lastNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = newFiber;
			}

			const current = newFiber.alternate;
			if (current !== null) {
				const oldIndex = current.index;
				if (oldIndex < lastPlacedIndex) {
					// 本次遍历到的新节点对应的老节点的索引小于上一个节点（其实就是上一次遍历到的新节点对应的老节点）的索引
					// 说明前后两次遍历的节点相对顺序有变化，则需要标记移动
					newFiber.flags |= Placement;
					continue;
				}
				// 不需要移动
				lastPlacedIndex = oldIndex;
			} else {
				// mount, 标记插入
				newFiber.flags |= Placement;
			}
		}

		// 删除没有复用的老节点
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		return firstNewFiber;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: any
	) {
		// 对于单节点的情况，判断newChild是不是顶层未添加key的Fragment节点
		// 如果是，直接将fragment的children赋值给newChild, 转化为多节点的逻辑,因为单节点Fragment没什么意义
		// 如果不是，那么就会进入多节点的逻辑，在updateFromMap中进行处理
		const isUnKeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;
		if (isUnKeyedTopLevelFragment) {
			newChild = newChild.props.children;
		}
		if (
			typeof newChild === 'object' &&
			newChild !== null &&
			!Array.isArray(newChild)
		) {
			switch ((newChild as ReactElementType).$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(
							returnFiber,
							currentFiber,
							newChild as ReactElementType
						)
					);
				default:
					if (__DEV__) {
						console.warn('未实现的类型', newChild);
					}
					break;
			}
		}
		// 多节点的情况
		if (Array.isArray(newChild)) {
			return reconcileChildArray(returnFiber, currentFiber, newChild as any[]);
		}

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}
		if (__DEV__) {
			console.warn('未实现的类型', newChild);
		}
		if (newChild === null && currentFiber !== null) {
			deleteRemainingChildren(returnFiber, currentFiber);
		}
		return returnFiber.child;
	};
}

export const reconcileChildFibers = childReconciler(true);
export const mountChildFibers = childReconciler(false);
