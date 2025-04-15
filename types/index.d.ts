// cross-ipc.d.ts
type IpcTarget = Window | HTMLIFrameElement | Worker | MessagePort;

interface IpcMessage {
	call: string;
	data?: any;
	handle?: number;
	source: string;
	error?: string;
}

declare class PublicPromise<T = any> {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
	constructor();
}

/**
 * Resolves a post target to either Window or Worker
 */
declare function resolvePostTarget(target: IpcTarget): Window | Worker;

/**
 * Safely gets the window name or falls back to "worker"
 */
declare function getWindowNameSafe(): string;

/**
 * Checks if the window object is defined
 */
declare function isWindowDefined(): boolean;

/**
 * Validates if an object resembles a browser window
 */
declare function isWindowLike(target: any): target is Window;

/**
 * Validates if an object matches the IpcMessage structure
 */
declare function isIpcMessage(obj: any): obj is IpcMessage;

/**
 * Safely posts an IPC message to a target
 */
declare function postIpcMessage(target: IpcTarget, msg: IpcMessage): void;

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