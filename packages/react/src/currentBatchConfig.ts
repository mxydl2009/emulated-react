export interface BatchConfig {
	// suspense: boolean;
	transition: number | null;
}

export const currentBatchConfig: BatchConfig = {
	transition: null
};
