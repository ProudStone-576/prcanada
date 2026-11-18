const { chromium } = require('playwright');
const B='http://localhost:3000', S=__dirname+'/.shots/', F=__dirname+'/fixtures/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
const email=`d${Date.now()}@example.com`;
await p.goto(B+'/signup'); await p.fill('#name','Asha'); await p.fill('#email',email); await p.fill('#password','long enough password'); await p.check('input[name=consent]'); await p.click('button[type=submit]'); await p.waitForURL('**/assessment**');
// minimal profile
await p.getByLabel('Date of birth').fill('1997-05-02'); await p.getByLabel('Marital status').selectOption('single'); await p.click('text=Save and continue'); await p.waitForURL('**step=status');
await p.getByLabel('Which describes you best?').selectOption('pgwp'); await p.getByLabel('Current permit expiry date').fill('2027-03-01'); await p.click('text=Save and continue'); await p.waitForURL('**step=education');
await p.goto(B+'/assessment?step=language'); const sec=p.locator('section:has(h2:text("English test"))'); await sec.locator('select').first().selectOption('ielts_gt');
await sec.getByLabel('Test date').fill('2026-01-10'); await sec.getByLabel('Listening').fill('8'); await sec.getByLabel('Reading').fill('7'); await sec.getByLabel('Writing').fill('7'); await sec.getByLabel('Speaking').fill('7'); await p.click('text=Save and continue'); await p.waitForURL('**step=work');
await p.click('text=Add a job'); const job=p.locator('.job').first(); await job.getByLabel('Job title').fill('Developer'); await job.getByLabel('Employer').fill('Northern Lights'); await job.getByLabel('Start date').fill('2024-09-01'); await job.getByLabel('I still work here').check(); await job.getByLabel('Hours a week').fill('37.5'); await p.click('text=Save and continue'); await p.waitForURL('**step=location');
// upload without consent -> refused
await p.goto(B+'/documents');
await p.selectOption('#doc-type','work_permit'); await p.setInputFiles('#doc-file',F+'permit.pdf'); await p.click('button:has-text("Upload")');
console.log('no consent:', await p.locator('.notice--error').first().innerText());
for (const [t,f] of [['work_permit','permit'],['language_test','ielts'],['employment_letter','letter'],['refusal_letter','refusal']]) {
  await p.selectOption('#doc-type',t); await p.setInputFiles('#doc-file',F+f+'.pdf'); await p.check('input[name=consent]'); await p.click('button:has-text("Upload")'); await p.waitForSelector('.notice--ok'); await p.waitForTimeout(800);
}
// non-PDF disguised
await p.selectOption('#doc-type','other'); await p.setInputFiles('#doc-file',{name:'evil.pdf',mimeType:'application/pdf',buffer:Buffer.from('MZ not a pdf at all')}); await p.check('input[name=consent]'); await p.click('button:has-text("Upload")'); await p.waitForTimeout(800);
console.log('disguised:', await p.locator('.notice--error').first().innerText().catch(()=>'none'));
await p.reload(); await p.locator('details.rec').first().waitFor();
const sums=await p.locator('details.rec summary').allInnerTexts(); console.log('docs:', sums.map(s=>s.replace(/\s+/g,' ')));
for (const d of await p.locator('details.rec').all()) await d.evaluate(e=>e.open=true);
const body=await p.locator('main').innerText();
console.log('finds permit mismatch:', /seems to expire on 2027-06-01/.test(body), '| score mismatch:', /differ from your profile for reading/.test(body), '| hours mismatch:', /40 hours a week; your profile says 37.5/.test(body));
await p.screenshot({path:S+'documents.png',fullPage:true});
// download own doc, other user's access
const href=await p.locator('a:has-text("Download")').first().getAttribute('href');
const own=await p.request.get(B+href); console.log('own download', own.status(), (await own.body()).slice(0,5).toString());
const ctx2=await b.newContext(); const q=await ctx2.newPage();
await q.goto(B+'/signup'); await q.fill('#email','o'+email); await q.fill('#password','another long password'); await q.check('input[name=consent]'); await q.click('button[type=submit]'); await q.waitForURL('**/assessment**');
console.log('other user download', (await q.request.get(B+href)).status(), '| anon', (await (await b.newContext()).request.get(B+href)).status());
// cross-site upload refused
const xs=await p.request.post(B+'/api/documents',{headers:{origin:'https://evil.example'},multipart:{docType:'other',consent:'on',file:{name:'a.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 x')}}}); console.log('cross-site', xs.status());
// refusal from uploaded letter
await p.goto(B+'/refusal'); await p.selectOption('#rf-doc',{index:1}); await p.fill('#rf-date','2026-11-10'); await p.selectOption('#rf-where','in_canada'); await p.click('text=Analyze the letter');
await p.locator('h2:has-text("What was refused")').first().waitFor(); const rt=await p.locator('main').innerText();
console.log('refusal type:', /Post-graduation work permit/.test(rt), '| JR 2026-11-25:', rt.includes('2026-11-25'), '| restoration 2027-02-08:', rt.includes('2027-02-08'));
await p.screenshot({path:S+'refusal.png',fullPage:true});
await p.goto(B+'/work-permits'); await p.screenshot({path:S+'work-permits.png',fullPage:true});
console.log('status advice:', await p.locator('#st-h ~ ul li strong').allInnerTexts());
// export includes documents
const ex=await (await p.request.get(B+'/api/export')).json(); console.log('export docs', ex.documents.length, 'refusals', ex.refusalAnalyses.length);
console.log('errors', errs);
await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
