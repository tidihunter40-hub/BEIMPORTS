import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Nova senha do painel: ', password => {
  rl.close();
  if (password.length < 12) { console.error('Use pelo menos 12 caracteres.'); process.exitCode = 1; return; }
  const salt = randomBytes(16).toString('hex');
  console.log(`scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
});
