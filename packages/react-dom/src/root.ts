import { ContainerType } from 'hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import {
	createContainer,
	updateContainer
} from 'reconciler/src/fiberReconciler';
import { initEvent } from './syntheticEvent';

export function createRoot(container: ContainerType) {
	initEvent(container, 'click');
	const root = createContainer(container);
	return {
		render(element: ReactElementType) {
			updateContainer(element, root);
		}
	};
}
