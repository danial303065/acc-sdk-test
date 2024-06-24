import { HTTPClient } from "./utils/HttpClient";
import { Amount } from "./utils/Amount";
import URI from "urijs";

import fs from "fs";

global.XMLHttpRequest = require("xhr2");

import { Client, Context, ContextBuilder, ContextParams, NormalSteps } from "acc-sdk-client-v2";
import assert from "assert";
export const TEST_PK = "d09672244a06a32f74d051e5adbbb62ae0eda27832a973159d475da6d53ba5c0";

const beautify = require("beautify");

interface IUserData {
    idx: number;
    phone: string;
    address: string;
    privateKey: string;
    loyaltyType: number;
}

export interface IShopData {
    shopId: string;
    name: string;
    currency: string;
    address: string;
    privateKey: string;
}

export class TestUtils {
    static RELAY_ACCESS_KEY = "0x2c93e943c0d7f6f1a42f53e116c52c40fe5c1b428506dc04b290f2a77580a342";
    static purchaseId = 0;
    public static getPurchaseId(): string {
        const randomIdx = Math.floor(Math.random() * 1000);
        const res = "P" + TestUtils.purchaseId.toString().padStart(10, "0") + randomIdx.toString().padStart(4, "0");
        TestUtils.purchaseId++;
        return res;
    }
    public static delay(interval: number): Promise<void> {
        return new Promise<void>((resolve, _) => {
            setTimeout(resolve, interval);
        });
    }
}

async function main() {
    const contextParams: ContextParams = ContextBuilder.buildContextParamsOfDevnet(TEST_PK);
    console.log(beautify(JSON.stringify(contextParams), { format: "json" }));

    const context: Context = ContextBuilder.buildContextOfDevnet(TEST_PK);
    const client = new Client(context);
    const users: IUserData[] = JSON.parse(fs.readFileSync("src/data/users.json", "utf8"));
    const shops: IShopData[] = JSON.parse(fs.readFileSync("src/data/shops.json", "utf8"));
    const user: IUserData = users[0];
    client.usePrivateKey(user.privateKey);

    const httpClient = new HTTPClient({
        headers: {
            Authorization: TestUtils.RELAY_ACCESS_KEY,
        },
    });

    for (let idx = 0; idx < 10; idx++) {
        console.log(`idx: ${idx}`);
        const oldBalance = await client.ledger.getPointBalance(user.address);
        const purchase = {
            purchaseId: TestUtils.getPurchaseId(),
            timestamp: 1672844400,
            amount: 100,
            method: 0,
            currency: "php",
            shopIndex: 0,
            userIndex: 0,
        };
        const amount = Amount.make(purchase.amount, 18);

        const feeRate = await client.ledger.getFeeRate();
        const paidPoint = await client.currency.currencyToPoint(amount.value, purchase.currency);
        const feePoint = await client.currency.currencyToPoint(amount.value.mul(feeRate).div(10000), purchase.currency);

        // Open New
        console.log("Open New");
        const url1 = URI(contextParams.relayEndpoint).directory("/v1/payment/new").filename("open").toString();
        const params1 = {
            purchaseId: purchase.purchaseId,
            amount: amount.toString(),
            currency: purchase.currency.toLowerCase(),
            shopId: shops[purchase.shopIndex].shopId,
            account: user.address,
        };
        const response1 = await httpClient.post(url1, params1);
        if (response1.data.code !== 0) {
            console.error("Error!", response1.data.error.message);
            process.exit(response1.data.code);
        }

        const paymentId = response1.data.data.paymentId;
        console.log(paymentId);

        await TestUtils.delay(1000);

        let detail = await client.ledger.getPaymentDetail(paymentId);

        // Approve New
        console.log("Approve New");
        client.usePrivateKey(user.privateKey);
        for await (const step of client.ledger.approveNewPayment(
            paymentId,
            detail.purchaseId,
            amount.value,
            detail.currency.toLowerCase(),
            detail.shopId,
            true
        )) {
            switch (step.key) {
                case NormalSteps.PREPARED:
                    console.log("NormalSteps.PREPARED");
                    break;
                case NormalSteps.SENT:
                    console.log("NormalSteps.SENT");
                    break;
                case NormalSteps.APPROVED:
                    console.log("NormalSteps.APPROVED");
                    break;
                default:
                    throw new Error("Unexpected pay point step: " + JSON.stringify(step, null, 2));
            }
        }

        await TestUtils.delay(3000);

        // Close New
        console.log("Close New");
        const url2 = URI(contextParams.relayEndpoint).directory("/v1/payment/new").filename("close").toString();
        const params2 = {
            confirm: true,
            paymentId,
        };
        const response2 = await httpClient.post(url2, params2);
        if (response2.data.code !== 0) {
            console.error("Error!", response2.data.error.message);
            process.exit(response2.data.code);
        }

        await TestUtils.delay(2000);

        assert.deepStrictEqual(
            await client.ledger.getPointBalance(user.address),
            oldBalance.sub(paidPoint).sub(feePoint)
        );
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

process.on("SIGINT", () => {});
