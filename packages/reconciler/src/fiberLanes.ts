import { FiberRootNode } from './fiberNode';
import {
	unstable_getCurrentPriorityLevel as getCurrentPriorityLevel,
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	// unstable_LowPriority as LowPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_IdlePriority as IdlePriority
} from 'scheduler';

export type Lane = number;
// Lanes是Lane的集合，代表了更新任务属于同一批次的Lane
export type Lanes = number;

// 二进制的好处: 1. 节省空间; 2. 可以比较大小; 3. 可以通过逻辑运算，获取同属于一个批次的优先级;
export const SyncLane = 0b0001;
// 连续的用户交互事件，比如拖拽、scroll等等
export const InputContinuousLane = 0b0010;

export const DefaultLane = 0b0100;
export const IdleLane = 0b1000;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane) {
	return laneA | laneB;
}

// 判断某个lane是否包含在某个lanes集合，这样方便判断lane是否是某个批次的lanes
export function isSubsetOfLanes(set: Lanes, subset: Lane) {
	return (set & subset) === subset;
}
export function requestUpdateLane() {
	const currentSchedulerPriority = getCurrentPriorityLevel();
	const currentLane = schedulerPriorityToLane(currentSchedulerPriority);
	return currentLane;
}

export function requestUpdateLaneOnMount() {
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
// 获取lanes中最高优先级的lane对应的priority
export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);
	if (lane === SyncLane) {
		return ImmediatePriority;
	}
	if (lane === InputContinuousLane) {
		return UserBlockingPriority;
	}
	if (lane === DefaultLane) {
		return NormalPriority;
	}
	return IdlePriority;
}

export function schedulerPriorityToLane(schedulerPriority: number) {
	if (schedulerPriority === ImmediatePriority) {
		return SyncLane;
	}
	if (schedulerPriority === UserBlockingPriority) {
		return InputContinuousLane;
	}
	if (schedulerPriority === NormalPriority) {
		return DefaultLane;
	}
	if (schedulerPriority === IdlePriority) {
		return IdleLane;
	}
	return NoLane;
}
