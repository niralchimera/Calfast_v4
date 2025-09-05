let meals = [];
let weightLogs = [];
let fastingStart = null;
let fastingEnd = null;
let goalWeight = null;
let goalBodyFat = null;

// Add Meal
document.getElementById("meal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("meal-name").value;
  const qty = parseInt(document.getElementById("meal-qty").value);
  const time = document.getElementById("meal-time").value;
  const meal = { id: Date.now(), name, qty, time };
  meals.push(meal);
  renderMeals();
  e.target.reset();
});

// Render Meals
function renderMeals() {
  const list = document.getElementById("meal-list");
  list.innerHTML = "";
  meals.forEach((meal) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${meal.name}</b> - ${meal.qty}g at ${meal.time}
      <button onclick="editMeal(${meal.id})">✏️</button>
      <button onclick="deleteMeal(${meal.id})">❌</button>`;
    list.appendChild(li);
  });
}

// Edit Meal
function editMeal(id) {
  const meal = meals.find((m) => m.id === id);
  if (!meal) return;
  const newName = prompt("Edit food name:", meal.name);
  const newQty = prompt("Edit quantity (g):", meal.qty);
  const newTime = prompt("Edit time (HH:MM):", meal.time);
  if (newName && newQty && newTime) {
    meal.name = newName;
    meal.qty = parseInt(newQty);
    meal.time = newTime;
    renderMeals();
  }
}

// Delete Meal
function deleteMeal(id) {
  meals = meals.filter((m) => m.id !== id);
  renderMeals();
}

// Reset Meals
document.getElementById("reset-meals").addEventListener("click", () => {
  if (confirm("Clear all meal logs?")) {
    meals = [];
    renderMeals();
  }
});

// Fasting Tracker
function updateFastingStatus() {
  const status = document.getElementById("fasting-status");
  if (fastingStart && !fastingEnd) {
    const now = new Date();
    const hours = ((now - fastingStart) / (1000 * 60 * 60)).toFixed(1);
    status.textContent = `Fasting: ${hours}h so far`;
  } else if (fastingStart && fastingEnd) {
    const hours = ((fastingEnd - fastingStart) / (1000 * 60 * 60)).toFixed(1);
    status.textContent = `Last fast: ${hours}h`;
  } else {
    status.textContent = "Not fasting yet.";
  }
}

document.getElementById("start-fasting").addEventListener("click", () => {
  fastingStart = new Date();
  fastingEnd = null;
  updateFastingStatus();
});
document.getElementById("end-fasting").addEventListener("click", () => {
  if (fastingStart) {
    fastingEnd = new Date();
    updateFastingStatus();
  }
});
document.getElementById("reset-fasting").addEventListener("click", () => {
  fastingStart = null;
  fastingEnd = null;
  updateFastingStatus();
});
setInterval(updateFastingStatus, 60000);

// Weight & Body Fat Tracker
document.getElementById("weight-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const weight = parseFloat(document.getElementById("weight").value);
  const bodyfat = parseFloat(document.getElementById("bodyfat").value) || null;
  const entry = { id: Date.now(), date: new Date().toLocaleDateString(), weight, bodyfat };
  weightLogs.push(entry);
  renderWeightLogs();
  e.target.reset();
});

// Render Weight Logs
function renderWeightLogs() {
  const list = document.getElementById("weight-list");
  list.innerHTML = "";
  let dates = [];
  let weights = [];
  let bodyfats = [];

  weightLogs.forEach((log) => {
    list.innerHTML += `<li>${log.date}: ${log.weight} kg ${log.bodyfat ? `(${log.bodyfat}% BF)` : ""}</li>`;
    dates.push(log.date);
    weights.push(log.weight);
    bodyfats.push(log.bodyfat || null);
  });

  weightChart.data.labels = dates;
  weightChart.data.datasets[0].data = weights;
  weightChart.data.datasets[1].data = goalWeight ? Array(dates.length).fill(goalWeight) : [];
  weightChart.update();

  bodyFatChart.data.labels = dates;
  bodyFatChart.data.datasets[0].data = bodyfats;
  bodyFatChart.data.datasets[1].data = goalBodyFat ? Array(dates.length).fill(goalBodyFat) : [];
  bodyFatChart.update();
}

// Reset Weight Logs
document.getElementById("reset-weight").addEventListener("click", () => {
  if (confirm("Clear all weight & fat logs?")) {
    weightLogs = [];
    renderWeightLogs();
  }
});

// Save Goals
document.getElementById("save-goals").addEventListener("click", () => {
  const gw = parseFloat(document.getElementById("goal-weight").value);
  const gbf = parseFloat(document.getElementById("goal-bodyfat").value);
  if (gw) goalWeight = gw;
  if (gbf) goalBodyFat = gbf;
  renderWeightLogs();
});

// Charts
let weightChart, bodyFatChart;
function initCharts() {
  const ctxW = document.getElementById("weightChart").getContext("2d");
  weightChart = new Chart(ctxW, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Weight (kg)", data: [], borderWidth: 2, borderColor: "blue" },
      { label: "Goal Weight", data: [], borderWidth: 2, borderColor: "red", borderDash: [5,5] }
    ] },
    options: { responsive: true }
  });

  const ctxBF = document.getElementById("bodyFatChart").getContext("2d");
  bodyFatChart = new Chart(ctxBF, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Body Fat %", data: [], borderWidth: 2, borderColor: "green" },
      { label: "Goal Body Fat %", data: [], borderWidth: 2, borderColor: "orange", borderDash: [5,5] }
    ] },
    options: { responsive: true }
  });
}
initCharts();
