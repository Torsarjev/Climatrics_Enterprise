import 'server-only';
import QRCode from 'qrcode';
import { otpauthUri, totpSecret } from './auth';

export async function authenticatorSetup(userId: string, email: string) {
  const uri = otpauthUri(userId, email);
  return { qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), key: totpSecret(userId).replace(/(.{4})/g, '$1 ').trim() };
}
