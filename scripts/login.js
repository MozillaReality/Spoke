import readline from "readline";
import { Socket } from "phoenix-channels";
import { writeFileSync } from "fs";
import uuid from "uuid";
import fetch from "node-fetch";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = q => new Promise(res => rl.question(q, res));

(async () => {
  console.log("Logging into Hubs Cloud.\n");
  const host = await ask("Host (eg hubs.mozilla.com): ");
  if (!host) {
    console.log("Invalid host.");
    process.exit(1);
  }

  const url = `https://${host}/api/v1/meta`;

  try {
    const res = await fetch(url);
    const meta = await res.json();

    console.log(meta);

    if (!meta.phx_host) {
      throw new Error();
    }
  } catch (e) {
    console.log("Sorry, that doesn't look like a Hubs Cloud server.");
    process.exit(0);
  }

  const email = await ask("Your admin account email (eg admin@yoursite.com): ");
  console.log(`Logging into ${host} as ${email}. Click on the link in your email to continue.`);

  const socketUrl = `wss://${host}/socket`;
  const socket = new Socket(socketUrl, { params: { session_id: uuid() }, logger: (...args) => console.log(...args) });
  socket.connect();

  const channel = socket.channel(`auth:${uuid()}`);

  await new Promise((resolve, reject) =>
    channel
      .join()
      .receive("ok", resolve)
      .receive("error", err => {
        reject(err);
      })
  );

  const { credentials: token } = await new Promise(resolve => channel.on("auth_credentials", resolve));

  channel.push("auth_request", { email, origin: "spoke" });

  const creds = {
    host,
    email,
    token
  };

  writeFileSync(".ret.credentials", JSON.stringify(creds));
  rl.close();
  console.log("Login successful.\nCredentials written to .ret.credentials. Run yarn logout to remove credentials.");
  process.exit(0);
})();
