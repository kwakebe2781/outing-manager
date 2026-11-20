import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: { type: "spki", format: "jwk" },
  privateKeyEncoding: { type: "pkcs8", format: "jwk" }
});

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}
const x = Buffer.from(publicKey.x, "base64url");
const y = Buffer.from(publicKey.y, "base64url");
const publicRaw = Buffer.concat([Buffer.from([4]), x, y]).toString("base64url");

console.log("\nVAPID_PUBLIC_KEY=" + publicRaw);
console.log("VAPID_PRIVATE_JWK=" + JSON.stringify(privateKey));
console.log("VAPID_SUBJECT=mailto:YOUR-CONTACT-EMAIL\n");
console.log("Store VAPID_PRIVATE_JWK as a Worker secret. Never commit it.");