export type Flags = number;

export const NoFlags = 0b00000000;
export const Placement = 0b00000001;
export const Update = 0b00000010;
export const ChildDeletion = 0b00000100;

export const PassiveEffect = 0b00001000; // 本次更新需要触发create回调
export const Ref = 0b00010000; // 本次更新需要进行ref操作
// 操作掩码，用于判断是否包含某项操作
export const MutationMask = Placement | Update | ChildDeletion;
export const LayoutMask = Ref;

export const Visibility = 0b00100000; // 需要调整取消display: none
export const ShouldCapture = 0b01000000; // render阶段捕获到错误
export const DidCapture = 0b10000000; // render阶段捕获到错误

export const PassiveMask = PassiveEffect | ChildDeletion; // 本次更新需要触发create回调/destroy回调
