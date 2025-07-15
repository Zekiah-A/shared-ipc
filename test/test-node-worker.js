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
		console.log("(Main thread) Received request to generate greeting for name:", name);
		return `Hello, ${name}!`;
	});

	const worker = new Worker(fileName);
	worker.addListener("message", (data) => handleIpcMessage(data, worker));
	worker.addListener("online", () => {
		console.log("(Main thread) Sending a notification to the worker thread...");
		sendIpcMessage(worker, "notification", { type: "alert", message: "Something happened!" });
	});
}
else {
	parentPort.addListener("message", handleIpcMessage);
	addIpcMessageHandler("notification", ({ type, message }) => {
		console.log("(Worker thread) Received a notification of type", type, "from main thread:", message);

		makeIpcRequest(parentPort, "generateGreeting", "World").then(result => {
			console.log("(Worker thread) Received greeting from main thread:", result);
		})
		.catch(e => {
			console.error("Error making IPC request to main thread", e);
		});
	});
}

