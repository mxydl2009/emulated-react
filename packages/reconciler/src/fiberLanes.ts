import { FiberRootNode } from './fiberNode';

export type Lane = number;
// Lanes是Lane的集合，代表了更新任务属于同一批次的Lane
export type Lanes = number;

// 二进制的好处: 1. 节省空间; 2. 可以比较大小; 3. 可以通过逻辑运算，获取同属于一个批次的优先级;
export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane) {
	return laneA | laneB;
}

export function requestUpdateLane() {
	return SyncLane;
}

/**
 * 获取lanes中优先级最高的lane
 * lane越小，优先级越高
 * @param lanes
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes;
}

/**
 * 从pendingLanes中移除lane
 * @param root
 * @param lane
 */
export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
