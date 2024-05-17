import { FiberNode } from './fiberNode';

// render阶段维持Suspense组件的相对顺序，方便发生挂起的节点找到离自己最近的Suspense节点
const suspenseHandlerStack: FiberNode[] = [];

export function getSuspenseHandler() {
	return suspenseHandlerStack[suspenseHandlerStack.length - 1];
}
// beginWork中每次遇到渲染Suspense组件时都会将当前Suspense组件fiber节点入栈;
export function pushSuspenseHandler(handler: FiberNode) {
	return suspenseHandlerStack.push(handler);
}
// completeWork中每次遇到渲染Suspense组件时都会将当前Suspense组件fiber节点出栈;
export function popSuspenseHandler() {
	return suspenseHandlerStack.pop();
}
