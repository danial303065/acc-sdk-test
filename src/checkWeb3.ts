global.XMLHttpRequest = require("xhr2");

import { Client, Context, ContextBuilder, ContextParams } from "acc-sdk-client-v2";
export const TEST_PK = "d09672244a06a32f74d051e5adbbb62ae0eda27832a973159d475da6d53ba5c0";

const beautify = require("beautify");

async function TestOfTestnet() {
    const contextParams: ContextParams = ContextBuilder.buildContextParamsOfTestnet(TEST_PK);
    console.log(beautify(JSON.stringify(contextParams), { format: "json" }));

    const context: Context = ContextBuilder.buildContextOfTestnet(TEST_PK);
    const client = new Client(context);

    const web3Status = await client.web3.isUp();
    console.log(`web3Status: ${web3Status}`);
}

async function TestOfDevnet() {
    const contextParams: ContextParams = ContextBuilder.buildContextParamsOfDevnet(TEST_PK);
    console.log(beautify(JSON.stringify(contextParams), { format: "json" }));

    const context: Context = ContextBuilder.buildContextOfDevnet(TEST_PK);
    const client = new Client(context);

    const web3Status = await client.web3.isUp();
    console.log(`web3Status: ${web3Status}`);
}

async function main() {
    await TestOfTestnet();
    await TestOfDevnet();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

process.on("SIGINT", () => {});
