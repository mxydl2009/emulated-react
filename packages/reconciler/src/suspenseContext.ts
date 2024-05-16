import { FiberNode } from './fiberNode';

const suspenseHandlerStack: FiberNode[] = [];

export function getSuspenseHandler() {
	return suspenseHandlerStack[suspenseHandlerStack.length - 1];
}

export function pushSuspenseHandler(handler: FiberNode) {
	return suspenseHandlerStack.push(handler);
}

export function popSuspenseHandler() {
	return suspenseHandlerStack.pop();
}
