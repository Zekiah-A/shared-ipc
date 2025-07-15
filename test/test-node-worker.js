import {
	makeIpcRequest,
	sendIpcMessage,
	addIpcMessageHandler,
	handleIpcMessage
} from "../src/index.js";
import { Worker, isMainThread, parentPort } from "worker_threads";

if (isMainThread) {
	const fileName = new URL("", import.meta.url).pathname;

	addIpcMessageHandler("generateGreeting", (name) => {
		return `Hello ${name}!`;
	});

	const worker = new Worker(fileName);
	worker.addListener("message", (data) => handleIpcMessage(data, worker));
	worker.addListener("online", () => {
		sendIpcMessage(worker, "ready");
		sendIpcMessage(worker, "notification", { type: "alert", message: "Something happened!" });
	});
}
else {
	parentPort.addListener("message", handleIpcMessage);
	addIpcMessageHandler("notification", ({ type, message }) => {
		console.log("(Worker thread) Received notification from main thread:", type, message);

		makeIpcRequest(parentPort, "generateGreeting", "World").then(result => {
			console.log("Received greeting result from main thread", result);
		})
		.catch(e => {
			console.error("Error making IPC request to main thread", e);
		});
	});
}

