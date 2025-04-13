import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
	input: "src/index.js",
	output: {
		file: "dist/index.js",
		format: "umd",
		name: "SimpleIPC"
	},
	plugins: [
		nodeResolve(),
		typescript({
			declaration: true,
			declarationDir: "dist",
			allowJs: true,
			checkJs: true
		})
	]
};