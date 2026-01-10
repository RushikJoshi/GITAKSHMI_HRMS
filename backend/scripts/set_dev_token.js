(async () => {
  try {
    const fetch = globalThis.fetch || (await import('node-fetch')).default;
    const body = JSON.stringify({ companyCode: 'goo001', email: 'google@gmail.com', password: 'admin123' });
    const r = await fetch('https://hrms.gitakshmi.com/api/auth/login-hr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const data = await r.json();
    if (!data.token) {
      console.error('No token in response:', data);
      process.exit(1);
    }
    console.log('Got token:', String(data.token).slice(0, 40) + '...');
    const fs = require('fs');
    const path = require('path');
    const envFile = path.join(__dirname, '..', '..', 'frontend', '.env');
    let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
    // replace or append VITE_DEV_HR_TOKEN
    if (/^VITE_DEV_HR_TOKEN=/m.test(env)) {
      env = env.replace(/^VITE_DEV_HR_TOKEN=.*/m, `VITE_DEV_HR_TOKEN=${data.token}`);
    } else {
      if (env.length && !env.endsWith('\n')) env += '\n';
      env += `VITE_DEV_HR_TOKEN=${data.token}\n`;
    }
    fs.writeFileSync(envFile, env, 'utf8');
    console.log('Wrote VITE_DEV_HR_TOKEN to frontend/.env (path=', envFile, ')');
  } catch (e) {
    console.error('Failed to set dev token:', e.message);
    process.exit(1);
  }
})();
