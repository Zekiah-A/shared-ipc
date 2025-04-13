// Cross-frame/ worker / parent window IPC system. Contexts that make use of IPC code may not have
// access to DOM constructs, such as window, and therefore must be handled with care
class PublicPromise {
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		});
	}
}

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
 * @param {Window | HTMLIFrameElement | Worker} target 
 * @returns {Window | Worker}
 */
function resolvePostTarget(target) {
	try {
		if (target && target instanceof HTMLIFrameElement) {
			return /**@type {Window}*/(target.contentWindow);
		}	
	}
	catch(e) {}

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
 * @param {Window | Worker | undefined} target
 */
function isWindowLike(target) {
	return (
		typeof Window !== "undefined" &&
		typeof window !== "undefined" &&
		target instanceof Window
	);
}
/**
 * @param {Window | Worker | undefined} target
 * @param {IpcMessage} msg
 */
function postIpcMessage(target, msg) {
	if (target && typeof target.postMessage !== "function") {
		throw new Error("Invalid postMessage target");
	}

	if (target && isWindowLike(target)) {
		target.postMessage(msg, { targetOrigin: location.origin});
	}
	else if (target) {
		target.postMessage(msg);
	}
    else if (typeof postMessage === "function") {
        postMessage(msg);
    }
    else {
        throw new Error("Invalid postMessage target");
    }
}
/**
 * @param {Window | HTMLIFrameElement | Worker} target 
 * @param {string} call 
 * @param {any} data 
 */
async function makeIpcRequest(target, call, data = undefined) {
	const handle = ipcReqId++;
	const promise = new PublicPromise();

	const postCall = { call, data, handle, source: getWindowNameSafe(), error: undefined };
	ipcReqs.set(handle, promise);

	const postTarget = resolvePostTarget(target);
	if (!postTarget) {
        throw new Error("No valid postMessage target");
    }

	postIpcMessage(postTarget, postCall);

	return await promise.promise;
}
/**
 * 
 * @param {Window | HTMLIFrameElement | Worker} target 
 * @param {string} call 
 * @param {any} data 
 * @returns 
 */
function sendIpcMessage(target, call, data = undefined) {
	const postTarget = resolvePostTarget(target);
	if (!postTarget) {
		return;
	}
	const msg = { call, data, handle: undefined, source: getWindowNameSafe(), error: undefined };
	postIpcMessage(postTarget, msg);
}


// Listen for messages from other frames / child windows
/**@type {Map<string, Function>}*/const ipcHandlers = new Map();
/**
 * @param {string} name 
 * @param {Function} handler 
 */
function addMessageHandler(name, handler) {
	ipcHandlers.set(name, handler)
}
/**
 * @param {MessageEvent<any>} event 
 */
async function handleMessage(event) {
	if (!(event instanceof MessageEvent) || !event.isTrusted) {
		return;
	}

	// Event origin is blank when coming from game-worker, so a workaround must be made
	// TODO: Investigate security implications of permitting empty event origin
	if (event.origin && !event.origin.startsWith(location.origin)) {
		return;
	}
	
	/**@type {IpcMessage}*/const message = event.data;
	if (!message) {
		return;
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
			else if (typeof Window !== "undefined" && typeof window !== "undefined") {
				/**@type {{ [key: string]: Function }}*/const context = /**@type {any}*/(window);
				if (typeof context[callName] === "function") {
					result = await context[callName](message.data);
				}
			}

			// Send return result back if handle was provided
			if (message.handle !== undefined && message.handle !== null) {
				/** @type {Window} */ (event.source).postMessage({ 
					handle: message.handle, 
					data: result,
					source: getWindowNameSafe()
				}, event.origin);
			}
		}
		catch (error) {
			console.error(`Error executing IPC call '${message.call}':`, error);
			if (message.handle !== undefined && message.handle !== null) {
				/** @type {Window} */ (event.source).postMessage({ 
					handle: message.handle, 
					error: error instanceof Error ? error.message : String(error),
					source: getWindowNameSafe()
				}, event.origin);
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
	addMessageHandler, 
	handleMessage 
};
