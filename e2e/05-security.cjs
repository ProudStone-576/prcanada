const { chromium } = require('playwright'); const { execSync } = require('child_process');
const B='http://localhost:3000';
const { PrismaClient } = require('../node_modules/@prisma/client'); const db = new PrismaClient();
const results=[]; const check=(name, ok, detail='')=>results.push(`${ok?'PASS':'FAIL'}  ${name}${detail?'  ('+detail+')':''}`);
(async()=>{
  await db.rateEvent.deleteMany({});
  const b=await chromium.launch();
  // 1. CSP nonce
  const r1=await fetch(B+'/'); const r2=await fetch(B+'/');
  const c1=r1.headers.get('content-security-policy')||''; const c2=r2.headers.get('content-security-policy')||'';
  const n1=(c1.match(/'nonce-([^']+)'/)||[])[1]; const n2=(c2.match(/'nonce-([^']+)'/)||[])[1];
  check('page CSP has a nonce', !!n1); check('nonce changes per request', n1 && n1!==n2);
  check("no 'unsafe-inline' for scripts", !/script-src[^;]*unsafe-inline/.test(c1));
  check("no 'unsafe-eval' in production", !/unsafe-eval/.test(c1));
  const html=await r1.text(); const scripts=[...html.matchAll(/<script\b[^>]*>/g)].map(m=>m[0]);
  check('every script tag carries the nonce', scripts.length>0 && scripts.every(s=>s.includes(`nonce="${n1}"`)), `${scripts.length} tags`);
  for (const h of ['x-frame-options','x-content-type-options','referrer-policy','strict-transport-security','permissions-policy']) check(`header ${h}`, !!r1.headers.get(h));
  const api=await fetch(B+'/api/export'); check('API has locked-down CSP', /default-src 'none'/.test(api.headers.get('content-security-policy')||''));
  check('signed-out export refused', api.status===401);
  // page renders and hydrates under the CSP
  const p=await b.newPage(); const errs=[]; p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  await p.goto(B+'/crs'); await p.getByLabel('Age',{exact:true}).fill('35'); await p.waitForTimeout(500);
  check('app runs under the CSP (no violations, calculator reacts)', errs.filter(e=>/Content Security Policy|CSP/.test(e)).length===0 && /Age 35/.test(await p.locator('.calc__result').innerText()), errs.slice(0,1).join(''));
  // 2. signed-out access
  for (const path of ['/dashboard','/assessment','/documents','/history','/account','/notifications','/assistant']) { const res=await fetch(B+path,{redirect:'manual'}); check(`signed-out ${path} redirects to login`, (res.status===307||res.status===303||res.status===302) && /\/login/.test(res.headers.get('location')||''), String(res.status)); }
  const rv=await fetch(B+'/review',{redirect:'manual'}); check('signed-out /review not reachable', rv.status!==200, String(rv.status));
  // 3. cron secret
  check('cron rejects missing secret', (await fetch(B+'/api/cron/notify',{method:'POST'})).status===401);
  check('cron rejects wrong secret', (await fetch(B+'/api/cron/notify',{method:'POST',headers:{authorization:'Bearer wrong-secret-of-some-length-xx'}})).status===401);
  // 4. signup, cookie flags, open redirect
  const ctx=await b.newContext(); const q=await ctx.newPage(); const email=`sec${Date.now()}@example.com`;
  await q.goto(B+'/signup'); await q.fill('#email',email); await q.fill('#password','long enough password'); await q.check('input[name=consent]'); await q.click('button[type=submit]'); await q.waitForURL('**/assessment**');
  const ck=(await ctx.cookies()).find(c=>c.name==='prpath_session');
  check('session cookie HttpOnly, SameSite=Lax, Secure in production', ck && ck.httpOnly && ck.sameSite==='Lax' && ck.secure, JSON.stringify({h:ck?.httpOnly,s:ck?.sameSite,sec:ck?.secure}));
  check('session token is not stored in plain text', (await db.session.count({ where: { tokenHash: ck.value } }))===0);
  await ctx.clearCookies();
  for (const evil of ['//evil.example','/\\\\evil.example','/%2F%2Fevil.example','https://evil.example']) {
    await q.goto(B+'/login?next='+encodeURIComponent(evil)); await q.fill('#email',email); await q.fill('#password','long enough password'); await q.click('button[type=submit]'); await q.waitForLoadState('load'); await q.waitForTimeout(800);
    check(`login next=${evil} stays on site`, new URL(q.url()).host==='localhost:3000', q.url()); await ctx.clearCookies();
  }
  // 5. password reset limit: 5 requests for one email -> at most 3 tokens, same answer every time
  const answers=new Set();
  for (let i=0;i<5;i++){ await q.goto(B+'/forgot-password'); await q.fill('#email',email); await q.click('button[type=submit]'); await q.waitForSelector('.notice--ok'); answers.add(await q.locator('.notice--ok').innerText()); }
  const tokens=String(await db.passwordResetToken.count({ where: { user: { email } } }));
  check('reset emails limited to 3 per hour per address', tokens==='3', `${tokens} tokens`); check('reset answer identical whether limited or not', answers.size===1);
  // 6. signup limit per network
  let blocked=false; for (let i=0;i<12 && !blocked;i++){ const c2=await b.newContext(); const s=await c2.newPage(); await s.goto(B+'/signup'); await s.fill('#email',`lim${i}${Date.now()}@example.com`); await s.fill('#password','long enough password'); await s.check('input[name=consent]'); await s.click('button[type=submit]'); await s.waitForTimeout(1200); if (await s.locator('.notice--error').count()) blocked=/Too many accounts/.test(await s.locator('.notice--error').innerText()); await c2.close(); }
  check('signups limited per network', blocked);
  // 7. forged X-Forwarded-For can't dodge the limit
  console.log(results.join('\n'));
  await b.close(); await db.$disconnect();
})().catch(e=>{console.log(results.join('\n'));console.error('FAIL',e.message.slice(0,400));process.exit(1)});
