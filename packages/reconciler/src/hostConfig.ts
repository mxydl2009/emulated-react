// @ts-nocheck

import { Props, Type } from 'shared/ReactTypes';

export type ContainerType = any;
export type Instance = any;

export function createInstance(type: Type, props: Props): any {
	return {} as any;
}

export function createTextInstance(content: string | number): any {
	return {} as any;
}

export function appendInitialChild(parent: Instance, child: Instance) {
	parent.appendChild(child);
}

export function appendChildToContainer(...args: any) {
	return {} as any;
}
