import { FiberNode } from './fiberNode';

export function renderWithHooks(wip: FiberNode) {
	const component = wip.type;
	const children = component(wip.pendingProps);
	return children;
}
