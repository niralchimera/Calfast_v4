// CalFast v4 — app.js (client-only)
// Requires Chart.js loaded in index.html

/* ===== Storage keys & defaults ===== */
const STATE_KEY = "calfast_v4_state_v1";

const DEFAULT_STATE = {
  meals: {},        // dateKey -> [meal entries]
  foods: {},        // loaded from foods.json at run
  fasting: {},      // dateKey -> { active, start, end, lastMinutes }
  weightLog: [],    // {date, weightKg}
  bfLog: [],        // {date, bfPercent}
  goals: {
    calories: 1800,
    protein: 120,
    carbs: 200,
    fat: 60,
    fastingGoalHours: 16,
    activityFactor: 1.2  // sedentary default
  },
  user: {
    heightCm: null,
    gender: "male",
    age: 30
  },
  target: { weightKg: null, targetDate: null, dailyCalorieDeficit: null }
};

let STATE = JSON.parse(localStorage.getItem(STATE_KEY)) || DEFAULT_STATE;

/* ===== Helpers ===== */
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(STATE)); }
function dateKey(d = new Date()){ const iso = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString(); return iso.slice(0,10); }

/* ===== DOM refs ===== */
const mealNameEl = document.getElementById("meal-name");
const mealQtyEl  = document.getElementById("meal-qty");
const mealTimeEl = document.getElementById("meal-time");
const addMealBtn = document.getElementById("add-meal-btn");
const mealsListEl = document.getElementById("meals-list");

const calTotalEl = document.getElementById("calories-total");
const protTotalEl = document.getElementById("protein-total");
const carbTotalEl = document.getElementById("carbs-total");
const fatTotalEl = document.getElementById("fat-total");
const calGoalEl = document.getElementById("calories-goal");

const startFastBtn = document.getElementById("start-fast-btn");
const endFastBtn = document.getElementById("end-fast-btn");
const fastingTimerEl = document.getElementById("fasting-timer");
const lastFastEl = document.getElementById("last-fast");
const fastingGoalEl = document.getElementById("fasting-goal");

const weightInputEl = document.getElementById("weight-input");
const heightInputEl = document.getElementById("height-input");
const neckInputEl = document.getElementById("neck-input");
const waistInputEl = document.getElementById("waist-input");
const hipInputEl = document.getElementById("hip-input");
const genderSelectEl = document.getElementById("gender-select");
const logWeightBtn = document.getElementById("log-weight-btn");
const calcBfBtn = document.getElementById("calc-bf-btn");
const bmiValEl = document.getElementById("bmi-val");
const bmiCatEl = document.getElementById("bmi-cat");
const bmrValEl = document.getElementById("bmr-val");
const bfValEl = document.getElementById("bf-val");
const fatMassEl = document.getElementById("fat-mass");
const lbmEl = document.getElementById("lbm");

const targetWeightEl = document.getElementById("target-weight");
const targetDateEl = document.getElementById("target-date");
const setTargetBtn = document.getElementById("set-target-btn");
const deficitMsgEl = document.getElementById("deficit-msg");

const recommendationsEl = document.getElementById("recommendations");

const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const resetBtn = document.getElementById("reset-btn");

/* ===== Load foods.json into STATE.foods ===== */
fetch('foods.json').then(r=>r.json()).then(data=>{
  const foodsObj = {};
  for(const k in data){
    const name = k.toLowerCase();
    const v = data[k];
    foodsObj[name] = {
      calories: v.calories || v.cal || 0,
      protein: v.protein || v.p || 0,
      carbs: v.carbs || v.c || 0,
      fat: v.f || v.fat || 0,
      unit: v.unit || 'serving',
      per: v.per || 1
    };
  }
  STATE.foods = foodsObj;
  saveState();
}).catch(e=>{ console.warn("Could not load foods.json", e); });

/* ===== Meal add / render ===== */
function addMeal() {
  const nameRaw = (mealNameEl.value || "").trim();
  if(!nameRaw){ alert("Enter meal name"); return; }
  const name = nameRaw.toLowerCase();
  const qty = parseFloat(mealQtyEl.value) || 1;
  const time = mealTimeEl.value || new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const dk = dateKey();
  if(!STATE.meals[dk]) STATE.meals[dk]=[];
  const food = STATE.foods[name] || null;
  let entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: nameRaw,
    qty, time,
    calories: 0, protein:0, carbs:0, fat:0
  };
  if(food){
    const ratio = qty / (food.per || 1);
    entry.calories = Math.round(food.calories * ratio);
    entry.protein = +(food.protein * ratio).toFixed(1);
    entry.carbs = +(food.carbs * ratio).toFixed(1);
    entry.fat = +(food.fat * ratio).toFixed(1);
  } else {
    const manual = prompt("Food not in DB. Enter calories for this entry (kcal):");
    const m = parseFloat(manual);
    if(Number.isFinite(m)) entry.calories = Math.round(m);
  }
  STATE.meals[dk].push(entry);
  saveState();
  renderToday();
  generateRecommendations();
}

addMealBtn.addEventListener('click', addMeal);

function renderToday(){
  const dk = dateKey();
  const list = STATE.meals[dk] || [];
  mealsListEl.innerHTML = "";
  let totals = {cal:0, p:0, c:0, f:0};
  list.forEach(m=>{
    const li = document.createElement('li');
    li.textContent = `${m.time} — ${m.name} (${m.qty}) • ${m.calories} kcal • P:${m.protein} C:${m.carbs} F:${m.fat}`;
    mealsListEl.appendChild(li);
    totals.cal += Number(m.calories||0);
    totals.p += Number(m.protein||0);
    totals.c += Number(m.carbs||0);
    totals.f += Number(m.fat||0);
  });
  calTotalEl.textContent = Math.round(totals.cal);
  protTotalEl.textContent = Math.round(totals.p);
  carbTotalEl.textContent = Math.round(totals.c);
  fatTotalEl.textContent = Math.round(totals.f);
  calGoalEl.textContent = STATE.goals.calories;
}

/* ===== Fasting ===== */
let fastingTimerInterval = null;
function startFast(){
  const dk = dateKey();
  if(!STATE.fasting[dk]) STATE.fasting[dk]={active:false,start:null,end:null,lastMinutes:0};
  if(STATE.fasting[dk].active){ alert("Already fasting today."); return; }
  STATE.fasting[dk].active = true;
  STATE.fasting[dk].start = Date.now();
  saveState();
  updateFastingDisplay();
  fastingTimerInterval = setInterval(updateFastingDisplay, 1000);
}
function endFast(){
  const keys = Object.keys(STATE.fasting).sort();
  let activeKey = null;
  for(let i=keys.length-1;i>=0;i--){
    if(STATE.fasting[keys[i]]?.active){ activeKey = keys[i]; break; }
  }
  if(!activeKey){ alert("No active fast found."); return; }
  const f = STATE.fasting[activeKey];
  f.active = false;
  f.end = Date.now();
  f.lastMinutes = Math.round((f.end - f.start) / 60000);
  saveState();
  updateFastingDisplay();
  if(fastingTimerInterval) clearInterval(fastingTimerInterval);
  lastFastEl.textContent = Math.round(f.lastMinutes/60);
  generateRecommendations();
}
startFastBtn.addEventListener('click', startFast);
endFastBtn.addEventListener('click', endFast);

function updateFastingDisplay(){
  const keys = Object.keys(STATE.fasting).sort();
  let active = null;
  for(let i=keys.length-1;i>=0;i--){
    if(STATE.fasting[keys[i]]?.active){ active = STATE.fasting[keys[i]]; break; }
  }
  if(active && active.start){
    const mins = Math.round((Date.now() - active.start)/60000);
    const hh = String(Math.floor(mins/60)).padStart(2,'0');
    const mm = String(mins%60).padStart(2,'0');
    fastingTimerEl.textContent = `${hh}:${mm}`;
    fastingGoalEl.textContent = STATE.goals.fastingGoalHours;
  } else {
    fastingTimerEl.textContent = "00:00";
  }
}

/* ===== Weight, BMI, BMR, Body Fat ===== */

logWeightBtn.addEventListener('click', ()=>{
  const w = parseFloat(weightInputEl.value);
  if(!Number.isFinite(w)){ alert("Enter weight (kg)"); return; }
  const today = dateKey();
  STATE.weightLog.push({date: today, weightKg: w});
  saveState();
  updateBodyStats();
  renderCharts();
  generateRecommendations();
  alert("Weight logged");
});

function bmiFrom(weightKg, heightCm){
  if(!weightKg || !heightCm) return null;
  const hM = heightCm/100;
  return +(weightKg / (hM*hM)).toFixed(1);
}
function bmiCategory(bmi){
  if(!bmi) return '—';
  if(bmi < 18.5) return 'Underweight';
  if(bmi < 25) return 'Normal';
  if(bmi < 30) return 'Overweight';
  return 'Obese';
}

function calcBMR(weightKg, heightCm, age, gender){
  if(!weightKg || !heightCm || !age) return null;
  if(gender === 'male'){
    return Math.round(10*weightKg + 6.25*heightCm - 5*age + 5);
  } else {
    return Math.round(10*weightKg + 6.25*heightCm - 5*age - 161);
  }
}

function calcBodyFatUSN(gender, neckCm, waistCm, hipCm, heightCm){
  if(!neckCm || !waistCm || !heightCm) return null;
  if(gender==='male'){
    const bf = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
    return +(bf.toFixed(1));
  } else {
    if(!hipCm) return null;
    const bf = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.22100 * Math.log10(heightCm)) - 450;
    return +(bf.toFixed(1));
  }
}

calcBfBtn.addEventListener('click', ()=>{
  const neck = parseFloat(neckInputEl.value);
  const waist = parseFloat(waistInputEl.value);
  const hip = parseFloat(hipInputEl.value);
  const height = parseFloat(heightInputEl.value) || STATE.user.heightCm;
  const gender = genderSelectEl.value || STATE.user.gender;
  if(!height){ alert("Provide height (cm) in top inputs"); return; }
  const bf = calcBodyFatUSN(gender, neck, waist, hip, height);
  if(!bf){ alert("Not enough measurements (need neck, waist, height; hip for females)"); return; }
  STATE.bfLog.push({date: dateKey(), bfPercent: bf});
  saveState();
  updateBodyStats();
  renderCharts();
  alert(`Body fat ~ ${bf}% (US Navy method)`);
});

function updateBodyStats(){
  const latestWeight = STATE.weightLog.length ? STATE.weightLog[STATE.weightLog.length-1].weightKg : null;
  const height = parseFloat(heightInputEl.value) || STATE.user.heightCm;
  const gender = genderSelectEl.value || STATE.user.gender;
  const age = STATE.user.age || 30;
  if(height) STATE.user.heightCm = height;
  STATE.user.gender = gender;
  saveState();

  const bmi = latestWeight && height ? bmiFrom(latestWeight, height) : null;
  bmiValEl.textContent = bmi ? bmi : '—';
  bmiCatEl.textContent = bmi ? bmiCategory(bmi) : '—';

  const bmr = latestWeight && height ? calcBMR(latestWeight, height, age, gender) : null;
  bmrValEl.textContent = bmr ? bmr : '—';

  const lastBf = STATE.bfLog.length ? STATE.bfLog[STATE.bfLog.length-1].bfPercent : null;
  let bf = lastBf;
  if(!bf && bmi){
    const g = gender==='male' ? 1 : 0;
    bf = +(1.2*bmi + 0.23*(STATE.user.age||30) - 10.8*g - 5.4).toFixed(1);
  }
  bfValEl.textContent = bf ? bf + '%' : '—';
  if(latestWeight && bf){
    const fatMass = +(latestWeight * bf/100).toFixed(2);
    const lbm = +(latestWeight - fatMass).toFixed(2);
    fatMassEl.textContent = fatMass + ' kg';
    lbmEl.textContent = lbm + ' kg';
  } else {
    fatMassEl.textContent = '—';
    lbmEl.textContent = '—';
  }
}

/* ===== Goal & deficit calculation ===== */
setTargetBtn.addEventListener('click', ()=>{
  const targetW = parseFloat(targetWeightEl.value);
  const targetDate = targetDateEl.value;
  if(!targetW || !targetDate){ alert("Set target weight and date"); return; }
  STATE.target.weightKg = targetW;
  STATE.target.targetDate = targetDate;
  const latestWeight = STATE.weightLog.length ? STATE.weightLog[STATE.weightLog.length-1].weightKg : null;
  if(!latestWeight){ alert("Log your current weight first"); return; }
  const days = Math.max(1, Math.round((new Date(targetDate) - new Date()) / (1000*60*60*24)));
  const kgToLose = latestWeight - targetW;
  if(kgToLose <= 0){ alert("Target weight must be below current weight"); return; }
  const totalDeficitKcal = kgToLose * 7700;
  const dailyDeficit = Math.round(totalDeficitKcal / days);
  const safeDeficit = Math.max(250, Math.min(900, dailyDeficit));
  STATE.target.dailyCalorieDeficit = safeDeficit;
  saveState();
  deficitMsgEl.textContent = `To lose ${kgToLose.toFixed(1)} kg in ${days} days you'd need ~${dailyDeficit} kcal/day deficit. App sets a safe deficit of ${safeDeficit} kcal/day.`;
  generateRecommendations();
});

/* ===== Charts (Chart.js) ===== */
let charts = {};
function renderCharts(){
  try{
    const weightCtx = document.getElementById('weightChart').getContext('2d');
    const history = STATE.weightLog.slice(-90);
    const labels = history.map(h=>h.date);
    const data = history.map(h=>h.weightKg);
    if(charts.weight) charts.weight.destroy();
    charts.weight = new Chart(weightCtx, {
      type: 'line',
      data: { labels, datasets: [{ label:'Weight (kg)', data, borderColor:'#4caf50', fill:false }] },
      options: { responsive:true, maintainAspectRatio:false }
    });

    const calCtx = document.getElementById('calorieChart').getContext('2d');
    const days = Object.keys(STATE.meals).sort().slice(-14);
    const calLabels = days;
    const calValues = days.map(d=> (STATE.meals[d] || []).reduce((s,m)=>s+Number(m.calories||0),0) );
    if(charts.cals) charts.cals.destroy();
    charts.cals = new Chart(calCtx, { type:'bar', data:{ labels:calLabels, datasets:[{label:'Calories', data:calValues, backgroundColor:'#2196f3'}] }, options:{responsive:true, maintainAspectRatio:false} });

    const bfCtx = document.getElementById('bfChart').getContext('2d');
    const bfHistory = STATE.bfLog.slice(-90);
    const bfLabels = bfHistory.map(b=>b.date);
    const bfValues = bfHistory.map(b=>b.bfPercent);
    if(charts.bf) charts.bf.destroy();
    charts.bf = new Chart(bfCtx, { type:'line', data:{ labels:bfLabels, datasets:[{label:'Body Fat %', data:bfValues, borderColor:'#ff9800', fill:false}] }, options:{responsive:true, maintainAspectRatio:false} });
  }catch(e){ console.warn("Chart render issue", e); }
}

/* ===== Recommendations (Coach) ===== */
function generateRecommendations(){
  recommendationsEl.innerHTML = '';
  const dk = dateKey();
  const todayMeals = STATE.meals[dk] || [];
  const totals = todayMeals.reduce((s,m)=>({cal:s.cal+Number(m.calories||0), p:s.p+Number(m.protein||0), c:s.c+Number(m.carbs||0), f:s.f+Number(m.fat||0)}), {cal:0,p:0,c:0,f:0});
  if(totals.cal > STATE.goals.calories * 1.15){
    addRec(`🔺 Calories high today (+${totals.cal - STATE.goals.calories} kcal). Suggest lighter dinner: channa salad, egg whites, grilled chicken.`, 'bad');
  } else if(totals.cal < STATE.goals.calories * 0.85){
    addRec(`🔻 Calories low today (−${STATE.goals.calories - totals.cal} kcal). Consider a small snack if energy low: fruit + nuts or a roti with paneer.`, 'warn');
  } else {
    addRec(`✅ Calories on track (${totals.cal} kcal).`, 'good');
  }
  if(totals.p < STATE.goals.protein * 0.8){
    addRec(`💪 Protein low (${totals.p}g). Prioritise 20-30g protein/meal: paneer (100g), chicken (100g) or whey scoop.`, 'warn');
  }
  if(totals.c > STATE.goals.carbs * 1.2) addRec(`🍚 Carbs high — swap heavy carbs for salad/veg + protein.`, 'bad');
  if(totals.f > STATE.goals.fat * 1.2) addRec(`🧈 Fat high — reduce deep-fried items & ghee.`, 'bad');
  const lastFast = (()=>{ const keys=Object.keys(STATE.fasting).sort(); for(let i=keys.length-1;i>=0;i--){ const f = STATE.fasting[keys[i]]; if(f?.lastMinutes) return Math.round(f.lastMinutes/60); } return null; })();
  if(lastFast !== null){
    if(lastFast < STATE.goals.fastingGoalHours) addRec(`⏰ Last fast ${lastFast}h below goal ${STATE.goals.fastingGoalHours}h. Consider starting earlier tonight.`, 'warn');
    else addRec(`⏱️ Good — last fast ${lastFast}h (goal ${STATE.goals.fastingGoalHours}h).`, 'good');
  }
  if(STATE.target.weightKg && STATE.weightLog.length){
    const current = STATE.weightLog[STATE.weightLog.length-1].weightKg;
    const daysLeft = STATE.target.targetDate ? Math.max(1, Math.round((new Date(STATE.target.targetDate) - new Date())/(1000*3600*24))) : null;
    const toLose = current - STATE.target.weightKg;
    if(toLose > 0 && STATE.target.dailyCalorieDeficit){
      addRec(`🎯 Target: lose ${toLose.toFixed(1)} kg in ${daysLeft} days → app deficit ${STATE.target.dailyCalorieDeficit} kcal/day (safe cap applied).`, 'info');
      const bmr = calcBMR(current, STATE.user.heightCm || 170, STATE.user.age || 30, STATE.user.gender);
      const maintenance = Math.round(bmr * STATE.goals.activityFactor);
      const recCal = Math.max(1100, maintenance - STATE.target.dailyCalorieDeficit);
      addRec(`📉 Recommended daily target to meet goal: ~${recCal} kcal/day (est. maintenance ${maintenance} kcal).`, 'info');
    }
  }
  const lastBfEntry = STATE.bfLog.length ? STATE.bfLog[STATE.bfLog.length-1].bfPercent : null;
  if(lastBfEntry){
    if(lastBfEntry > 25 && STATE.user.gender==='male') addRec(`⚠️ Body fat ${lastBfEntry}% is above recommended. Focus on small sustainable deficit, high protein, and resistance training.`, 'bad');
    if(lastBfEntry > 32 && STATE.user.gender==='female') addRec(`⚠️ Body fat ${lastBfEntry}% is above recommended. Consider increasing protein & activity; avoid extreme deficits.`, 'bad');
  }
  function addRec(text, type){
    const li = document.createElement('li');
    li.textContent = text;
    if(type==='good') li.classList.add('good');
    if(type==='bad') li.style.borderLeft='5px solid #f44336';
    if(type==='warn') li.style.borderLeft='5px solid #ff9800';
    recommendationsEl.appendChild(li);
  }
}

/* ===== Import/Export / Reset ===== */
exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(STATE, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `calfast_backup_${dateKey()}.json`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});
importBtn.addEventListener('click', ()=>{
  const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange = e => {
    const f = e.target.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        STATE = Object.assign(DEFAULT_STATE, data);
        saveState(); renderToday(); updateBodyStats(); renderCharts(); generateRecommendations();
        alert("Import successful");
      }catch(err){ alert("Invalid JSON"); }
    };
    reader.readAsText(f);
  };
  inp.click();
});
resetBtn.addEventListener('click', ()=>{
  if(confirm("Reset all CalFast data? This will erase local logs.")){
    STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
    renderToday(); updateBodyStats(); renderCharts(); generateRecommendations();
    alert("Reset complete");
  }
});

/* ===== Init UI & periodic updates ===== */
function init(){
  if(STATE.user.heightCm) document.getElementById('height-input').value = STATE.user.heightCm;
  document.getElementById('gender-select').value = STATE.user.gender || 'male';
  if(STATE.weightLog.length) document.getElementById('weight-input').value = STATE.weightLog[STATE.weightLog.length-1].weightKg;
  if(STATE.goals.fastingGoalHours) document.getElementById('fasting-goal').textContent = STATE.goals.fastingGoalHours;
  renderToday(); updateBodyStats(); renderCharts(); generateRecommendations();
  setInterval(()=>{ updateFastingDisplay(); }, 1000*30);
}
init();
