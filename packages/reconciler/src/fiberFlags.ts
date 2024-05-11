export type Flags = number;

export const NoFlags = 0b00000000;
export const Placement = 0b00000001;
export const Update = 0b00000010;
export const ChildDeletion = 0b00000100;

export const PassiveEffect = 0b00001000; // 本次更新需要触发create回调
// 操作掩码，用于判断是否包含某项操作
export const MutationMask = Placement | Update | ChildDeletion;

export const PassiveMask = PassiveEffect | ChildDeletion; // 本次更新需要触发create回调/destroy回调
