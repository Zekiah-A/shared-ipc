import {
	makeIpcRequest,
	sendIpcMessage,
	addIpcMessageHandler,
	handleIpcMessage
} from "shared-ipc";
import { Worker, isMainThread, parentPort } from "worker_threads";

if (isMainThread) {
	const fileName = new URL("", import.meta.url).pathname;

	addIpcMessageHandler("generateGreeting", (name) => {
		return `Hello ${name}!`;
	});

	const worker = new Worker(fileName);
	worker.addListener("message", handleIpcMessage);
	sendIpcMessage(worker, "notification", { type: "alert", message: "Something happened!" });
}
else {
	addIpcMessageHandler("notification", ({ type, message }) => {
		console.log("Received notification from main thread:", type, message);
	});	
	parentPort.addListener("message", handleIpcMessage);

	makeIpcRequest(parentPort, "generateGreeting", "World").then(result => {
		console.log("Received greeting result from main thread", result);
	});
}

