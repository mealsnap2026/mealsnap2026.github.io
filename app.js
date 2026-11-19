/* MealSnap — standalone meal macro counter.
   No sign-in: meals live in this phone's localStorage. The app's only
   network calls are the optional ✨ Calculate buttons — from photo or
   from name (see the AI calculation section below). */
'use strict';

/* ---------- Built-in quick-pick foods (typical values per serving — always editable) ---------- */
var FOODS = [
  { name: 'Cooked white rice', serving: '1 cup', cal: 204, carbs: 45, protein: 4, fat: 0, fiber: 1, sugar: 0 },
  { name: 'Brown rice', serving: '1 cup cooked', cal: 216, carbs: 45, protein: 5, fat: 2, fiber: 4, sugar: 1 },
  { name: 'Kimbap', serving: '1 roll', cal: 350, carbs: 48, protein: 9, fat: 12, fiber: 3, sugar: 5 },
  { name: 'Oatmeal', serving: '1 cup cooked', cal: 154, carbs: 27, protein: 5, fat: 3, fiber: 4, sugar: 1 },
  { name: 'Whole wheat bread', serving: '1 slice', cal: 81, carbs: 14, protein: 4, fat: 1, fiber: 2, sugar: 1 },
  { name: 'Pasta', serving: '1 cup cooked', cal: 220, carbs: 43, protein: 8, fat: 1, fiber: 3, sugar: 1 },
  { name: 'Quinoa', serving: '1 cup cooked', cal: 222, carbs: 39, protein: 8, fat: 4, fiber: 5, sugar: 2 },
  { name: 'Lentils', serving: '1 cup cooked', cal: 230, carbs: 40, protein: 18, fat: 1, fiber: 16, sugar: 2 },
  { name: 'Banana', serving: '1 medium', cal: 105, carbs: 27, protein: 1, fat: 0, fiber: 3, sugar: 14 },
  { name: 'Apple', serving: '1 medium', cal: 95, carbs: 25, protein: 0, fat: 0, fiber: 4, sugar: 19 },
  { name: 'Egg (boiled)', serving: '1 large', cal: 78, carbs: 1, protein: 6, fat: 5, fiber: 0, sugar: 1 },
  { name: 'Chicken breast', serving: '100 g', cal: 165, carbs: 0, protein: 31, fat: 4, fiber: 0, sugar: 0 },
  { name: 'Salmon', serving: '100 g', cal: 208, carbs: 0, protein: 20, fat: 13, fiber: 0, sugar: 0 },
  { name: 'Grilled steak (sirloin)', serving: '100 g', cal: 183, carbs: 0, protein: 26, fat: 8, fiber: 0, sugar: 0 },
  { name: 'Tofu', serving: '100 g', cal: 76, carbs: 2, protein: 8, fat: 5, fiber: 1, sugar: 0 },
  { name: 'Greek yogurt (plain, nonfat)', serving: '170 g cup', cal: 100, carbs: 6, protein: 17, fat: 0, fiber: 0, sugar: 6 },
  { name: 'Milk (whole)', serving: '1 cup', cal: 149, carbs: 12, protein: 8, fat: 8, fiber: 0, sugar: 12 },
  { name: 'Cheddar cheese', serving: '1 slice (28 g)', cal: 113, carbs: 0, protein: 7, fat: 9, fiber: 0, sugar: 0 },
  { name: 'Avocado', serving: '1/2 fruit', cal: 120, carbs: 6, protein: 1, fat: 11, fiber: 5, sugar: 0 },
  { name: 'Sweet potato (baked)', serving: '1 medium', cal: 103, carbs: 24, protein: 2, fat: 0, fiber: 4, sugar: 7 },
  { name: 'Broccoli (cooked)', serving: '1 cup', cal: 55, carbs: 11, protein: 4, fat: 1, fiber: 5, sugar: 2 },
  { name: 'Kimchi', serving: '1 cup', cal: 23, carbs: 4, protein: 2, fat: 0, fiber: 2, sugar: 1 },
  { name: 'Mixed salad, light dressing', serving: '1 bowl', cal: 120, carbs: 8, protein: 3, fat: 9, fiber: 3, sugar: 4 },
  { name: 'Orange juice', serving: '1 cup', cal: 112, carbs: 26, protein: 2, fat: 1, fiber: 1, sugar: 21 },
  { name: 'Almonds', serving: '28 g (a small handful)', cal: 164, carbs: 6, protein: 6, fat: 14, fiber: 4, sugar: 1 },
  { name: 'Peanut butter', serving: '2 tbsp', cal: 188, carbs: 6, protein: 8, fat: 16, fiber: 2, sugar: 3 }
];

/* ---------- Storage ---------- */
var MEALS_KEY = 'mealsnap.meals.v1';
var GOALS_KEY = 'mealsnap.goals.v1';
var PROFILE_KEY = 'mealsnap.profile.v1';
var UNITS_KEY = 'mealsnap.units.v1';

function loadJSON(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

var meals = loadJSON(MEALS_KEY, []);
var goals = loadJSON(GOALS_KEY, { carbGoal: 180, calGoal: 1800 });
var profile = loadJSON(PROFILE_KEY, {});
/* Calculator display units: 'metric' (cm / kg) or 'imperial' (ft / lb).
   Display-only preference, kept on this phone like the language choice;
   the profile itself is always stored in metric (see the Goals section). */
var units = (function () {
  try { return localStorage.getItem(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric'; } catch (e) { return 'metric'; }
})();

/* Portion quantity + unit for a meal entry (e.g. 2 slices of bread).
   Descriptive only: they say how much the entry is and are NEVER used
   to scale the nutrition numbers the user typed or the service
   estimated. The last unit used is remembered on this phone (same
   pattern as the units preference above); the quantity itself always
   starts again at 1 for a new entry. */
var FOOD_UNIT_KEY = 'mealsnap.foodunit.v1';
var FOOD_UNITS = ['piece', 'slice', 'cup', 'tbsp', 'tsp', 'ml', 'floz', 'g', 'bowl', 'serving'];
var DEFAULT_FOOD_UNIT = 'serving';
/* The words sent to the calculation service are always these English
   unit words, whatever language the screen is in (the service's
   prompts are written for English amounts). */
var UNIT_SERVER_WORD = {
  piece: 'piece', slice: 'slice', cup: 'cup', tbsp: 'tablespoon', tsp: 'teaspoon',
  ml: 'ml', floz: 'fl oz', g: 'g', bowl: 'bowl', serving: 'serving'
};
var lastFoodUnit = (function () {
  try {
    var u = localStorage.getItem(FOOD_UNIT_KEY);
    return FOOD_UNITS.indexOf(u) >= 0 ? u : DEFAULT_FOOD_UNIT;
  } catch (e) { return DEFAULT_FOOD_UNIT; }
})();

/* ---------- My Foods (foods remembered from the Add form) ----------
   Every NEW meal saved from the Add form is remembered here — its name,
   quantity/unit and the numbers as saved — so a food she eats often can
   be re-added to today with one tap, no typing and no calculation call.
   Stored on this phone only, like the meals themselves. The list is
   capped; the section on the Add screen is collapsible and starts
   collapsed, and whether she left it open is remembered on this phone. */
var MYFOODS_KEY = 'mealsnap.myfoods.v1';
var MYFOODS_OPEN_KEY = 'mealsnap.myfoods.open.v1';
var MYFOODS_CAP = 50;
var myFoods = loadJSON(MYFOODS_KEY, []);
if (!Array.isArray(myFoods)) myFoods = [];
var myFoodsOpen = (function () {
  try { return localStorage.getItem(MYFOODS_OPEN_KEY) === '1'; } catch (e) { return false; }
})();

/* ---------- Meal photos (IndexedDB — one photo per meal, on this phone only) ----------
   Photos are too big for localStorage, so they live in IndexedDB keyed by meal id.
   Nothing is uploaded from here (the one send in the app is the explicit
   ✨ Calculate tap — see the AI section). If IndexedDB is unavailable, every photo function
   below quietly does nothing and the app still works as before. */
var PHOTO_DB = 'mealsnap';
var PHOTO_STORE = 'photos';
var photoDbPromise = null;

function openPhotoDb() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  if (photoDbPromise) return photoDbPromise;
  photoDbPromise = new Promise(function (resolve) {
    var req;
    try { req = indexedDB.open(PHOTO_DB, 1); } catch (e) { resolve(null); return; }
    req.onupgradeneeded = function () {
      if (!req.result.objectStoreNames.contains(PHOTO_STORE)) {
        req.result.createObjectStore(PHOTO_STORE);
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { resolve(null); };
    req.onblocked = function () { resolve(null); };
  });
  return photoDbPromise;
}
function photoTxn(mode, run) {
  return openPhotoDb().then(function (db) {
    return new Promise(function (resolve) {
      if (!db) { resolve(null); return; }
      var result = null;
      try {
        var tx = db.transaction(PHOTO_STORE, mode);
        var req = run(tx.objectStore(PHOTO_STORE));
        if (req) {
          req.onsuccess = function () { result = req.result; };
          req.onerror = function () { result = null; };
        }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { resolve(null); };
        tx.onabort = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
  });
}
function photoPut(id, blob) {
  if (!blob) return Promise.resolve(null);
  return photoTxn('readwrite', function (store) { return store.put(blob, id); });
}
function photoGet(id) {
  return photoTxn('readonly', function (store) { return store.get(id); })
    .then(function (blob) { return blob || null; });
}
function photoDelete(id) {
  return photoTxn('readwrite', function (store) { return store.delete(id); });
}
function photoClear() {
  return photoTxn('readwrite', function (store) { return store.clear(); });
}

/* Shrink a picked phone photo before storing: max 1024px on the long side, JPEG 0.8. */
function downscaleImage(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      try {
        var max = 1024;
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, max / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob); else reject(new Error('Could not process photo'));
          }, 'image/jpeg', 0.8);
        } else {
          var bin = atob(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/jpeg' }));
        }
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read photo')); };
    img.src = url;
  });
}

/* ---------- Helpers ---------- */
function $(id) { return document.getElementById(id); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayKey() { return dateKey(new Date()); }
function num(el) { var v = parseFloat(el.value); return isNaN(v) ? 0 : v; }
function round(v) { return Math.round(v); }
function mealsOn(key) { return meals.filter(function (m) { return m.date === key; }); }
function totalsFor(key) {
  var t = { cal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugar: 0 };
  mealsOn(key).forEach(function (m) {
    t.cal += m.cal; t.carbs += m.carbs; t.protein += m.protein;
    t.fat += m.fat; t.fiber += m.fiber; t.sugar += m.sugar;
  });
  return t;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- Languages (English / 한국어 / Español) ----------
   Only UI text is translated. Stored data (meal names, numbers, dates)
   is user content and is never translated. Meal "type" values stay in
   English inside the data (the select's option values); only their
   on-screen labels change. */
var LANG_KEY = 'mealsnap.lang.v1';
var LOCALES = { en: 'en-US', ko: 'ko-KR', es: 'es-ES' };
var STRINGS = {
  en: {
    brandTag: 'See your meal at a glance',
    tabToday: 'Today', tabAdd: 'Add', tabTrends: 'Trends', tabGoals: 'Goals',
    carbsToday: 'carbs today', goalWord: 'goal', caloriesWord: 'calories',
    proteinWord: 'protein', fatWord: 'fat',
    todayHint: 'No food scale needed — pick a food or type your own numbers, then adjust them to match your meal.',
    todaysMeals: "Today's meals",
    emptyToday: 'No meals yet today. Tap <strong>{add}</strong> below to log your first meal.',
    mealName: 'Meal name', mealNamePh: 'e.g. Rice and chicken',
    mealType: 'Meal', typeBreakfast: 'Breakfast', typeLunch: 'Lunch', typeDinner: 'Dinner', typeSnack: 'Snack',
    servings: 'Servings',
    qtyLabel: 'Quantity', unitLabel: 'Unit',
    myFoods: 'My Foods', myFoodsCal: '{n} kcal',
    myFoodsFav: 'Favorite', myFoodsAddBtn: 'Add to today', myFoodsDelete: 'Remove from My Foods',
    unitPiece: 'piece', unitPiecePl: 'pieces',
    unitSlice: 'slice', unitSlicePl: 'slices',
    unitCup: 'cup', unitCupPl: 'cups',
    unitTbsp: 'tablespoon', unitTbspPl: 'tablespoons',
    unitTsp: 'teaspoon', unitTspPl: 'teaspoons',
    unitMl: 'ml', unitMlPl: 'ml',
    unitFloz: 'fl oz', unitFlozPl: 'fl oz',
    unitG: 'g', unitGPl: 'g',
    unitBowl: 'bowl', unitBowlPl: 'bowls',
    unitServing: 'serving', unitServingPl: 'servings',
    fCalories: 'Calories', fCarbs: 'Carbs (g)', fProtein: 'Protein (g)', fFat: 'Fat (g)', fFiber: 'Fiber (g)', fSugar: 'Sugar (g)',
    photoOptional: 'Photo (optional)',
    takePhoto: '📷 Take a photo', pickGallery: '🖼️ Pick from gallery',
    changePhotoCam: '📷 Change photo', changePhotoGallery: '🖼️ Change photo',
    removePhoto: 'Remove photo', calcPhoto: '✨ Calculate from photo',
    calcName: '✨ Calculate from name',
    nameHint: 'Type a meal name above — add an amount if you can, like "1 bowl of rice and chicken" — then tap ✨ Calculate from name. The name you typed is sent to MealSnap\'s calculation service (which asks Google Gemini) only when you tap it. Prefer a photo? The ✨ Calculate from photo button is in the Photo section below — both work.',
    photoHint: "Take a photo or pick one from your gallery. Photos stay on this phone — a photo is sent to MealSnap's calculation service (which asks Google Gemini) only when you tap ✨ Calculate.",
    estimateNote: '✨ AI estimate — please check the numbers before saving.',
    looking: 'Looking at your meal…',
    lookingName: 'Estimating from the name…',
    alertPhotoFail: 'Sorry, that photo could not be added. Please try another one.',
    alertNotFood: "That photo doesn't look like food — try a photo of your meal, or type the numbers in.",
    alertNotFoodName: "That doesn't look like a food or drink name — check the meal name, or type the numbers in.",
    alertNameEmpty: 'Type a meal name first — for example "1 bowl of rice and chicken" — then tap ✨ Calculate from name.',
    alertEstimateFail: "The estimate didn't work (check your connection) — you can still type the numbers in.",
    alertEstimateBusy: 'The calculation service is busy right now — wait a moment and try again. You can still type the numbers in.',
    reviewLine: 'Is this right? {name}: {carbs}g carbs · {cal} cal — check the numbers, then save.',
    thisMeal: 'This meal',
    addMeal: 'Add a meal', editMeal: 'Edit meal',
    saveMeal: 'Looks right — save meal', saveChanges: 'Save changes', clearBtn: 'Clear',
    addHintBottom: "Type the numbers from your food's label or your best estimate — every number can be edited before saving.",
    gLeft: '{n}g left today',
    gOver: '{n}g over today — it happens, tomorrow is a new day',
    photoAlt: 'Photo of {name}',
    macrosHead: '{carbs}g carbs',
    macrosRest: ' · {cal} cal · {protein}g protein · {fat}g fat',
    macrosFiber: ' · {n}g fiber', macrosSugar: ' · {n}g sugar',
    editBtn: 'Edit', deleteBtn: 'Delete',
    progressTitle: 'Progress', weekBtn: 'Week', monthBtn: 'Month',
    weekLetters: 'SMTWTFS',
    carbsPerDay: 'Carbs per day (g)', dailyTotals: 'Daily totals',
    goalTag: 'goal {n}g',
    chartStats: 'Average over the last {days} days: {carbs}g carbs · {cal} cal per day · {logged} {dayWord} logged.',
    trendsEmpty: 'Nothing logged in this period yet.',
    dayCarbs: '{n}g carbs',
    goalsTitle: 'My goals', carbsGoalLabel: 'Carbs goal (g / day)', calGoalLabel: 'Calorie goal (per day)',
    saveGoals: 'Save goals', savedCheck: 'Saved ✓',
    calcTitle: 'Calorie suggestion calculator',
    calcHint: 'Uses the Mifflin–St Jeor formula. Optional — you can always set goals yourself above.',
    sexLabel: 'Sex', female: 'Female', male: 'Male',
    ageLabel: 'Age (years)', heightLabel: 'Height (cm)', weightLabel: 'Weight (kg)',
    unitsLabel: 'Units', unitsMetric: 'Metric (cm / kg)', unitsImperial: 'Imperial (ft / lb)',
    heightLabelImp: 'Height (ft / in)', weightLabelImp: 'Weight (lb)', feetPh: 'Feet', inchesPh: 'Inches',
    activityLabel: 'Activity',
    actSit: 'Mostly sitting', actLight: 'Light (walks, light chores)',
    actMod: 'Moderate (active most days)', actVery: 'Very active',
    aimLabel: 'My aim', aimLose: 'Lose weight slowly', aimKeep: 'Keep my weight', aimGain: 'Gain a little',
    calcBtn: 'Calculate suggestion', useGoalBtn: 'Use this as my calorie goal',
    calcFillIn: 'Please fill in age, height, and weight to get a suggestion.',
    calcSuggested: 'Suggested daily calories for you: about {n} cal. This is an estimate — your doctor or care team can fine-tune it.',
    calcSaved: 'Saved — your calorie goal is now {n} cal per day.',
    disclaimer: 'MealSnap is for information only. It does not diagnose, treat, or give medical advice. Please set your personal goals with your doctor or care team.',
    myDataTitle: 'My data',
    myDataHint: "Your meals and meal photos are saved only on this phone. No account, no sign-in. Nothing is sent anywhere unless you tap one of the ✨ Calculate buttons — then that one photo, or the meal name you typed, is sent to MealSnap's calculation service, which asks Google Gemini for an estimate.",
    deleteAllBtn: 'Delete all my data',
    wipeConfirm: 'Delete ALL your MealSnap data on this phone? This cannot be undone.',
    wipeDone: 'All MealSnap data on this phone has been deleted.',
    closeBtn: '✕ Close'
  },
  ko: {
    brandTag: '한눈에 보는 내 식사',
    tabToday: '오늘', tabAdd: '추가', tabTrends: '추이', tabGoals: '목표',
    carbsToday: '오늘 탄수화물', goalWord: '목표', caloriesWord: '칼로리',
    proteinWord: '단백질', fatWord: '지방',
    todayHint: '음식 저울은 필요 없어요 — 음식을 선택하거나 숫자를 직접 입력하고, 식사에 맞게 조정하세요.',
    todaysMeals: '오늘의 식사',
    emptyToday: '오늘은 아직 식사가 없어요. 아래 <strong>{add}</strong>를 눌러 첫 식사를 기록하세요.',
    mealName: '식사 이름', mealNamePh: '예: 밥과 닭고기',
    mealType: '식사', typeBreakfast: '아침', typeLunch: '점심', typeDinner: '저녁', typeSnack: '간식',
    servings: '인분',
    qtyLabel: '양', unitLabel: '단위',
    myFoods: '내 음식', myFoodsCal: '{n} kcal',
    myFoodsFav: '즐겨찾기', myFoodsAddBtn: '오늘에 추가', myFoodsDelete: '내 음식에서 삭제',
    unitPiece: '개', unitPiecePl: '개',
    unitSlice: '조각', unitSlicePl: '조각',
    unitCup: '컵', unitCupPl: '컵',
    unitTbsp: '큰술', unitTbspPl: '큰술',
    unitTsp: '작은술', unitTspPl: '작은술',
    unitMl: 'ml', unitMlPl: 'ml',
    unitFloz: 'fl oz', unitFlozPl: 'fl oz',
    unitG: 'g', unitGPl: 'g',
    unitBowl: '그릇', unitBowlPl: '그릇',
    unitServing: '인분', unitServingPl: '인분',
    fCalories: '칼로리', fCarbs: '탄수화물 (g)', fProtein: '단백질 (g)', fFat: '지방 (g)', fFiber: '식이섬유 (g)', fSugar: '당류 (g)',
    photoOptional: '사진 (선택)',
    takePhoto: '📷 사진 찍기', pickGallery: '🖼️ 갤러리에서 선택',
    changePhotoCam: '📷 사진 변경', changePhotoGallery: '🖼️ 사진 변경',
    removePhoto: '사진 삭제', calcPhoto: '✨ 사진으로 계산하기',
    calcName: '✨ 이름으로 계산하기',
    nameHint: '위에 식사 이름을 입력하세요 — "밥과 닭고기 1그릇"처럼 양을 함께 적으면 더 좋아요 — 그런 다음 ✨ 이름으로 계산하기를 누르세요. 입력한 이름은 버튼을 누를 때만 MealSnap 계산 서비스(Google Gemini에 문의)로 전송됩니다. 사진이 더 편하신가요? 아래 사진 섹션에 ✨ 사진으로 계산하기 버튼도 있습니다 — 둘 다 사용할 수 있어요.',
    photoHint: '사진을 찍거나 갤러리에서 선택하세요. 사진은 이 휴대폰에만 저장됩니다 — ✨ 계산하기를 누를 때만 사진이 MealSnap 계산 서비스(Google Gemini에 문의)로 전송됩니다.',
    estimateNote: '✨ AI 추정값입니다 — 저장하기 전에 숫자를 확인하세요.',
    looking: '식사를 살펴보는 중…',
    lookingName: '이름으로 추정하는 중…',
    alertPhotoFail: '죄송합니다. 이 사진을 추가할 수 없습니다. 다른 사진으로 시도해 보세요.',
    alertNotFood: '이 사진은 음식으로 보이지 않아요 — 식사 사진을 사용하거나 숫자를 직접 입력해 보세요.',
    alertNotFoodName: '음식이나 음료 이름으로 보이지 않아요 — 식사 이름을 확인하거나 숫자를 직접 입력해 보세요.',
    alertNameEmpty: '먼저 식사 이름을 입력하세요 — 예: "밥과 닭고기 1그릇" — 그런 다음 ✨ 이름으로 계산하기를 눌러 주세요.',
    alertEstimateFail: '계산이 되지 않았습니다 (연결을 확인하세요) — 숫자를 직접 입력할 수 있습니다.',
    alertEstimateBusy: '계산 서비스가 지금 바쁩니다 — 잠시 기다렸다가 다시 시도해 주세요. 숫자를 직접 입력할 수도 있습니다.',
    reviewLine: '맞나요? {name}: 탄수화물 {carbs}g · {cal}칼로리 — 숫자를 확인한 뒤 저장하세요.',
    thisMeal: '이 식사',
    addMeal: '식사 추가', editMeal: '식사 수정',
    saveMeal: '맞아요 — 식사 저장', saveChanges: '변경 사항 저장', clearBtn: '지우기',
    addHintBottom: '식품 라벨의 숫자나 대략적인 추정값을 입력하세요 — 저장 전에 모든 숫자를 수정할 수 있습니다.',
    gLeft: '오늘 {n}g 남았어요',
    gOver: '오늘 {n}g 초과 — 괜찮아요, 내일은 새로운 날이에요',
    photoAlt: '{name} 사진',
    macrosHead: '탄수화물 {carbs}g',
    macrosRest: ' · {cal}칼로리 · 단백질 {protein}g · 지방 {fat}g',
    macrosFiber: ' · 식이섬유 {n}g', macrosSugar: ' · 당류 {n}g',
    editBtn: '수정', deleteBtn: '삭제',
    progressTitle: '진행 상황', weekBtn: '주간', monthBtn: '월간',
    weekLetters: '일월화수목금토',
    carbsPerDay: '일일 탄수화물 (g)', dailyTotals: '일일 합계',
    goalTag: '목표 {n}g',
    chartStats: '최근 {days}일 평균: 탄수화물 {carbs}g · 하루 {cal}칼로리 · {logged}일 기록됨.',
    trendsEmpty: '이 기간에 아직 기록이 없습니다.',
    dayCarbs: '탄수화물 {n}g',
    goalsTitle: '내 목표', carbsGoalLabel: '탄수화물 목표 (g / 일)', calGoalLabel: '칼로리 목표 (하루)',
    saveGoals: '목표 저장', savedCheck: '저장됨 ✓',
    calcTitle: '칼로리 제안 계산기',
    calcHint: 'Mifflin–St Jeor 공식을 사용합니다. 선택 사항이에요 — 위에서 직접 목표를 정할 수도 있습니다.',
    sexLabel: '성별', female: '여성', male: '남성',
    ageLabel: '나이 (세)', heightLabel: '키 (cm)', weightLabel: '몸무게 (kg)',
    unitsLabel: '단위', unitsMetric: '미터법 (cm / kg)', unitsImperial: '피트·파운드 (ft / lb)',
    heightLabelImp: '키 (피트 / 인치)', weightLabelImp: '몸무게 (lb)', feetPh: '피트', inchesPh: '인치',
    activityLabel: '활동량',
    actSit: '대부분 앉아 있음', actLight: '가벼움 (산책, 가벼운 집안일)',
    actMod: '보통 (대부분의 날 활동적)', actVery: '매우 활동적',
    aimLabel: '내 목표', aimLose: '천천히 체중 감량', aimKeep: '체중 유지', aimGain: '조금 체중 증가',
    calcBtn: '제안 계산하기', useGoalBtn: '이 값을 내 칼로리 목표로 사용',
    calcFillIn: '제안을 받으려면 나이, 키, 몸무게를 입력하세요.',
    calcSuggested: '당신에게 제안하는 하루 칼로리: 약 {n}칼로리. 이는 추정값입니다 — 의사나 의료진과 상의해 조정하세요.',
    calcSaved: '저장되었습니다 — 이제 하루 칼로리 목표는 {n}칼로리입니다.',
    disclaimer: 'MealSnap은 정보 제공용입니다. 진단, 치료 또는 의학적 조언을 제공하지 않습니다. 개인 목표는 의사나 의료진과 상의해 정하세요.',
    myDataTitle: '내 데이터',
    myDataHint: '식사와 식사 사진은 이 휴대폰에만 저장됩니다. 계정도, 로그인도 없습니다. ✨ 계산하기 버튼 중 하나를 누르지 않는 한 아무것도 전송되지 않습니다 — 누르면 그 사진 또는 입력한 식사 이름이 MealSnap 계산 서비스로 전송되고, 서비스가 Google Gemini에 추정값을 요청합니다.',
    deleteAllBtn: '내 데이터 모두 삭제',
    wipeConfirm: '이 휴대폰의 MealSnap 데이터를 모두 삭제할까요? 되돌릴 수 없습니다.',
    wipeDone: '이 휴대폰의 MealSnap 데이터가 모두 삭제되었습니다.',
    closeBtn: '✕ 닫기'
  },
  es: {
    brandTag: 'Tu comida de un vistazo',
    tabToday: 'Hoy', tabAdd: 'Añadir', tabTrends: 'Tendencias', tabGoals: 'Metas',
    carbsToday: 'carbohidratos hoy', goalWord: 'meta', caloriesWord: 'calorías',
    proteinWord: 'proteínas', fatWord: 'grasas',
    todayHint: 'No necesitas una báscula: elige un alimento o escribe tus propios números y ajústalos a tu comida.',
    todaysMeals: 'Comidas de hoy',
    emptyToday: 'Aún no hay comidas hoy. Toca <strong>{add}</strong> abajo para registrar tu primera comida.',
    mealName: 'Nombre de la comida', mealNamePh: 'ej.: arroz con pollo',
    mealType: 'Comida', typeBreakfast: 'Desayuno', typeLunch: 'Almuerzo', typeDinner: 'Cena', typeSnack: 'Merienda',
    servings: 'Porciones',
    qtyLabel: 'Cantidad', unitLabel: 'Unidad',
    myFoods: 'Mis comidas', myFoodsCal: '{n} kcal',
    myFoodsFav: 'Favorito', myFoodsAddBtn: 'Añadir a hoy', myFoodsDelete: 'Quitar de Mis comidas',
    unitPiece: 'pieza', unitPiecePl: 'piezas',
    unitSlice: 'rebanada', unitSlicePl: 'rebanadas',
    unitCup: 'taza', unitCupPl: 'tazas',
    unitTbsp: 'cucharada', unitTbspPl: 'cucharadas',
    unitTsp: 'cucharadita', unitTspPl: 'cucharaditas',
    unitMl: 'ml', unitMlPl: 'ml',
    unitFloz: 'fl oz', unitFlozPl: 'fl oz',
    unitG: 'g', unitGPl: 'g',
    unitBowl: 'tazón', unitBowlPl: 'tazones',
    unitServing: 'porción', unitServingPl: 'porciones',
    fCalories: 'Calorías', fCarbs: 'Carbohidratos (g)', fProtein: 'Proteínas (g)', fFat: 'Grasas (g)', fFiber: 'Fibra (g)', fSugar: 'Azúcar (g)',
    photoOptional: 'Foto (opcional)',
    takePhoto: '📷 Tomar una foto', pickGallery: '🖼️ Elegir de la galería',
    changePhotoCam: '📷 Cambiar foto', changePhotoGallery: '🖼️ Cambiar foto',
    removePhoto: 'Quitar foto', calcPhoto: '✨ Calcular desde la foto',
    calcName: '✨ Calcular desde el nombre',
    nameHint: 'Escribe un nombre de comida arriba — añade una cantidad si puedes, como "1 tazón de arroz con pollo" — y luego toca ✨ Calcular desde el nombre. El nombre que escribiste se envía al servicio de cálculo de MealSnap (que consulta a Google Gemini) solo cuando lo tocas. ¿Prefieres una foto? El botón ✨ Calcular desde la foto está en la sección Foto, más abajo: ambos funcionan.',
    photoHint: 'Toma una foto o elige una de tu galería. Las fotos se quedan en este teléfono: una foto se envía al servicio de cálculo de MealSnap (que consulta a Google Gemini) solo cuando tocas ✨ Calcular.',
    estimateNote: '✨ Estimación de IA: revisa los números antes de guardar.',
    looking: 'Mirando tu comida…',
    lookingName: 'Estimando desde el nombre…',
    alertPhotoFail: 'Lo sentimos, no se pudo añadir esa foto. Prueba con otra.',
    alertNotFood: 'Esa foto no parece comida: prueba con una foto de tu comida o escribe los números.',
    alertNotFoodName: 'Eso no parece el nombre de una comida o bebida: revisa el nombre o escribe los números.',
    alertNameEmpty: 'Primero escribe un nombre de comida — por ejemplo, "1 tazón de arroz con pollo" — y luego toca ✨ Calcular desde el nombre.',
    alertEstimateFail: 'La estimación no funcionó (revisa tu conexión); aún puedes escribir los números.',
    alertEstimateBusy: 'El servicio de cálculo está ocupado ahora mismo — espera un momento e inténtalo de nuevo. Aún puedes escribir los números.',
    reviewLine: '¿Está bien? {name}: {carbs} g de carbohidratos · {cal} cal — revisa los números y guarda.',
    thisMeal: 'Esta comida',
    addMeal: 'Añadir una comida', editMeal: 'Editar comida',
    saveMeal: 'Está bien — guardar comida', saveChanges: 'Guardar cambios', clearBtn: 'Borrar',
    addHintBottom: 'Escribe los números de la etiqueta de tu alimento o tu mejor estimación: todos los números se pueden editar antes de guardar.',
    gLeft: 'Te quedan {n} g hoy',
    gOver: '{n} g por encima hoy — pasa, mañana es un nuevo día',
    photoAlt: 'Foto de {name}',
    macrosHead: '{carbs} g de carbohidratos',
    macrosRest: ' · {cal} cal · {protein} g de proteínas · {fat} g de grasas',
    macrosFiber: ' · {n} g de fibra', macrosSugar: ' · {n} g de azúcar',
    editBtn: 'Editar', deleteBtn: 'Borrar',
    progressTitle: 'Progreso', weekBtn: 'Semana', monthBtn: 'Mes',
    weekLetters: 'DLMXJVS',
    carbsPerDay: 'Carbohidratos por día (g)', dailyTotals: 'Totales diarios',
    goalTag: 'meta {n} g',
    chartStats: 'Promedio de los últimos {days} días: {carbs} g de carbohidratos · {cal} cal por día · {logged} {dayWord}.',
    trendsEmpty: 'Aún no hay registros en este período.',
    dayCarbs: '{n} g de carbohidratos',
    goalsTitle: 'Mis metas', carbsGoalLabel: 'Meta de carbohidratos (g / día)', calGoalLabel: 'Meta de calorías (por día)',
    saveGoals: 'Guardar metas', savedCheck: 'Guardado ✓',
    calcTitle: 'Calculadora de calorías sugeridas',
    calcHint: 'Usa la fórmula de Mifflin–St Jeor. Es opcional: siempre puedes fijar tus metas arriba.',
    sexLabel: 'Sexo', female: 'Femenino', male: 'Masculino',
    ageLabel: 'Edad (años)', heightLabel: 'Altura (cm)', weightLabel: 'Peso (kg)',
    unitsLabel: 'Unidades', unitsMetric: 'Métrico (cm / kg)', unitsImperial: 'Imperial (ft / lb)',
    heightLabelImp: 'Altura (pies / pulgadas)', weightLabelImp: 'Peso (lb)', feetPh: 'Pies', inchesPh: 'Pulgadas',
    activityLabel: 'Actividad',
    actSit: 'Casi siempre sentado', actLight: 'Ligera (paseos, tareas ligeras)',
    actMod: 'Moderada (activo la mayoría de los días)', actVery: 'Muy activo',
    aimLabel: 'Mi objetivo', aimLose: 'Bajar de peso poco a poco', aimKeep: 'Mantener mi peso', aimGain: 'Subir un poco',
    calcBtn: 'Calcular sugerencia', useGoalBtn: 'Usar esto como mi meta de calorías',
    calcFillIn: 'Completa la edad, la altura y el peso para obtener una sugerencia.',
    calcSuggested: 'Calorías diarias sugeridas para ti: unas {n} cal. Es una estimación; tu médico o equipo de salud puede ajustarla.',
    calcSaved: 'Guardado: tu meta de calorías ahora es de {n} cal por día.',
    disclaimer: 'MealSnap es solo con fines informativos. No diagnostica, no trata ni da consejos médicos. Define tus metas personales con tu médico o equipo de salud.',
    myDataTitle: 'Mis datos',
    myDataHint: 'Tus comidas y las fotos de tus comidas se guardan solo en este teléfono. Sin cuenta y sin inicio de sesión. No se envía nada a menos que toques uno de los botones ✨ Calcular: entonces esa única foto, o el nombre de comida que escribiste, se envía al servicio de cálculo de MealSnap, que pide una estimación a Google Gemini.',
    deleteAllBtn: 'Borrar todos mis datos',
    wipeConfirm: '¿Borrar TODOS tus datos de MealSnap en este teléfono? No se puede deshacer.',
    wipeDone: 'Todos los datos de MealSnap en este teléfono han sido borrados.',
    closeBtn: '✕ Cerrar'
  }
};
var lang = (function () {
  var saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
  return STRINGS[saved] ? saved : 'en';
})();
function t(key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
}
function fill(template, values) {
  return String(template).replace(/\{(\w+)\}/g, function (m, k) {
    return (values && typeof values[k] !== 'undefined') ? values[k] : m;
  });
}
function locale() { return LOCALES[lang] || 'en-US'; }
function typeLabel(type) {
  var key = { Breakfast: 'typeBreakfast', Lunch: 'typeLunch', Dinner: 'typeDinner', Snack: 'typeSnack' }[type];
  return key ? t(key) : type;
}
function refreshPhotoLabels() {
  var has = !!currentPhotoBlob;
  $('photo-add-label').textContent = has ? t('changePhotoGallery') : t('pickGallery');
  $('photo-cam-label').textContent = has ? t('changePhotoCam') : t('takePhoto');
  $('photo-remove').textContent = t('removePhoto');
  $('photo-estimate').textContent = t('calcPhoto');
  $('name-estimate').textContent = t('calcName');
}
function applyLanguage() {
  document.documentElement.lang = lang;
  var sel = $('lang-select');
  if (sel) sel.value = lang;
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  $('meal-empty').innerHTML = fill(t('emptyToday'), { add: '+ ' + t('tabAdd') });
  $('lightbox-close').textContent = t('closeBtn');
  $('add-title').textContent = editingId !== null ? t('editMeal') : t('addMeal');
  $('save-btn').textContent = editingId !== null ? t('saveChanges') : t('saveMeal');
  $('goals-save').textContent = t('saveGoals');
  if (!$('estimate-note').classList.contains('hidden')) {
    $('estimate-note').textContent = t('estimateNote');
  }
  refreshPhotoLabels();
  renderUnits();
  renderToday();
  renderTrends();
  renderMyFoods();
  updateReview();
}

/* ---------- View switching ---------- */
var currentView = 'today';
function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
  $('view-' + name).classList.add('active');
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('active', t.getAttribute('data-view') === name);
  });
  if (name === 'today') renderToday();
  if (name === 'add') renderMyFoods();
  if (name === 'trends') renderTrends();
  if (name === 'goals') renderGoals();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    if (t.getAttribute('data-view') === 'add' && editingId === null) resetForm();
    showView(t.getAttribute('data-view'));
  });
});

/* ---------- Today ---------- */
function renderToday() {
  var now = new Date();
  $('today-date').textContent = now.toLocaleDateString(locale(), {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  var tot = totalsFor(todayKey());
  $('carb-total').textContent = round(tot.carbs);
  $('carb-goal-label').textContent = goals.carbGoal;
  $('cal-goal-label').textContent = goals.calGoal;
  $('cal-total').textContent = round(tot.cal);
  $('protein-total').textContent = round(tot.protein) + 'g';
  $('fat-total').textContent = round(tot.fat) + 'g';
  var pct = goals.carbGoal > 0 ? Math.min(100, (tot.carbs / goals.carbGoal) * 100) : 0;
  var fillEl = $('carb-fill');
  fillEl.style.width = pct + '%';
  fillEl.classList.toggle('over', tot.carbs > goals.carbGoal);
  var left = goals.carbGoal - tot.carbs;
  $('carb-left').textContent = left >= 0
    ? fill(t('gLeft'), { n: left.toFixed(0) })
    : fill(t('gOver'), { n: Math.abs(left).toFixed(0) });

  var list = $('meal-list');
  var todays = mealsOn(todayKey());
  $('meal-empty').style.display = todays.length ? 'none' : 'block';
  list.innerHTML = todays.map(function (m) {
    var qtyUnit = formatQtyUnit(m);
    return '<div class="meal-card">' +
      '<img class="meal-thumb hidden" data-thumb="' + m.id + '" alt="' + esc(fill(t('photoAlt'), { name: m.name })) + '">' +
      '<div class="meal-body">' +
      '<div class="meal-top"><span class="meal-name">' + (qtyUnit ? esc(qtyUnit) + ' · ' : '') + esc(m.name) + '</span>' +
      '<span class="meal-type">' + esc(typeLabel(m.type)) + '</span></div>' +
      '<div class="meal-macros"><strong>' + fill(t('macrosHead'), { carbs: round(m.carbs) }) + '</strong>' +
      fill(t('macrosRest'), { cal: round(m.cal), protein: round(m.protein), fat: round(m.fat) }) +
      (m.fiber ? fill(t('macrosFiber'), { n: round(m.fiber) }) : '') +
      (m.sugar ? fill(t('macrosSugar'), { n: round(m.sugar) }) : '') +
      (m.time ? ' · ' + esc(m.time) : '') + '</div>' +
      '<div class="meal-actions">' +
      '<button class="small-btn" data-edit="' + m.id + '">' + t('editBtn') + '</button>' +
      '<button class="small-btn danger" data-del="' + m.id + '">' + t('deleteBtn') + '</button>' +
      '</div></div></div>';
  }).join('');
  list.querySelectorAll('[data-edit]').forEach(function (b) {
    b.addEventListener('click', function () { startEdit(b.getAttribute('data-edit')); });
  });
  list.querySelectorAll('[data-del]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-del');
      var meal = meals.filter(function (m) { return String(m.id) === String(id); })[0];
      meals = meals.filter(function (m) { return String(m.id) !== String(id); });
      saveJSON(MEALS_KEY, meals);
      if (meal) photoDelete(meal.id);
      renderToday();
    });
  });
  /* Fill in photo thumbnails as they load from IndexedDB (async-safe:
     if the list was re-rendered meanwhile, the slot is gone and we skip). */
  todays.forEach(function (m) {
    photoGet(m.id).then(function (blob) {
      if (!blob) return;
      var img = list.querySelector('[data-thumb="' + m.id + '"]');
      if (!img || img.getAttribute('src')) return;
      img.src = URL.createObjectURL(blob);
      img.classList.remove('hidden');
      img.addEventListener('click', function () { openLightbox(blob); });
    });
  });
}

/* ---------- Photo viewer (lightbox) ---------- */
var lightboxUrl = null;
function openLightbox(blob) {
  if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);
  lightboxUrl = URL.createObjectURL(blob);
  $('lightbox-img').src = lightboxUrl;
  $('photo-lightbox').classList.remove('hidden');
}
function closeLightbox() {
  $('photo-lightbox').classList.add('hidden');
}
$('lightbox-close').addEventListener('click', closeLightbox);
$('photo-lightbox').addEventListener('click', function (e) {
  if (e.target === this) closeLightbox();
});

/* ---------- Add / edit a meal ---------- */
var editingId = null;
var selectedFood = null;

/* Photo state for the form: a newly picked photo (already downscaled),
   or a flag that the meal's stored photo should be removed on save. */
var pendingPhotoBlob = null;
var pendingPhotoRemoved = false;
var previewUrl = null;
/* The photo currently shown in the form (a fresh pick, or a meal's stored
   photo while editing) — this is what "Calculate from photo" would send. */
var currentPhotoBlob = null;

function setPhotoPreview(blob) {
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  currentPhotoBlob = blob || null;
  $('photo-estimate').classList.toggle('hidden', !blob);
  if (!blob) hideEstimateNote();
  var img = $('photo-preview');
  if (blob) {
    previewUrl = URL.createObjectURL(blob);
    img.src = previewUrl;
    img.classList.remove('hidden');
    $('photo-remove').classList.remove('hidden');
  } else {
    img.removeAttribute('src');
    img.classList.add('hidden');
    $('photo-remove').classList.add('hidden');
  }
  refreshPhotoLabels();
}
function clearPhotoState() {
  pendingPhotoBlob = null;
  pendingPhotoRemoved = false;
  $('f-photo').value = '';
  $('f-photo-cam').value = '';
  setPhotoPreview(null);
}
function handlePhotoPick() {
  var file = this.files && this.files[0];
  if (!file) return;
  downscaleImage(file).then(function (blob) {
    pendingPhotoBlob = blob;
    pendingPhotoRemoved = false;
    setPhotoPreview(blob);
  }).catch(function () {
    alert(t('alertPhotoFail'));
  });
}
$('f-photo').addEventListener('change', handlePhotoPick);
$('f-photo-cam').addEventListener('change', handlePhotoPick);
$('photo-remove').addEventListener('click', function () {
  pendingPhotoBlob = null;
  pendingPhotoRemoved = true;
  $('f-photo').value = '';
  $('f-photo-cam').value = '';
  setPhotoPreview(null);
});

/* ---------- AI calculation (server version — NO key in the app) ----------
   The Add form has TWO calculate buttons, side by side on the same form:
   - "✨ Calculate from photo" POSTs the meal photo, and
   - "✨ Calculate from name" POSTs the meal name/description she typed.
   Both go to MealSnap's own calculation service — a Google Apps Script
   web app that holds the Google Gemini key server-side and forwards the
   request to Gemini (the estimator prompts live in the proxy too). The
   app contains no API key and the user needs none. Nothing is sent
   anywhere until she taps a Calculate button, and only that one photo
   or that one typed name goes. Both paths return the same JSON shape,
   and the estimated numbers fill the form, always editable; if anything
   goes wrong she can still type the numbers in as before.
   Proxy source: ~/workspace/mealsnap/proxy/Code.gs — the endpoint URL
   below is filled in when the proxy is deployed (see DEPLOY-GUIDE.md). */
var ESTIMATE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxQ1WuZZLfffC0GLoGmg-HnwpzsYP5LjbsqTMpFKFfAOunJuRX0BuBG3J_auNNcHDuJ6Q/exec';
function showEstimateNote() {
  var n = $('estimate-note');
  n.textContent = t('estimateNote');
  n.classList.remove('hidden');
}
function hideEstimateNote() {
  $('estimate-note').classList.add('hidden');
}
function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var s = String(reader.result || '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    reader.onerror = function () { reject(new Error('Could not read photo')); };
    reader.readAsDataURL(blob);
  });
}
/* Ask the calculation service for an estimate and resolve with its
   parsed JSON: either the estimate object
   {name, calories, carbs_g, protein_g, fat_g, fiber_g, sugar_g},
   {error: 'not_food'}, or another {error: ...} object.
   The payload distinguishes the two paths: {image, mimeType} for the
   photo path, {text} for the name path.
   The Content-Type is text/plain on purpose: Apps Script web apps don't
   answer CORS preflights, and a "simple" request avoids the preflight;
   Apps Script replies with a redirect that fetch follows to the JSON. */
/* A failure answered BY the service — an {error: ...} payload or an
   HTTP error status — is not a connection problem: Gemini's per-minute
   rate limit (HTTP 429 from the proxy) looks exactly like one, and the
   old "check your connection" message sent people hunting for a signal
   problem that wasn't there. Service answers get the "busy" message;
   only a fetch that never got an answer (offline, no signal) keeps the
   connection message. Errors from the service are tagged so the catch
   handlers below can tell the two apart. */
function serviceError() {
  var e = new Error('Estimate service error');
  e.serviceError = true;
  return e;
}
function proxyEstimate(payload) {
  return fetch(ESTIMATE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function (res) {
    if (!res.ok) throw serviceError();
    return res.json().catch(function () { throw serviceError(); });
  });
}
/* ---------- Portion quantity + unit (form side) ---------- */
function unitLabelKey(unit) { return 'unit' + unit.charAt(0).toUpperCase() + unit.slice(1); }
/* Read the form's quantity + unit. A blank or non-positive quantity
   falls back to 1; an unknown unit falls back to the default. */
function readQtyUnit() {
  var q = parseFloat($('f-qty').value);
  if (isNaN(q) || q <= 0) q = 1;
  var u = $('f-unit').value;
  if (FOOD_UNITS.indexOf(u) < 0) u = DEFAULT_FOOD_UNIT;
  return { qty: q, unit: u };
}
/* The text sent for a name calculation: "<qty> <unit> of <name>" with
   English unit words whenever quantity/unit differ from the defaults
   (1 serving); at the defaults the typed name goes exactly as-is, as
   it did before this feature existed. The stored meal name always
   keeps the user's typed words — qty/unit live in their own fields. */
function composeEstimateText(name, qu) {
  if (qu.qty === 1 && qu.unit === DEFAULT_FOOD_UNIT) return name;
  return qu.qty + ' ' + UNIT_SERVER_WORD[qu.unit] + ' of ' + name;
}
/* "2 slices" / "1 컵" prefix for a stored meal, in the screen language
   (plural label when the quantity isn't 1; Korean labels don't change
   form). Meals saved before this feature have no qty/unit and show no
   prefix. */
function formatQtyUnit(m) {
  if (!m || typeof m.qty !== 'number' || FOOD_UNITS.indexOf(m.unit) < 0) return '';
  return m.qty + ' ' + t(unitLabelKey(m.unit) + (m.qty !== 1 ? 'Pl' : ''));
}
/* Fill the form's number fields from an estimate object (both paths). */
function fillEstimateNumbers(data) {
  setFormValues({
    cal: data.calories || 0, carbs: data.carbs_g || 0, protein: data.protein_g || 0,
    fat: data.fat_g || 0, fiber: data.fiber_g || 0, sugar: data.sugar_g || 0
  });
}
$('photo-estimate').addEventListener('click', function () {
  if (!currentPhotoBlob) return;
  var btn = $('photo-estimate');
  var oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('looking');
  hideEstimateNote();
  blobToBase64(currentPhotoBlob).then(function (b64) {
    return proxyEstimate({ image: b64, mimeType: 'image/jpeg' });
  }).then(function (data) {
    if (data && data.error === 'not_food') {
      alert(t('alertNotFood'));
      return;
    }
    if (!data || data.error || typeof data.calories === 'undefined') throw serviceError();
    if (data.name) $('f-name').value = data.name;
    fillEstimateNumbers(data);
    showEstimateNote();
  }).catch(function (err) {
    alert(t(err && err.serviceError ? 'alertEstimateBusy' : 'alertEstimateFail'));
  }).then(function () {
    btn.disabled = false;
    btn.textContent = oldText;
  });
});
/* "✨ Calculate from name": POST the meal name/description she typed.
   On success only the number fields are filled — the name field keeps
   exactly what she typed (her words for her meal; the estimate's name
   is not obviously better and silently replacing her text would be a
   surprise). The estimate note still tells her to check the numbers. */
$('name-estimate').addEventListener('click', function () {
  var name = $('f-name').value.trim();
  if (!name) {
    alert(t('alertNameEmpty'));
    $('f-name').focus();
    return;
  }
  var btn = $('name-estimate');
  var oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('lookingName');
  hideEstimateNote();
  proxyEstimate({ text: composeEstimateText(name, readQtyUnit()) }).then(function (data) {
    if (data && data.error === 'not_food') {
      alert(t('alertNotFoodName'));
      return;
    }
    if (!data || data.error || typeof data.calories === 'undefined') throw serviceError();
    fillEstimateNumbers(data);
    showEstimateNote();
  }).catch(function (err) {
    alert(t(err && err.serviceError ? 'alertEstimateBusy' : 'alertEstimateFail'));
  }).then(function () {
    btn.disabled = false;
    btn.textContent = oldText;
  });
});

function setFormValues(v) {
  $('f-cal').value = round(v.cal); $('f-carbs').value = round(v.carbs);
  $('f-protein').value = round(v.protein); $('f-fat').value = round(v.fat);
  $('f-fiber').value = round(v.fiber); $('f-sugar').value = round(v.sugar);
  updateReview();
}
function updateReview() {
  var name = $('f-name').value.trim() || t('thisMeal');
  $('review-line').textContent = fill(t('reviewLine'), {
    name: name, carbs: round(num($('f-carbs'))), cal: round(num($('f-cal')))
  });
}
function resetForm() {
  editingId = null;
  selectedFood = null;
  clearPhotoState();
  $('add-title').textContent = t('addMeal');
  $('save-btn').textContent = t('saveMeal');
  $('meal-form').reset();
  $('f-servings').value = 1;
  /* Quantity always restarts at 1; the unit restarts at the last one used. */
  $('f-qty').value = 1;
  $('f-unit').value = lastFoodUnit;
  setFormValues({ cal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugar: 0 });
}
function startEdit(id) {
  var m = meals.filter(function (x) { return String(x.id) === String(id); })[0];
  if (!m) return;
  editingId = m.id;
  selectedFood = null;
  clearPhotoState();
  $('add-title').textContent = t('editMeal');
  $('save-btn').textContent = t('saveChanges');
  $('f-name').value = m.name;
  $('f-type').value = m.type;
  $('f-servings').value = 1;
  $('f-qty').value = (typeof m.qty === 'number' && m.qty > 0) ? m.qty : 1;
  $('f-unit').value = FOOD_UNITS.indexOf(m.unit) >= 0 ? m.unit : DEFAULT_FOOD_UNIT;
  setFormValues(m);
  var editId = m.id;
  photoGet(m.id).then(function (blob) {
    /* Show the stored photo unless the user has already changed it in this edit. */
    if (blob && editingId === editId && !pendingPhotoBlob && !pendingPhotoRemoved) {
      setPhotoPreview(blob);
    }
  });
  showView('add');
}
$('f-servings').addEventListener('input', function () {
  if (!selectedFood) return;
  var s = num(this) || 1;
  setFormValues({
    cal: selectedFood.cal * s, carbs: selectedFood.carbs * s,
    protein: selectedFood.protein * s, fat: selectedFood.fat * s,
    fiber: selectedFood.fiber * s, sugar: selectedFood.sugar * s
  });
});
['f-name', 'f-cal', 'f-carbs', 'f-protein', 'f-fat', 'f-fiber', 'f-sugar'].forEach(function (id) {
  $(id).addEventListener('input', updateReview);
});
$('clear-btn').addEventListener('click', resetForm);
$('meal-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = $('f-name').value.trim();
  if (!name) { $('f-name').focus(); return; }
  var qu = readQtyUnit();
  var values = {
    name: name, type: $('f-type').value, qty: qu.qty, unit: qu.unit,
    cal: num($('f-cal')), carbs: num($('f-carbs')), protein: num($('f-protein')),
    fat: num($('f-fat')), fiber: num($('f-fiber')), sugar: num($('f-sugar'))
  };
  /* Remember this unit for the next entry (quantity still resets to 1). */
  lastFoodUnit = qu.unit;
  try { localStorage.setItem(FOOD_UNIT_KEY, qu.unit); } catch (e) {}
  var savedId;
  if (editingId !== null) {
    savedId = editingId;
    meals.forEach(function (m) { if (m.id === editingId) Object.assign(m, values); });
  } else {
    var now = new Date();
    values.id = Date.now();
    values.date = todayKey();
    values.time = now.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
    savedId = values.id;
    meals.push(values);
    /* Remember the food for My Foods. New meals only: re-saving an edit
       does not change the remembered list (v1 scope). */
    rememberMyFood(values);
  }
  saveJSON(MEALS_KEY, meals);
  if (pendingPhotoBlob) photoPut(savedId, pendingPhotoBlob);
  else if (pendingPhotoRemoved) photoDelete(savedId);
  clearPhotoState();
  editingId = null;
  showView('today');
});

/* ---------- My Foods ---------- */
/* One saved food is the same food as another when the name (ignoring
   case and surrounding spaces), quantity and unit all match. */
function myFoodKey(name, qty, unit) {
  return String(name).trim().toLowerCase() + '|' + qty + '|' + unit;
}
function saveMyFoods() { saveJSON(MYFOODS_KEY, myFoods); }
/* Display order: favorites first, then most recently used first. */
function sortedMyFoods() {
  return myFoods.slice().sort(function (a, b) {
    if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
    return (b.lastUsed || 0) - (a.lastUsed || 0);
  });
}
/* Remember a just-saved meal. Saving the same food again refreshes its
   numbers and recency instead of adding a second entry. When the list
   outgrows the cap, the least recently used non-favorites go first. */
function rememberMyFood(values) {
  var key = myFoodKey(values.name, values.qty, values.unit);
  var found = null;
  myFoods.forEach(function (f) {
    if (myFoodKey(f.name, f.qty, f.unit) === key) found = f;
  });
  if (found) {
    found.calories = values.cal; found.carbs_g = values.carbs;
    found.protein_g = values.protein; found.fat_g = values.fat;
    found.fiber_g = values.fiber; found.sugar_g = values.sugar;
    found.lastUsed = Date.now();
    found.useCount = (found.useCount || 0) + 1;
  } else {
    myFoods.push({
      name: values.name, qty: values.qty, unit: values.unit,
      calories: values.cal, carbs_g: values.carbs, protein_g: values.protein,
      fat_g: values.fat, fiber_g: values.fiber, sugar_g: values.sugar,
      favorite: false, lastUsed: Date.now(), useCount: 1
    });
    while (myFoods.length > MYFOODS_CAP) {
      var evict = -1, oldest = Infinity;
      myFoods.forEach(function (f, i) {
        if (!f.favorite && (f.lastUsed || 0) < oldest) { oldest = f.lastUsed || 0; evict = i; }
      });
      if (evict < 0) { /* every entry is a favorite — evict the oldest overall */
        evict = 0;
        myFoods.forEach(function (f, i) {
          if ((f.lastUsed || 0) < (myFoods[evict].lastUsed || 0)) evict = i;
        });
      }
      myFoods.splice(evict, 1);
    }
  }
  saveMyFoods();
  renderMyFoods();
}
/* One tap on a saved food's + : log it for today with exactly the saved
   name, quantity/unit and numbers — the same meal record shape a manual
   save makes (the meal type is whatever the form's Meal select is
   currently set to). No calculation call. Same feedback as a normal
   save: land back on Today with the meal in the list. */
function addMyFoodToToday(entry) {
  var now = new Date();
  var meal = {
    id: Date.now(),
    date: todayKey(),
    time: now.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }),
    name: entry.name, type: $('f-type').value,
    qty: entry.qty, unit: entry.unit,
    cal: entry.calories, carbs: entry.carbs_g, protein: entry.protein_g,
    fat: entry.fat_g, fiber: entry.fiber_g, sugar: entry.sugar_g
  };
  meals.push(meal);
  saveJSON(MEALS_KEY, meals);
  entry.lastUsed = Date.now();
  entry.useCount = (entry.useCount || 0) + 1;
  saveMyFoods();
  renderMyFoods();
  showView('today');
}
function renderMyFoods() {
  var wrap = $('myfoods');
  if (!wrap) return;
  var list = sortedMyFoods();
  /* No saved foods yet: the whole section stays hidden, so a new user
     never sees an empty box on the Add screen. */
  if (!list.length) {
    wrap.classList.add('hidden');
    $('myfoods-list').innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');
  $('myfoods-count').textContent = list.length;
  $('myfoods-arrow').textContent = myFoodsOpen ? '▾' : '▸';
  $('myfoods-toggle').setAttribute('aria-expanded', myFoodsOpen ? 'true' : 'false');
  var listEl = $('myfoods-list');
  listEl.classList.toggle('hidden', !myFoodsOpen);
  if (!myFoodsOpen) { listEl.innerHTML = ''; return; }
  listEl.innerHTML = list.map(function (f, i) {
    var qu = formatQtyUnit(f);
    return '<div class="myfood-row">' +
      '<button type="button" class="myfood-fav" data-mf-fav="' + i + '" aria-label="' + esc(t('myFoodsFav')) + '">' + (f.favorite ? '⭐' : '☆') + '</button>' +
      '<span class="myfood-main"><span class="myfood-name">' + esc(f.name) + '</span>' +
      (qu ? '<span class="myfood-qu"> · ' + esc(qu) + '</span>' : '') + '</span>' +
      '<span class="myfood-cal">' + fill(t('myFoodsCal'), { n: round(f.calories) }) + '</span>' +
      '<button type="button" class="myfood-add" data-mf-add="' + i + '" aria-label="' + esc(t('myFoodsAddBtn')) + '">+</button>' +
      '<button type="button" class="myfood-del" data-mf-del="' + i + '" aria-label="' + esc(t('myFoodsDelete')) + '">×</button>' +
      '</div>';
  }).join('');
  listEl.querySelectorAll('[data-mf-fav]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = list[Number(b.getAttribute('data-mf-fav'))];
      if (!f) return;
      f.favorite = !f.favorite;
      saveMyFoods();
      renderMyFoods();
    });
  });
  listEl.querySelectorAll('[data-mf-add]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = list[Number(b.getAttribute('data-mf-add'))];
      if (f) addMyFoodToToday(f);
    });
  });
  listEl.querySelectorAll('[data-mf-del]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = list[Number(b.getAttribute('data-mf-del'))];
      if (!f) return;
      myFoods = myFoods.filter(function (x) { return x !== f; });
      saveMyFoods();
      renderMyFoods();
    });
  });
}
$('myfoods-toggle').addEventListener('click', function () {
  myFoodsOpen = !myFoodsOpen;
  try { localStorage.setItem(MYFOODS_OPEN_KEY, myFoodsOpen ? '1' : '0'); } catch (e) {}
  renderMyFoods();
});

/* ---------- Trends ---------- */
var trendDays = 7;
$('trend-week').addEventListener('click', function () { trendDays = 7; renderTrends(); });
$('trend-month').addEventListener('click', function () { trendDays = 30; renderTrends(); });
function renderTrends() {
  $('trend-week').classList.toggle('active', trendDays === 7);
  $('trend-month').classList.toggle('active', trendDays === 30);
  var days = [];
  for (var i = trendDays - 1; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
    var key = dateKey(d);
    var tot = totalsFor(key);
    days.push({ date: d, key: key, carbs: tot.carbs, cal: tot.cal, count: mealsOn(key).length });
  }
  var maxCarbs = Math.max.apply(null, days.map(function (x) { return x.carbs; }).concat([goals.carbGoal, 1]));
  var chart = $('chart-carbs');
  var bars = days.map(function (x, idx) {
    var h = Math.max(2, (x.carbs / maxCarbs) * 100);
    var label = trendDays === 7
      ? t('weekLetters')[x.date.getDay()]
      : (idx % 5 === 0 || idx === days.length - 1 ? String(x.date.getDate()) : '');
    return '<div class="bar-wrap"><div class="bar' + (x.carbs > goals.carbGoal ? ' over' : '') +
      '" style="height:' + h + '%" title="' + round(x.carbs) + 'g"></div>' +
      '<div class="bar-label">' + label + '</div></div>';
  }).join('');
  var goalPct = (goals.carbGoal / maxCarbs) * 100;
  chart.innerHTML = bars +
    '<div class="goal-line" style="bottom:' + (16 + goalPct * 0.82) + '%"></div>' +
    '<div class="goal-tag" style="bottom:' + (19 + goalPct * 0.82) + '%">' + fill(t('goalTag'), { n: goals.carbGoal }) + '</div>';
  var logged = days.filter(function (x) { return x.count > 0; }).length;
  var avgCarbs = days.reduce(function (s, x) { return s + x.carbs; }, 0) / trendDays;
  var avgCal = days.reduce(function (s, x) { return s + x.cal; }, 0) / trendDays;
  var dayWord = lang === 'ko' ? '' : (logged === 1 ? (lang === 'es' ? 'día registrado' : 'day') : (lang === 'es' ? 'días registrados' : 'days'));
  $('chart-stats').textContent = fill(t('chartStats'), {
    days: trendDays, carbs: round(avgCarbs), cal: round(avgCal), logged: logged, dayWord: dayWord
  });
  var withMeals = days.filter(function (x) { return x.count > 0; }).reverse();
  $('day-list').innerHTML = withMeals.length ? withMeals.map(function (x) {
    return '<div class="day-row"><span>' + x.date.toLocaleDateString(locale(), {
      weekday: 'short', month: 'short', day: 'numeric'
    }) + '</span><span><span class="d-carbs">' + fill(t('dayCarbs'), { n: round(x.carbs) }) + '</span> · ' +
      round(x.cal) + ' cal</span></div>';
  }).join('') : '<p class="empty-note">' + t('trendsEmpty') + '</p>';
}

/* ---------- Goals + calculator ---------- */
/* Units: the profile is always stored in metric (cm / kg) and the goal
   math below always reads metric. The units toggle only changes how
   height and weight are shown and typed here; conversion happens at
   this UI boundary (inches total × 2.54; lb × 0.45359237) and converted
   values are rounded to 0.1 before they are stored or used. */
var CM_PER_IN = 2.54, KG_PER_LB = 0.45359237;
function round1(x) { return Math.round(x * 10) / 10; }
function cmToFtIn(cm) {
  var totalIn = cm / CM_PER_IN;
  var ft = Math.floor(totalIn / 12);
  var inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return { ft: ft, inch: inch };
}
function ftInToCm(ft, inch) { return (ft * 12 + inch) * CM_PER_IN; }
function kgToLb(kg) { return Math.round(kg / KG_PER_LB); }
function lbToKg(lb) { return lb * KG_PER_LB; }
function fillHeightFields(cm) {
  $('c-height').value = cm;
  var p = cmToFtIn(cm);
  $('c-height-ft').value = p.ft;
  $('c-height-in').value = p.inch;
}
function fillWeightFields(kg) {
  $('c-weight').value = kg;
  $('c-weight-lb').value = kgToLb(kg);
}
function renderUnits() {
  var imp = units === 'imperial';
  $('units-metric').classList.toggle('active', !imp);
  $('units-imperial').classList.toggle('active', imp);
  $('c-height-label').textContent = t('heightLabel');
  $('c-height-imp-label').textContent = t('heightLabelImp');
  $('c-weight-label').textContent = t('weightLabel');
  $('c-weight-imp-label').textContent = t('weightLabelImp');
  $('c-height-wrap').classList.toggle('hidden', imp);
  $('c-height-imp-wrap').classList.toggle('hidden', !imp);
  $('c-weight-wrap').classList.toggle('hidden', imp);
  $('c-weight-imp-wrap').classList.toggle('hidden', !imp);
}
function setUnits(next) {
  if (next !== units) {
    /* Convert whatever is currently shown into the new mode's fields,
       so switching modes never loses a typed value. */
    if (next === 'imperial') {
      var h = num($('c-height'));
      if (h) fillHeightFields(h); else { $('c-height-ft').value = ''; $('c-height-in').value = ''; }
      var w = num($('c-weight'));
      $('c-weight-lb').value = w ? kgToLb(w) : '';
    } else {
      var ft = num($('c-height-ft')), inch = num($('c-height-in'));
      $('c-height').value = (ft || inch) ? round1(ftInToCm(ft, inch)) : '';
      var lb = num($('c-weight-lb'));
      $('c-weight').value = lb ? round1(lbToKg(lb)) : '';
    }
    units = next;
    try { localStorage.setItem(UNITS_KEY, units); } catch (e) {}
  }
  renderUnits();
}
$('units-metric').addEventListener('click', function () { setUnits('metric'); });
$('units-imperial').addEventListener('click', function () { setUnits('imperial'); });
/* Read height / weight as metric, whichever mode is showing. */
function readHeightCm() {
  if (units === 'imperial') {
    var ft = num($('c-height-ft')), inch = num($('c-height-in'));
    return (ft || inch) ? round1(ftInToCm(ft, inch)) : 0;
  }
  return num($('c-height'));
}
function readWeightKg() {
  if (units === 'imperial') {
    var lb = num($('c-weight-lb'));
    return lb ? round1(lbToKg(lb)) : 0;
  }
  return num($('c-weight'));
}
function renderGoals() {
  $('g-carbs').value = goals.carbGoal;
  $('g-cal').value = goals.calGoal;
  if (profile.sex) $('c-sex').value = profile.sex;
  if (profile.age) $('c-age').value = profile.age;
  if (profile.height) fillHeightFields(profile.height);
  if (profile.weight) fillWeightFields(profile.weight);
  if (profile.activity) $('c-activity').value = profile.activity;
  if (profile.aim) $('c-aim').value = profile.aim;
  renderUnits();
}
$('goals-save').addEventListener('click', function () {
  var c = num($('g-carbs')), k = num($('g-cal'));
  if (c > 0) goals.carbGoal = c;
  if (k > 0) goals.calGoal = k;
  saveJSON(GOALS_KEY, goals);
  $('goals-save').textContent = t('savedCheck');
  setTimeout(function () { $('goals-save').textContent = t('saveGoals'); }, 1500);
});
var lastSuggestion = null;
$('calc-btn').addEventListener('click', function () {
  var sex = $('c-sex').value;
  var age = num($('c-age')), h = readHeightCm(), w = readWeightKg();
  var act = parseFloat($('c-activity').value), aim = parseFloat($('c-aim').value);
  if (!age || !h || !w || h < 100 || h > 250 || w < 30 || w > 300) {
    $('calc-result').textContent = t('calcFillIn');
    $('calc-use').classList.add('hidden');
    return;
  }
  /* Mifflin–St Jeor */
  var bmr = (10 * w) + (6.25 * h) - (5 * age) + (sex === 'male' ? 5 : -161);
  lastSuggestion = Math.round((bmr * act * aim) / 10) * 10;
  profile = { sex: sex, age: age, height: h, weight: w, activity: $('c-activity').value, aim: $('c-aim').value };
  saveJSON(PROFILE_KEY, profile);
  $('calc-result').textContent = fill(t('calcSuggested'), { n: lastSuggestion });
  $('calc-use').classList.remove('hidden');
});
$('calc-use').addEventListener('click', function () {
  if (!lastSuggestion) return;
  goals.calGoal = lastSuggestion;
  saveJSON(GOALS_KEY, goals);
  $('g-cal').value = lastSuggestion;
  $('calc-result').textContent = fill(t('calcSaved'), { n: lastSuggestion });
  $('calc-use').classList.add('hidden');
});
$('wipe-btn').addEventListener('click', function () {
  if (!confirm(t('wipeConfirm'))) return;
  localStorage.removeItem(MEALS_KEY);
  localStorage.removeItem(GOALS_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(MYFOODS_KEY);
  localStorage.removeItem(MYFOODS_OPEN_KEY);
  photoClear();
  meals = []; goals = { carbGoal: 180, calGoal: 1800 }; profile = {};
  myFoods = []; myFoodsOpen = false;
  renderMyFoods();
  resetForm(); renderGoals();
  alert(t('wipeDone'));
  showView('today');
});

/* ---------- Init ---------- */
$('lang-select').addEventListener('change', function () {
  if (!STRINGS[this.value]) return;
  lang = this.value;
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  applyLanguage();
});
applyLanguage();
resetForm();
renderToday();
