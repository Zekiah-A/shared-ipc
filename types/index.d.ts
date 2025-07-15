// shared-ipc.d.ts
type IpcTarget = Window|HTMLIFrameElement|Worker|MessagePort|ServiceWorker;

interface IpcMessage {
	call: string;
	data?: any;
	handle?: number;
	source: string;
	error?: string;
}

declare class PublicPromise extends Promise<any> {
	resolve: (value: any) => void;
	reject: (reason?: any) => void;
	constructor(executor: ((resolve: any, reject: any) => void)|null);
}

/**
 * Makes an IPC request and returns a promise for the response
 */
declare function makeIpcRequest<T = any>(target: IpcTarget, call: string, data?: any): Promise<T>;

/**
 * Sends an IPC message without expecting a response
 */
declare function sendIpcMessage(target: IpcTarget, call: string, data?: any): void;

/**
 * Adds a message handler for specific IPC calls
 */
declare function addIpcMessageHandler(name: string, handler: (data: any) => any): void;

/**
 * Handles incoming IPC messages
 */
declare function handleIpcMessage(data: MessageEvent<IpcMessage> | IpcMessage): Promise<void>;

export {
	PublicPromise,
	makeIpcRequest,
	sendIpcMessage,
	addIpcMessageHandler,
	handleIpcMessage
};