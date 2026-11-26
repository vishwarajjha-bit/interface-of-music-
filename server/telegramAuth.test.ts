import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSafeTrackSlug,
  getConfiguredMirrors,
  isAllowedExternalBaseUrl,
  isTelegramChatAdmin,
  parseStartParam,
  verifyTelegramInitData,
} from './telegramAuth';

function signTestInitData(fields: Record<string, string>, botToken: string): string {
  const params = new URLSearchParams(fields);
  const pairs: string[] = [];
  params.forEach((v, k) => pairs.push(`${k}=${v}`));
  pairs.sort((a, b) => a.localeCompare(b));
  const checkString = pairs.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('parseStartParam extracts group chatId for vc_ deep links', () => {
  assert.deepEqual(parseStartParam('vc_-1001982736451'), {
    mode: 'vc',
    chatId: '-1001982736451',
  });
  assert.deepEqual(parseStartParam('personal'), {
    mode: 'personal',
    chatId: null,
  });
  assert.deepEqual(parseStartParam(null), {
    mode: 'personal',
    chatId: null,
  });
});

test('verifyTelegramInitData validates authentic HMAC and rejects tampering or expiry', () => {
  const token = '123456:TEST_BOT_TOKEN_FOR_UNIT_TESTS';
  const nowSec = Math.floor(Date.now() / 1000);
  const validInit = signTestInitData(
    {
      auth_date: String(nowSec),
      start_param: 'vc_-100123456',
      user: JSON.stringify({ id: 987654, first_name: 'Ritesh', username: 'ritesh_admin' }),
    },
    token
  );

  const ok = verifyTelegramInitData(validInit, token);
  assert.equal(ok.valid, true);
  assert.equal(ok.user?.id, 987654);
  assert.equal(ok.startParam, 'vc_-100123456');

  const tampered = validInit.replace('987654', '111111');
  assert.equal(verifyTelegramInitData(tampered, token).valid, false);

  const expired = signTestInitData(
    {
      auth_date: String(nowSec - 100000),
      user: JSON.stringify({ id: 987654 }),
    },
    token
  );
  assert.equal(verifyTelegramInitData(expired, token).valid, false);
});

test('isTelegramChatAdmin allows only creator and administrator', () => {
  assert.equal(isTelegramChatAdmin('creator'), true);
  assert.equal(isTelegramChatAdmin('administrator'), true);
  assert.equal(isTelegramChatAdmin('member'), false);
  assert.equal(isTelegramChatAdmin('restricted'), false);
  assert.equal(isTelegramChatAdmin(undefined), false);
});

test('getConfiguredMirrors filters unsafe local targets and preserves 4 riteshyt mirrors', () => {
  const defaults = getConfiguredMirrors('');
  assert.equal(defaults.length, 4);
  assert.equal(defaults[0], 'https://www.riteshyt.in');
  assert.equal(isAllowedExternalBaseUrl('http://127.0.0.1:8080'), false);
  assert.equal(isAllowedExternalBaseUrl('http://169.254.169.254/latest'), false);
  assert.equal(isAllowedExternalBaseUrl('https://api.riteshyt.in'), true);
  assert.equal(buildSafeTrackSlug('../../etc/passwd'), '______etc_passwd');
});
