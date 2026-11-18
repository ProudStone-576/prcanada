const { chromium } = require('playwright'); const { execSync } = require('child_process');
const B='http://localhost:3000', S=__dirname+'/.shots/';
const SECRET=(require('fs').readFileSync(require('path').join(__dirname,'..','.env'),'utf8').match(/CRON_SECRET="([^"]+)"/)||[])[1]||process.env.CRON_SECRET;
async function signup(b, email){const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();await p.goto(B+'/signup');await p.waitForLoadState('networkidle');await p.fill('#email',email);await p.fill('#password','long enough password');await p.check('input[name=consent]');await p.click('button[type=submit]');await p.waitForURL('**/assessment**');return p;}
(async()=>{const b=await chromium.launch();
const errs=[];
// normal user with a permit expiring in ~53 days
const u=await signup(b,`n${Date.now()}@example.com`); u.on('pageerror',e=>errs.push(e.message));
await u.getByLabel('Date of birth').fill('1997-05-02'); await u.getByLabel('Marital status').selectOption('single'); await u.click('text=Save and continue'); await u.waitForURL('**step=status');
await u.getByLabel('Which describes you best?').selectOption('pgwp'); await u.getByLabel('Current permit expiry date').fill('2027-01-10'); await u.click('text=Save and continue'); await u.waitForURL('**step=education');
console.log('normal user /review ->', (await u.goto(B+'/review')).status());
// reviewer: login may already exist from earlier run
const r=await signup(b,'reviewer@example.com').catch(async()=>{const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();await p.goto(B+'/login');await p.fill('#email','reviewer@example.com');await p.fill('#password','long enough password');await p.click('button[type=submit]');await p.waitForURL('**/dashboard');return p;});
r.on('pageerror',e=>errs.push(e.message));
await r.goto(B+'/review'); console.log('reviewer nav has Review:', await r.locator('nav.topnav a:has-text("Review")').count());
const card=r.locator('article:has(h3:text("Test program page"))').first();
console.log('diff shows:', (await card.locator('.diff').innerText()).replace(/\n/g,' | '));
await r.screenshot({path:S+'review.png',fullPage:true});
await card.getByRole('button',{name:'Publish an update'}).click();
await card.getByLabel('Kind').selectOption('stream_status'); await card.getByLabel('Status').selectOption('in_effect');
await card.getByLabel('Title').fill('Test program intake reopened'); await card.getByLabel('What changed, in plain words').fill('The test program reopened intake for all applicants on November 18, 2026.');
await card.getByLabel('Official source').fill('https://www.canada.ca/en/immigration-refugees-citizenship/news.html'); await card.getByLabel('Effective on').fill('2026-12-01'); await card.getByRole('button',{name:'Publish',exact:true}).click();
await card.locator('p[aria-live]').filter({hasText:/./}).waitFor(); console.log('future in_effect ->', await card.locator('p[aria-live]').innerText());
await card.getByLabel('Status').selectOption('announced'); await card.getByRole('button',{name:'Publish',exact:true}).click();
await r.waitForTimeout(1500); console.log('announced ->', await card.locator('p[aria-live]').innerText().catch(()=>'(card gone)'));
await u.goto(B+'/updates'); const up=await u.locator('main').innerText();
console.log('updates page announced section has it:', /Announced, not yet in effect[\s\S]*Test program intake reopened[\s\S]*Takes effect 2026-12-01/.test(up), '| seeded CRS in effect:', /In effect since 2026-11-03/.test(up));
await u.screenshot({path:S+'updates.png',fullPage:true});
console.log('user nav:', await u.locator('nav.topnav a:has-text("Alerts")').innerText());
// notify job twice
const run=()=>execSync(`curl -s -X POST ${B}/api/cron/notify -H "Authorization: Bearer ${SECRET}"`).toString();
console.log('notify 1:', run()); console.log('notify 2:', run());
await u.goto(B+'/notifications'); console.log('inbox:', await u.locator('main li strong').allInnerTexts());
await u.screenshot({path:S+'notifications.png',fullPage:true});
// opt in to email; new reminder emailed next time a threshold is crossed (simulate with custom deadline tomorrow)
await u.goto(B+'/account'); await u.getByLabel(/Email me deadline reminders/).check(); await u.waitForTimeout(800);
await u.goto(B+'/dashboard'); await u.locator('summary:has-text("Add your own reminder")').click(); await u.fill('#dl-title','Biometrics appointment'); await u.fill('#dl-date','2026-11-19'); await u.click('button:has-text("Add reminder")'); await u.waitForTimeout(800);
console.log('notify 3:', run());
const log=require('fs').readFileSync(process.env.SERVER_LOG || 'server.log','utf8'); console.log('email logged:', /Subject: PRPath Canada: Biometrics appointment tomorrow/.test(log));
await u.goto(B+'/assistant'); console.log('assistant page:', await u.locator('h2').first().innerText());
console.log('errors', errs);
await b.close();})().catch(e=>{console.error('FAIL',e.message.slice(0,500));process.exit(1)});
