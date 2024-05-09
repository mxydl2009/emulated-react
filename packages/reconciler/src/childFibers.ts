import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
	FiberNode,
	createFiberFromElement,
	createWorkInProgress
} from './fiberNode';
import { Props, ReactElementType } from 'shared/ReactTypes';
import { HostText } from './workTag';
import { ChildDeletion, Placement } from './fiberFlags';

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
		const child = createFiberFromElement(element);
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

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: ReactElementType | ReactElementType[]
	) {
		if (typeof newChild === 'object' && newChild !== null) {
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
		// TODO: 多节点的情况暂时未加入考虑

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}
		if (__DEV__) {
			console.warn('未实现的类型', newChild);
		}
		if (newChild === null && currentFiber !== null) {
			deleteChild(returnFiber, currentFiber);
		}
		return returnFiber.child;
	};
}

export const reconcileChildFibers = childReconciler(true);
export const mountChildFibers = childReconciler(false);
