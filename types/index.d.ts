export interface IpcMessage {
	call: string;
	data?: any;
	handle?: number;
	source: string;
	error?: string;
}

export class PublicPromise<T = any> {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
	constructor();
}

export function makeIpcRequest(
	target: Window | HTMLIFrameElement | Worker,
	call: string,
	data?: any
): Promise<any>;

export function sendIpcMessage(
	target: Window | HTMLIFrameElement | Worker,
	call: string,
	data?: any
): void;

export function addMessageHandler(
	name: string,
	handler: (data: any) => any | Promise<any>
): void;

export function handleMessage(event: MessageEvent): void;