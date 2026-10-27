// Retenção (PRD §17.5): tentativa de login fora das 24 h sai; a recente fica.

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { applyRetention, closePool, getPool, query } from "../src/index";

const EMAIL = "retencao@tako.dev";
let online = false;

before(async () => {
  try {
    await getPool().query("select 1");
    online = true;
  } catch {
    online = false;
  }
});

after(async () => {
  if (online) await query("delete from login_attempts where email = $1", [EMAIL]);
  await closePool();
});

describe("retenção", () => {
  it("apaga tentativa com mais de 24 horas e mantém a recente", async (t) => {
    if (!online) return t.skip("sem banco");
    await query("delete from login_attempts where email = $1", [EMAIL]);
    await query(
      `insert into login_attempts (email, ip, succeeded, created_at) values
        ($1, '198.51.100.50', false, now() - interval '25 hours'),
        ($1, '198.51.100.50', false, now() - interval '1 hour')`,
      [EMAIL],
    );
    const result = await applyRetention();
    assert.ok(result.loginAttempts >= 1);
    const left = await query<{ succeeded: boolean }>("select succeeded from login_attempts where email = $1", [EMAIL]);
    assert.equal(left.length, 1);
  });
});
