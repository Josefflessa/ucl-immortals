import { webcrypto } from 'node:crypto';

const pair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
const privateJwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);

if (!publicJwk.x || !publicJwk.y || !privateJwk.d) {
  throw new Error('Não foi possível exportar as chaves VAPID.');
}

const publicKey = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(publicJwk.x, 'base64url'),
  Buffer.from(publicJwk.y, 'base64url'),
]).toString('base64url');

console.log([
  'VAPID_SUBJECT=mailto:SEU_EMAIL_DE_CONTATO',
  `VAPID_PUBLIC_KEY=${publicKey}`,
  `VAPID_PRIVATE_KEY=${privateJwk.d}`,
].join('\n'));
