import { FiberNode } from './fiberNode';

/**
 * 构造fiberNode，返回子FiberNode
 */
export const beginWork = (fiber: FiberNode) => {
	return fiber || null;
};
