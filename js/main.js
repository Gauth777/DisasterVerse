import { AppState, resetSession } from "./state.js";
import { el, progressBar } from "./ui.js";

const app = document.getElementById("app");

// load scenarios once, then render home
(async function init(){
  const res = await fetch("./js/data/scenarios.json");
  AppState.scenarios = await res.json();
  renderHome();
})();

function findScenario(id){
  return AppState.scenarios.find(s=>s.id===id);
}

/* ---------- screens ---------- */

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
}

function scenarioCard(s){
  return el("div",{class:"card"},
    el("span",{class:"badge"}, s.kicker ?? "Scenario"),
    el("h3",{}, s.title),
    el("p",{}, s.intro),
    el("button",{class:"btn btn-primary", onClick:()=>startSimulation(s.id)}, "Start simulation")
  );
}

function startSimulation(scenarioId){
  resetSession();
  AppState.selectedScenarioId = scenarioId;
  AppState.screen = "play";
  renderStep();
}

function renderStep(){
  const s = findScenario(AppState.selectedScenarioId);
  const step = s.steps[AppState.currentStepIndex];
  if(!step){ return renderResult(); }

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
      // no choice → small penalty
      AppState.session.steps.push({stepId: step.id, optionId: null, delta: -3, timeRemaining: 0});
      AppState.score -= 3;
      AppState.currentStepIndex++;
      renderStep();
    }
  }, 1000);
}

function optionCard(step, opt){
  return el("div",{class:"option", onClick:(event)=>{
      handleChoice(event, step, opt);
    }},
    el("div",{class:"label"}, opt.label),
    el("div",{class:"explain"}, opt.explain)
  );
}

function handleChoice(event, step, opt){
  // lock selection visual
  const cards = document.querySelectorAll(".option");
  cards.forEach(c=>c.classList.remove("selected"));
  event.currentTarget.classList.add("selected");
  event.currentTarget.querySelector(".explain").style.display = "block";

  // score with small time bonus
  const timeBonus = Math.max(0, Math.min(3, Math.floor(AppState.timeLeft/8))); // 0..3
  const delta = opt.score + timeBonus;

  AppState.score += delta;
  AppState.session.steps.push({stepId: step.id, optionId: opt.id, delta, timeRemaining: AppState.timeLeft});

  clearInterval(AppState.timer);
  // slight delay so user can read explanation
  setTimeout(()=>{
    AppState.currentStepIndex++;
    renderStep();
  }, 700);
}

function renderResult(){
  AppState.screen = "result";
  const s = findScenario(AppState.selectedScenarioId);

  // find outcome bucket
  const outcome = [...s.outcomes].sort((a,b)=>b.min-a.min).find(o=>AppState.score>=o.min);

  app.innerHTML = "";
  app.append(
    el("section",{class:"card grid"},
      el("div",{},
        el("h2",{}, "Your Resilience Score: ", AppState.score),
        el("p",{}, outcome.title, " — ", outcome.message),
        el("div",{class:"grid"},
          el("button",{class:"btn btn-primary", onClick:()=>renderHome()},"Try another scenario"),
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
