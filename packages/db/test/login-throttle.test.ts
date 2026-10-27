import test from "node:test";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { closePool, getPool, loginThrottle, query, recordLoginAttempt } from "../src/index";

let online = false;
const EMAIL = "throttle@tako.dev";
const IP = "203.0.113.10";

before(async () => {
  try {
    await getPool().query("select 1");
    online = true;
  } catch {
    online = false;
  }
});

after(async () => {
  if (!online) return;
  await query("delete from login_attempts where email = $1 or ip = $2", [EMAIL, IP]);
  await closePool();
});

describe("limite de tentativas de login", () => {
  it("bloqueia depois de cinco falhas na janela", async (t) => {
    if (!online) return t.skip("sem banco");
    await query("delete from login_attempts where email = $1 or ip = $2", [EMAIL, IP]);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordLoginAttempt({ email: EMAIL, ip: IP, succeeded: false });
    }
    const throttle = await loginThrottle({ email: EMAIL, ip: null });
    assert.equal(throttle.blocked, true);
    assert.equal(throttle.failures, 5);
    assert.ok(throttle.retryAfterMinutes >= 1);
  });

  it("sucesso limpa as falhas daquele e-mail", async (t) => {
    if (!online) return t.skip("sem banco");
    await recordLoginAttempt({ email: EMAIL, ip: IP, succeeded: true });
    const throttle = await loginThrottle({ email: EMAIL, ip: null });
    assert.equal(throttle.blocked, false);
  });

  it("outro e-mail do mesmo IP não herda o bloqueio do e-mail anterior", async (t) => {
    if (!online) return t.skip("sem banco");
    await query("delete from login_attempts where email = $1 or ip = $2", [EMAIL, IP]);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await recordLoginAttempt({ email: "outro@tako.dev", ip: "198.51.100.7", succeeded: false });
    }
    const throttle = await loginThrottle({ email: EMAIL, ip: null });
    assert.equal(throttle.blocked, false);
    await query("delete from login_attempts where email = 'outro@tako.dev' or ip = '198.51.100.7'");
  });
});
