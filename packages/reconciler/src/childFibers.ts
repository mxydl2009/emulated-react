import { REACT_ELEMENT_TYPE } from 'packages/shared/ReactSymbols';
import { FiberNode, createFiberFromElement } from './fiberNode';
import { ReactElementType } from 'packages/shared/ReactTypes';
import { HostText } from './workTag';
import { Placement } from './fiberFlags';

/**
 * mount时不需要根据effects，因为mount只是placement；
 * @param shouldTrackEffects
 * @returns
 */
function childReconciler(shouldTrackEffects: boolean) {
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const child = createFiberFromElement(element);
		child.return = returnFiber;
		return child;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
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
		return returnFiber.child;
	};
}

export const reconcileChildFibers = childReconciler(true);
export const mountChildFibers = childReconciler(false);
