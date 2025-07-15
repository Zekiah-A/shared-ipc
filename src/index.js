// Cross-frame/ worker / parent window IPC system. Contexts that make use of IPC code may not have
// access to DOM constructs, such as window, and therefore must be handled with care
class PublicPromise extends Promise {
	/**@type {(value: any) => void}*/#resolve = () => {
		throw new Error("PublicPromise resolve called before constructor initialisation")
	};
	/**@type {(value: any) => void}*/#reject = (_) => {
		throw new Error("PublicPromise reject called before constructor initialisation")
	};
	
	/**
	 * @param {((resolve: any, reject: any) => void)|null} executor
	 */
	constructor(executor = null) {
		super((resolve, reject) => {
			this.#resolve = resolve;
			this.#reject = reject;
			
			if (executor) {
				executor(resolve, reject);
			}

		});
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
 * @typedef {Window|HTMLIFrameElement|Worker|MessagePort} IpcTarget
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
 * @property {string|undefined} error
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
 * Validates if an object matches the `IpcMessage` structure.
 * @param {any} obj - The object to validate.
 * @returns {obj is IpcMessage}
 */
function isIpcMessage(obj) {
	return (
		obj &&
		typeof obj === "object" &&
		typeof obj.call === "string" &&
		typeof obj.source === "string" &&
		(obj.handle === undefined || typeof obj.handle === "number") &&
		(obj.error === undefined || typeof obj.error === "string")
	);
}

/**
 * Safely posts an IPC message to a target (Window, Worker, or global `postMessage`).
 * @param {IpcTarget} target - The target to post the message to.
 * @param {IpcMessage} msg - The structured IPC message.
 * @throws {Error} If the target is invalid or the message is malformed.
 */
function postIpcMessage(target, msg) {
	// Validate the message structure
	if (!isIpcMessage(msg)) {
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

	const postCall = { call, data, handle, source: getWindowNameSafe(), error: undefined };
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

	const msg = { call, data, handle: undefined, source: getWindowNameSafe(), error: undefined };
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
 */
async function handleIpcMessage(data) {
	/**@type {IpcMessage|null}*/let message = null;
	/**@type {MessageEventSource|Worker|null}*/let source = null;

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
	else {
		throw new Error("Received IPC data was not a valid instance of type MessageEvent or IpcMessage");
	}

	if (message === null) {
		throw new Error("Received IPC message was null");
	}

	if (message.call && typeof message.call === "string") {
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
			if (message.handle !== undefined && message.handle !== null && source) {
				source.postMessage({
					handle: message.handle,
					data: result,
					source: getWindowNameSafe()
				});
			}
		}
		catch (error) {
			console.error(`Error executing IPC call '${message.call}':`, error);
			if (message.handle !== undefined && message.handle !== null && source) {
				source.postMessage({
					handle: message.handle,
					error: error instanceof Error ? error.message : String(error),
					source: getWindowNameSafe()
				});
			}
		}
	}
	else if (message.handle) {
		// Return value from calling another frames method
		const request = ipcReqs.get(message.handle);
		if (request) {
			if (message.error) {
				request.reject(new Error(message.error));
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
