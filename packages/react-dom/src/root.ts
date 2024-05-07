import { ContainerType } from 'hostConfig';
import { ReactElementType } from 'shared/ReactTypes';
import {
	createContainer,
	updateContainer
} from 'reconciler/src/fiberReconciler';

export function createRoot(container: ContainerType) {
	const root = createContainer(container);
	return {
		render(element: ReactElementType) {
			updateContainer(element, root);
		}
	};
}
