// Cross-frame/ worker / parent window IPC system. Contexts that make use of IPC code may not have
// access to DOM constructs, such as window, and therefore must be handled with care
class PublicPromise extends Promise {
	/**@type {(value: any) => void}*/#resolve = () => {
		throw new Error("PublicPromise resolve invoked before constructor initialisation")
	};
	/**@type {(value: any) => void}*/#reject = (_) => {
		throw new Error("PublicPromise reject invoked before constructor initialisation")
	};
	
	/**
	 * @param {((resolve: any, reject: any) => void)|null} executor
	 */
	constructor(executor = null) {
		/**@type {(value: any) => void}*/let capturedResolve = () => {
			throw new Error("Captured resolve invoked before superclass initialisation")
		};
		/**@type {(value: any) => void}*/let capturedReject = (_) => {
			throw new Error("Captured reject invoked before superclass initialisation")
		};

		super((resolve, reject) => {
			capturedResolve = resolve;
			capturedReject = reject;
			
			if (executor) {
				executor(resolve, reject);
			}
		});

		this.#resolve = capturedResolve;
		this.#reject = capturedReject;
	}

	/**
	 * @param {any} value 
	 */
	resolve(value) {
		this.#resolve(value);
	}

	/**
	 * @param {any} reason 
	 */
	reject(reason) {
		this.#reject(reason);
	}
	
	static deferred() {
		return new PublicPromise();
	}
}

/**
 * @typedef {Object} IpcResult
 * @property {Error|undefined} data
 * @property {number} handle
 * @property {string} source
 * @property {Error|string|undefined} error
 */

/**
 * @typedef {MessageEventSource|Worker} IpcSource
 */

/**
 * @typedef {Window|HTMLIFrameElement|Worker|MessagePort|ServiceWorker} IpcTarget
 */

/**
 * @typedef {MessageEvent<IpcMessage>|IpcMessage} IpcEventData
 */

/**
 * @typedef {Object} IpcMessage
 * @property {string} call
 * @property {any} data
 * @property {number|undefined} handle
 * @property {string} source
 */

/**@type {number}*/let ipcReqId = 0;
/**@type {Map<number, PublicPromise>}*/const ipcReqs = new Map();

/**
 * 
 * @param {IpcTarget} target 
 * @returns {Window | Worker}
 */
function resolvePostTarget(target) {
	if (target && typeof HTMLIFrameElement !== "undefined" && target instanceof HTMLIFrameElement) {
		return /**@type {Window}*/(target.contentWindow);
	}

	return /**@type {Window | Worker}*/(target);
}

/**
 * @returns {string} 
 */
function getWindowNameSafe() {
	try {
		return typeof window !== "undefined" && typeof window.name === "string"
			? window.name
			: "worker";
	}
	catch {
		return "worker";
	}
}

/**
 * @returns {boolean}
 */
function isWindowDefined() {
	return (
		typeof Window !== "undefined" &&
		typeof window !== "undefined"
	);
}

/**
 * Validates if an object resembles a browser window.
 * @param {any} target
 * @returns {boolean}
 */
function isWindowLike(target) {
	return (
		isWindowDefined() &&
		target instanceof Window
	);
}

/**
 * Validates if an object has the `IpcMessage` structure (shape check only)
 * @param {any} obj
 * @returns {obj is IpcMessage} 
 */
function isIpcMessage(obj) {
	if (!obj || typeof obj !== "object") {
		return false;
	}

	const expectedProps = ["call", "data", "handle", "source"];
	const actualProps = Object.keys(obj);

	for (const prop of expectedProps) {
		if (!(prop in obj)) {
			return false;
		}
	}

	for (const prop of actualProps) {
		if (!expectedProps.includes(prop)) {
			return false;
		}
	}

	return true;
}

/**
 * Validates if an IpcMessage has valid property values
 * @param {IpcMessage} obj
 * @returns {boolean}
 */
function isValidIpcMessage(obj) {
	if (!isIpcMessage(obj)) {
		return false;
	}

	if (typeof obj.call !== "string" || obj.call.length === 0) {
		return false;
	}

	if (obj.handle !== undefined) {
		if (typeof obj.handle !== "number" || isNaN(obj.handle) || !isFinite(obj.handle)) {
			return false;
		}
	}

	if (typeof obj.source !== "string") {
		return false;
	}

	return true;
}

/**
 * Validates if an object has the `IpcResult` structure (shape check only)
 * @param {any} obj
 * @returns {obj is IpcResult} 
 */
function isIpcResult(obj) {
	if (!obj || typeof obj !== "object") {
		return false;
	}

	const expectedProps = ["data", "handle", "source", "error"];
	const actualProps = Object.keys(obj);

	for (const prop of expectedProps) {
		if (!(prop in obj)) {
			return false;
		}
	}

	for (const prop of actualProps) {
		if (!expectedProps.includes(prop)) {
			return false;
		}
	}

	return true;
}

/**
 * Validates if an IpcResult has valid property values
 * @param {IpcResult} obj
 * @returns {boolean}
 */
function isValidIpcResult(obj) {
	if (!isIpcResult(obj)) {
		return false;
	}

	if (obj.data === undefined && obj.error === undefined) {
		return false;
	}

	if (obj.data !== undefined && obj.error !== undefined) {
		return false;
	}

	if (typeof obj.handle !== "number" || isNaN(obj.handle) || !isFinite(obj.handle)) {
		return false;
	}

	if (typeof obj.source !== "string" || obj.source.length === 0) {
		return false;
	}

	return true;
}

/**
 * @param {IpcSource|null} target 
 * @param {IpcResult} response
 */
async function postIpcResponse(target=null, response) {
	// Validate the response structure
	if (!isValidIpcResult(response)) {
		throw new Error("Invalid IPC result structure");
	}

	if (target) {
		target.postMessage(response);
	}
	else {
		try {
			// Post to a worker, messageport or similar
			const { parentPort } = await import("worker_threads");
			if (parentPort) {
				parentPort.postMessage(response);
			}
			else {
				throw new Error("Invalid postIpcResponse target: No valid method found")
			}
		}
		catch {
			// Not in Node.js worker context, try global postMessage
			if (typeof postMessage === "function") {
				postMessage(response);
			}
			else {
				throw new Error("Invalid postIpcResponse target: No valid method found")
			}
		}
	}
}

/**
 * Safely posts an IPC message to a target (Window, Worker, or global `postMessage`).
 * @param {IpcTarget|MessageEventSource|null} target - The target to post the message to.
 * @param {IpcMessage} msg - The structured IPC message.
 * @throws {Error} If the target is invalid or the message is malformed.
 */
function postIpcMessage(target, msg) {
	// Validate the message structure
	if (!isValidIpcMessage(msg)) {
		throw new Error("Invalid IPC message structure");
	}

	// Determine the correct postMessage method
	if (target && isWindowLike(target)) {
		// Post to a Windowr
		target.postMessage(msg, { targetOrigin: location.origin });
	}
	else if (target && typeof target.postMessage === "function") {
		// Post to a Worker, MessagePort, or similar
		target.postMessage(msg);
	}
	else if (typeof postMessage === "function") {
		// Fall back to global `postMessage` (e.g., in a Worker)
		postMessage(msg);
	}
	else {
		throw new Error("Invalid postIpcMessage target: No valid method found");
	}
}

/**
 * @param {Window | HTMLIFrameElement | Worker} target 
 * @param {string} call 
 * @param {any} data 
 */
async function makeIpcRequest(target, call, data = undefined) {
	const handle = ipcReqId++;
	const promise = PublicPromise.deferred();

	const postCall = { call, data, handle, source: getWindowNameSafe() };
	ipcReqs.set(handle, promise);

	const postTarget = resolvePostTarget(target);
	if (!postTarget) {
		throw new Error("Invalid postMessage target");
	}

	postIpcMessage(postTarget, postCall);

	return await promise;
}

/**
 * @param {IpcTarget} target 
 * @param {string} call 
 * @param {any} data 
 * @returns 
 */
function sendIpcMessage(target, call, data = undefined) {
	const postTarget = resolvePostTarget(target);
	if (!postTarget) {
		throw new Error("Invalid postMessage target");
	}

	const msg = { call, data, handle: undefined, source: getWindowNameSafe() };
	postIpcMessage(postTarget, msg);
}

/**@type {Map<string, Function>}*/const ipcHandlers = new Map();

/**
 * @param {string} name 
 * @param {Function} handler 
 */
function addIpcMessageHandler(name, handler) {
	ipcHandlers.set(name, handler);
}

/**
 * @param {IpcEventData} data
 * @param {IpcSource|null} source - Fallback bound source if message is coming from a nodeJS Worker,
 * as opposed to browser postMessage, therefore meaning that the provided data will be a bare IpcMessage
 * without any information as to where it came from
 */
async function handleIpcMessage(data, source = null) {
	if (!data) {
		throw new Error("Received IPC data was null or undefined");
	}

	// Try and extract the IPC message (or result) out of what we were given
	/**@type {IpcMessage|IpcResult|null}*/let message = null;
	if (typeof MessageEvent !== "undefined" && data instanceof MessageEvent) {
		// MessageEvent<IpcMessage> likely originating from browser postMessage
		if (!data.isTrusted) {
			throw new Error("Received IPC data was not a trusted instance of type MessageEvent");
		}

		message = data.data;
		source = data.source;
	}
	else if (isIpcMessage(data)) {
		// Bare IpcMessage likely originating from NodeJS MessageChannel
		message = data;
	}
	else if (isIpcResult(data)) {
		// Bare IpcResult likely originating from NodeJS MessageChannel
		message = data;
	}
	else {
		throw new Error("Received IPC data was not a valid instance of type MessageEvent or IpcMessage");
	}
	// Validate that we actually managed to extract a message and source
	if (!message) {
		throw new Error("Received IPC message was null or undefined");
	}

	if (isIpcMessage(message)) {
		/** @type {any} */let result = undefined;
		try {
			const callName = message.call;

			// Try ipcHandlers first
			if (ipcHandlers.has(callName)) {
				const reqHandler = /** @type {Function} */(ipcHandlers.get(callName));
				result = await reqHandler(message.data);
			}
			// Fallback to global window
			else if (isWindowDefined()) {
				/**@type {{ [key: string]: Function }}*/const context = /**@type {any}*/(window);
				if (typeof context[callName] === "function") {
					result = await context[callName](message.data);
				}
			}

			// Send return result back if handle was provided
			if (message.handle !== undefined && message.handle !== null) {
				/**@type {IpcResult}*/const resultMessage = {
					handle: message.handle,
					data: result,
					source: getWindowNameSafe(),
					error: undefined
				};

				if (!source) {
					throw new Error("Received IPC result source was null or undefined");
				}

				await postIpcResponse(source, resultMessage);
			}
		}
		catch (error) {
			console.error(`Error executing IPC call '${message.call}':`, error);
			if (message.handle !== undefined && message.handle !== null) {
				/**@type {IpcResult}*/const errorMessage = {
					handle: message.handle,
					error: error instanceof Error ? error.message : String(error),
					source: getWindowNameSafe(),
					data: undefined
				};

				if (!source) {
					throw new Error("Received IPC result source was null or undefined");
				}

				await postIpcResponse(source, errorMessage);
			}
		}
	}
	else if (isIpcResult(message)) {
		// Return value from calling another frames method
		const request = ipcReqs.get(message.handle);
		if (request) {
			if (message.error) {
				request.reject(message.error);
			}
			else {
				request.resolve(message.data);
			}

			ipcReqs.delete(message.handle);
		}
	}
}

export {
	PublicPromise,
	makeIpcRequest,
	sendIpcMessage,
	addIpcMessageHandler,
	handleIpcMessage
};
