/** Record the real local UI with test fixtures. Never connect this script to production. */
import { chromium, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { quizFixtureApi } from "../e2e/quiz-fixtures";

async function main() {
const base = "http://127.0.0.1:3137";
const output = resolve("landing/.recording");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const probe = process.argv.includes("--probe");
const requests: string[] = [];
const errors: string[] = [];

async function prepare(page: Page) {
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) { requests.push(`BLOCKED ${url.origin}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) { requests.push(`UNHANDLED ${url.pathname}`); return route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"demo_unhandled_request"}' }); }
    return route.continue();
  });
  const state = await quizFixtureApi(page);
  state.path.name = "Materiał czy rozmowa?";
  state.path.draft.name = state.path.name;
  const question = state.path.draft.graph.nodes.find(n => n.id === "wybor");
  if (question?.type === "question") question.text = "Czego teraz potrzebujesz w swoim projekcie?";
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = `html{scroll-behavior:smooth}body{padding-bottom:115px!important}#demo-caption{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#020304;color:#f8f7f3;padding:18px 34px 20px;border-top:4px solid #00d6d8;font-family:Inter,Arial,sans-serif;display:flex;justify-content:space-between;align-items:center;gap:25px}#demo-caption strong{font-size:25px;line-height:1.25;letter-spacing:-.025em}#demo-caption small{display:block;color:#00d6d8;font:12px/1.6 'IBM Plex Mono',monospace;margin-bottom:5px}#demo-caption span{font:11px/1.7 'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}#demo-pointer{position:fixed;width:22px;height:22px;border:3px solid #6550e8;border-radius:50%;background:#f8f7f3aa;z-index:100000;pointer-events:none;left:0;top:0;transform:translate(-50%,-50%)}`;
      document.head.append(style);
      const caption = document.createElement("div"); caption.id="demo-caption";
      const text=document.createElement("div"), label=document.createElement("small"), title=document.createElement("strong"), note=document.createElement("span");
      label.textContent="INSTASCALER / GENIUS@WORK";title.textContent="Od komentarza do rozmowy.";
      note.innerText="PRAWDZIWY PANEL\nDANE DEMONSTRACYJNE";
      text.append(label,title);caption.append(text,note);document.body.append(caption);
      const pointer=document.createElement("div");pointer.id="demo-pointer";document.body.append(pointer);
      document.addEventListener("mousemove",event=>{pointer.style.left=`${event.clientX}px`;pointer.style.top=`${event.clientY}px`;});
    });
  });
}
async function chapter(page: Page, label: string, title: string) {
  await page.evaluate(({label,title})=>{document.querySelector("#demo-caption small")!.textContent=label;document.querySelector("#demo-caption strong")!.textContent=title;},{label,title});
  await page.evaluate(()=>document.fonts.ready);
}
async function click(page: Page, name: string) {
  const target=page.getByRole("button",{name,exact:true});
  await target.evaluate(el=>el.scrollIntoView({block:"center"}));
  const rect=await target.boundingBox();
  if(rect)await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2,{steps:35});
  await page.waitForTimeout(450);await target.click();await page.waitForTimeout(1200);
}

try {
  for (const scene of ["campaign","path","preview","contacts"]) {
    const context=await browser.newContext({ viewport:{width:1440,height:960},recordVideo:probe?undefined:{dir:output,size:{width:1440,height:960}},reducedMotion:"reduce" });
    const page=await context.newPage();await prepare(page);
    const route=scene==="campaign"?"/campaigns/campaign1/edit":scene==="contacts"?"/paths/contacts":"/paths/demo";
    await page.goto(base+route,{waitUntil:"networkidle"});
    if(scene==="campaign") {
      await page.getByLabel(/Nazwa kampanii/).waitFor();
      await chapter(page,"01 / TWOJA KAMPANIA","Wybierz hasło. Przygotuj wiadomość.");
    } else if(scene==="path") {
      await page.getByRole("button",{name:"Podgląd",exact:true}).waitFor();
      await chapter(page,"02 / ŚCIEŻKA ROZMOWY","Połącz pytania i kolejne kroki.");
      await page.mouse.move(950,500);await page.mouse.wheel(0,360);
    } else if(scene==="preview") {
      await click(page,"Podgląd");
      await chapter(page,"03 / PODGLĄD PRZED PUBLIKACJĄ","Przejdź rozmowę oczami odbiorcy.");
      await page.mouse.move(1200,600);await page.mouse.wheel(0,480);
    } else {
      await page.getByRole("heading",{name:"@anna",exact:true}).waitFor();
      await chapter(page,"04 / KONTEKST DO DALSZEJ ROZMOWY","Odpowiedzi, tagi i kontakty w jednym miejscu.");
    }
    await page.waitForTimeout(1000);
    await page.screenshot({path:resolve(output,`${scene}.png`)});
    if (!probe) {
      // Clip starts only after the screen is ready; the local render removes navigation/loading.
      const started=Date.now();
      await page.waitForTimeout(2200);
      if(scene==="campaign") {
        const name=page.getByLabel(/Nazwa kampanii/);await name.fill("");await name.pressSequentially("Checklista do publikacji",{delay:75});
        const keyword=page.getByLabel("Słowa kluczowe",{exact:true});await keyword.fill("");await keyword.pressSequentially("PLAN",{delay:220});
        await page.waitForTimeout(1500);
        await page.mouse.move(710,670,{steps:30});
        await page.mouse.wheel(0,450);await page.waitForTimeout(2200);
      } else if(scene==="path") {
        await page.mouse.move(920,380,{steps:40});await page.waitForTimeout(1800);
        await page.mouse.wheel(0,330);await page.waitForTimeout(2200);
      } else if(scene==="preview") {
        await click(page,"Twoja pomoc");
        const email=page.getByLabel("Testowy adres e-mail");await email.scrollIntoViewIfNeeded();
        await email.pressSequentially("demo@example.com",{delay:85});
        await page.waitForTimeout(1200);await click(page,"Wyślij odpowiedź testową");
        await page.getByText("Stan: zakończony",{exact:true}).waitFor();
        await page.mouse.wheel(0,240);await page.waitForTimeout(2800);
      } else {
        const control=page.getByLabel("Tylko wartościowe leady");await control.check();
        await page.waitForTimeout(1800);await page.getByLabel("Z adresem e-mail").check();await page.waitForTimeout(2200);
      }
      const duration=(Date.now()-started)/1000;
      await page.screenshot({path:resolve(output,`${scene}-end.png`)});
      const video=page.video()!;await context.close();
      await video.saveAs(resolve(output,`${scene}.webm`));
      await writeFile(resolve(output,`${scene}.json`),JSON.stringify({scene,duration,source:"Real local InstaScaler UI with e2e fixtures; all API requests mocked; no production requests"},null,2));
    } else await context.close();
  }
  if(requests.length||errors.length)throw new Error(JSON.stringify({requests,errors}));
  console.log(probe?"Four real UI scenes inspected using demonstration fixtures.":"Recorded four real UI scenes; no external or unhandled API requests.");
} finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
