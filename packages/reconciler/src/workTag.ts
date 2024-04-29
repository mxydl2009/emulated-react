export const FunctionComponent = 0;
export const HostRoot = 3;
export const hostComponent = 5;
export const hostText = 6;
// TODO: typeof 操作符对常量的处理是该常量的值
export type WorkTag =
	| typeof FunctionComponent
	| typeof HostRoot
	| typeof hostComponent
	| typeof hostText;
