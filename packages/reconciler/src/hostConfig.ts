import { Props, Type } from 'shared/ReactTypes';

export type ContainerType = any;
export type Instance = any;

export function createInstance(type: Type, props: Props): any {
	console.log(type, props);

	return {} as any;
}

export function createTextInstance(content: string | number): any {
	console.log(content);

	return {} as any;
}

export function appendInitialChild(parent: Instance, child: Instance) {
	parent.appendChild(child);
}

export function appendChildToContainer(...args: any) {
	console.log(args);

	return {} as any;
}
