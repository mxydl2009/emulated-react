export type Flags = number;

export const NoFlags = 0b00000001;
export const Placement = 0b00000010;
export const Update = 0b00000100;
export const ChildDeletion = 0b00001000;

// 操作掩码，用于判断是否包含某项操作
export const MutationMask = Placement | Update | ChildDeletion;
