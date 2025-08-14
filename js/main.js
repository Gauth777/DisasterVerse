import { AppState, resetSession } from "./state.js";
import { el, progressBar } from "./ui.js";

const app = document.getElementById("app");
const scoreboardEl = document.getElementById("scoreboard");

const STORAGE_KEY = "dv_best_scores_v1"; // { [scenarioId]: bestScore }
let scenarioMaxMap = {}; // { [scenarioId]: maxPossibleForThatScenario }
let globalMax = 0;       // sum of all scenario maxima

/* ================= storage helpers ================= */
function loadBestMap(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveBestMap(map){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
function clearBestMap(){
  localStorage.removeItem(STORAGE_KEY);
}

/* ===== compute scenario & global maxima (best option + max time bonus) ===== */
function computeScenarioMax(scenario){
  const MAX_TIME_BONUS = 3;
  return scenario.steps.reduce((sum, step)=>{
    const best = Math.max(...step.options.map(o=>o.score));
    return sum + best + MAX_TIME_BONUS;
  }, 0);
}
function computeGlobalMax(scenarios){
  scenarioMaxMap = {};
  let total = 0;
  for(const s of scenarios){
    const m = computeScenarioMax(s);
    scenarioMaxMap[s.id] = m;
    total += m;
  }
  return total;
}
function computeUserTotal(bestMap){
  return Object.entries(bestMap).reduce((sum, [sid, val])=>{
    const cap = scenarioMaxMap[sid] ?? val;
    return sum + Math.min(val, cap);
  }, 0);
}

/* ================= scoreboard UI ================= */
function buildScorePill(){
  const bestMap = loadBestMap();
  const userTotal = computeUserTotal(bestMap);
  const completed = Object.keys(bestMap).length;

  const pill = el("div",{class:"pill", title:"Click for options"},
    "Total: ",
    el("span",{}, String(userTotal)),
    "/",
    el("span",{}, String(globalMax)),
    el("span",{class:"muted"}, ` • Completed: ${completed}/${AppState.scenarios.length}`)
  );
  pill.addEventListener("click", (e)=>openResetPopover(e.currentTarget));
  return pill;
}

function updateScoreboard(){
  scoreboardEl.innerHTML = "";
  scoreboardEl.append(buildScorePill());
}

/* ================= reset popover ================= */
let currentPopover = null;
function openResetPopover(anchorEl){
  closePopover(); // ensure only one

  const rect = anchorEl.getBoundingClientRect();
  const pop = el("div",{class:"popover"},
    el("h4",{}, "Score options"),
    el("p",{}, "Do you want to reset your saved best scores across all scenarios?"),
    el("div",{class:"actions"},
      el("button",{class:"btn btn-danger", onClick:()=>{ clearBestMap(); updateScoreboard(); if(AppState.screen==="home") renderHome(); closePopover(); }}, "Reset"),
      el("button",{class:"btn btn-ghost", onClick:()=>closePopover()}, "Cancel")
    )
  );
  document.body.append(pop);

  // position under the pill, right-aligned
  const margin = 8;
  const left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, rect.right - pop.offsetWidth));
  const top  = Math.max(8, rect.bottom + margin);
  pop.style.left = `${left}px`;
  pop.style.top  = `${top}px`;

  // outside click / ESC to close
  const onDocClick = (ev)=>{
    if(!pop.contains(ev.target) && ev.target!==anchorEl){ closePopover(); }
  };
  const onEsc = (ev)=>{ if(ev.key==="Escape") closePopover(); };

  currentPopover = { pop, onDocClick, onEsc };
  setTimeout(()=>{ // delay so initial click doesn't immediately close it
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
  }, 0);
}
function closePopover(){
  if(!currentPopover) return;
  const { pop, onDocClick, onEsc } = currentPopover;
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onEsc);
  pop.remove();
  currentPopover = null;
}

/* ================= app init ================= */
(async function init(){
  try {
    const res = await fetch("./js/data/scenarios.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    AppState.scenarios = await res.json();
  } catch (e) {
    console.error("Failed to load scenarios.json", e);
    AppState.scenarios = [];
  }
  globalMax = computeGlobalMax(AppState.scenarios);
  updateScoreboard();
  renderHome();
})();

function findScenario(id){ return AppState.scenarios.find(s=>s.id===id); }

/* ================= screens ================= */
function renderHome(){
  AppState.screen = "home";
  app.innerHTML = "";
  app.append(
    el("section",{class:"card"},
      el("h2",{}, "Choose a Scenario"),
      el("p",{class:"kicker"},"Each simulation has timed decisions. Make smart, safe, sustainable choices."),
      el("div",{class:"grid grid-3"},
        ...AppState.scenarios.map(s=>scenarioCard(s))
      )
    )
  );
  updateScoreboard(); // keep pill fresh
}

function scenarioCard(s){
  const bestMap = loadBestMap();
  const best = bestMap[s.id] ?? 0;
  const max = scenarioMaxMap[s.id] ?? 0;

  return el("div",{class:"card"},
    el("span",{class:"badge"}, s.kicker ?? "Scenario"),
    el("h3",{}, s.title),
    el("p",{}, s.intro),
    el("p",{class:"kicker"}, `Best: ${best}/${max}`),
    el("button",{class:"btn btn-primary", onClick:()=>startSimulation(s.id)}, "Start simulation")
  );
}

function startSimulation(scenarioId){
  closePopover();
  resetSession();
  AppState.selectedScenarioId = scenarioId;
  AppState.screen = "play";
  renderStep();
}

function renderStep(){
  const s = findScenario(AppState.selectedScenarioId);
  const step = s?.steps?.[AppState.currentStepIndex];
  if(!s || !step){ return renderResult(); }

  clearInterval(AppState.timer);
  AppState.timeLeft = step.time;

  app.innerHTML = "";
  const header = el("div",{class:"card grid"},
    el("div",{},
      el("span",{class:"badge"},"Decision ", (AppState.currentStepIndex+1), " of ", s.steps.length),
      el("h2",{}, step.question),
      el("p",{class:"kicker"},"Make your choice before time runs out.")
    ),
    el("div",{},
      el("div",{class:"grid"},
        el("div",{}, el("strong",{},"Score: "), el("span",{class:"score"}, String(AppState.score))),
        el("div",{}, el("strong",{},"Time: "), el("span",{id:"timer",class:"timer"}, `${AppState.timeLeft}s`))
      ),
      progressBar(AppState.currentStepIndex, s.steps.length)
    )
  );

  const options = el("div",{class:"grid"},
    ...step.options.map(opt => optionCard(step, opt))
  );

  app.append(header, el("div",{class:"grid"}, options));

  AppState.timer = setInterval(()=>{
    AppState.timeLeft--;
    const t = document.getElementById("timer");
    if(t) t.textContent = `${AppState.timeLeft}s`;
    if(AppState.timeLeft<=0){
      clearInterval(AppState.timer);
      AppState.session.steps.push({stepId: step.id, optionId: null, delta: -3, timeRemaining: 0});
      AppState.score -= 3;
      AppState.currentStepIndex++;
      renderStep();
    }
  }, 1000);
}

function optionCard(step, opt){
  return el("div",{class:"option", onClick:(event)=>handleChoice(event, step, opt)},
    el("div",{class:"label"}, opt.label),
    el("div",{class:"explain"}, opt.explain)
  );
}

function handleChoice(event, step, opt){
  document.querySelectorAll(".option").forEach(c=>c.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
  event.currentTarget.querySelector(".explain").style.display = "block";

  const timeBonus = Math.max(0, Math.min(3, Math.floor(AppState.timeLeft/8))); // 0..3
  const delta = opt.score + timeBonus;

  AppState.score += delta;
  AppState.session.steps.push({stepId: step.id, optionId: opt.id, delta, timeRemaining: AppState.timeLeft});

  clearInterval(AppState.timer);
  setTimeout(()=>{ AppState.currentStepIndex++; renderStep(); }, 700);
}

function renderResult(){
  AppState.screen = "result";
  const s = findScenario(AppState.selectedScenarioId);
  if(!s){
    app.innerHTML = "";
    app.append(el("div",{class:"card"}, "Scenario not found."));
    return;
  }
  const outcome = [...s.outcomes].sort((a,b)=>b.min-a.min).find(o=>AppState.score>=o.min);

  // update best for this scenario
  const bestMap = loadBestMap();
  const prev = bestMap[s.id] ?? -Infinity;
  const newBest = Math.max(prev, AppState.score);
  bestMap[s.id] = newBest;
  saveBestMap(bestMap);
  updateScoreboard();

  app.innerHTML = "";
  app.append(
    el("section",{class:"card grid"},
      el("div",{},
        el("h2",{}, "Your Resilience Score: ", AppState.score),
        el("p",{}, outcome.title, " — ", outcome.message),
        el("p",{class:"kicker"}, `Scenario best: ${newBest}/${scenarioMaxMap[s.id]}`),
        el("div",{class:"grid"},
          el("button",{class:"btn btn-primary", onClick:()=>renderHome()},"Return to scenarios"),
          el("button",{class:"btn btn-ghost", onClick:()=>startSimulation(s.id)},"Replay")
        )
      ),
      el("div",{},
        el("h3",{},"Decision Breakdown"),
        ...AppState.session.steps.map((st,i)=>el("div",{class:"card"},
          el("div",{}, `#${i+1} • ${st.optionId ? `Choice: ${st.optionId}` : "No choice"}`),
          el("div",{}, `Δ Score: ${st.delta >=0 ? "+" : ""}${st.delta} • Time left: ${st.timeRemaining}s`)
        ))
      )
    )
  );
}
