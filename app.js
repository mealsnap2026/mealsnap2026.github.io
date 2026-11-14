/* MealSnap — standalone meal macro counter.
   No sign-in: meals live in this phone's localStorage. The app's one
   network call is the optional ✨ Calculate from photo (see the AI
   photo calculation section below). */
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
    fCalories: 'Calories', fCarbs: 'Carbs (g)', fProtein: 'Protein (g)', fFat: 'Fat (g)', fFiber: 'Fiber (g)', fSugar: 'Sugar (g)',
    photoOptional: 'Photo (optional)',
    takePhoto: '📷 Take a photo', pickGallery: '🖼️ Pick from gallery',
    changePhotoCam: '📷 Change photo', changePhotoGallery: '🖼️ Change photo',
    removePhoto: 'Remove photo', calcPhoto: '✨ Calculate from photo',
    photoHint: "Take a photo or pick one from your gallery. Photos stay on this phone — a photo is sent to MealSnap's calculation service (which asks Google Gemini) only when you tap ✨ Calculate.",
    estimateNote: '✨ AI estimate — please check the numbers before saving.',
    looking: 'Looking at your meal…',
    alertPhotoFail: 'Sorry, that photo could not be added. Please try another one.',
    alertNotFood: "That photo doesn't look like food — try a photo of your meal, or type the numbers in.",
    alertEstimateFail: "The estimate didn't work (check your connection) — you can still type the numbers in.",
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
    myDataHint: "Your meals and meal photos are saved only on this phone. No account, no sign-in. Nothing is sent anywhere unless you tap ✨ Calculate from photo — then that one photo is sent to MealSnap's calculation service, which asks Google Gemini for an estimate.",
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
    fCalories: '칼로리', fCarbs: '탄수화물 (g)', fProtein: '단백질 (g)', fFat: '지방 (g)', fFiber: '식이섬유 (g)', fSugar: '당류 (g)',
    photoOptional: '사진 (선택)',
    takePhoto: '📷 사진 찍기', pickGallery: '🖼️ 갤러리에서 선택',
    changePhotoCam: '📷 사진 변경', changePhotoGallery: '🖼️ 사진 변경',
    removePhoto: '사진 삭제', calcPhoto: '✨ 사진으로 계산하기',
    photoHint: '사진을 찍거나 갤러리에서 선택하세요. 사진은 이 휴대폰에만 저장됩니다 — ✨ 계산하기를 누를 때만 사진이 MealSnap 계산 서비스(Google Gemini에 문의)로 전송됩니다.',
    estimateNote: '✨ AI 추정값입니다 — 저장하기 전에 숫자를 확인하세요.',
    looking: '식사를 살펴보는 중…',
    alertPhotoFail: '죄송합니다. 이 사진을 추가할 수 없습니다. 다른 사진으로 시도해 보세요.',
    alertNotFood: '이 사진은 음식으로 보이지 않아요 — 식사 사진을 사용하거나 숫자를 직접 입력해 보세요.',
    alertEstimateFail: '계산이 되지 않았습니다 (연결을 확인하세요) — 숫자를 직접 입력할 수 있습니다.',
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
    myDataHint: '식사와 식사 사진은 이 휴대폰에만 저장됩니다. 계정도, 로그인도 없습니다. ✨ 사진으로 계산하기를 누르지 않는 한 아무것도 전송되지 않습니다 — 누르면 그 사진 한 장이 MealSnap 계산 서비스로 전송되고, 서비스가 Google Gemini에 추정값을 요청합니다.',
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
    fCalories: 'Calorías', fCarbs: 'Carbohidratos (g)', fProtein: 'Proteínas (g)', fFat: 'Grasas (g)', fFiber: 'Fibra (g)', fSugar: 'Azúcar (g)',
    photoOptional: 'Foto (opcional)',
    takePhoto: '📷 Tomar una foto', pickGallery: '🖼️ Elegir de la galería',
    changePhotoCam: '📷 Cambiar foto', changePhotoGallery: '🖼️ Cambiar foto',
    removePhoto: 'Quitar foto', calcPhoto: '✨ Calcular desde la foto',
    photoHint: 'Toma una foto o elige una de tu galería. Las fotos se quedan en este teléfono: una foto se envía al servicio de cálculo de MealSnap (que consulta a Google Gemini) solo cuando tocas ✨ Calcular.',
    estimateNote: '✨ Estimación de IA: revisa los números antes de guardar.',
    looking: 'Mirando tu comida…',
    alertPhotoFail: 'Lo sentimos, no se pudo añadir esa foto. Prueba con otra.',
    alertNotFood: 'Esa foto no parece comida: prueba con una foto de tu comida o escribe los números.',
    alertEstimateFail: 'La estimación no funcionó (revisa tu conexión); aún puedes escribir los números.',
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
    myDataHint: 'Tus comidas y las fotos de tus comidas se guardan solo en este teléfono. Sin cuenta y sin inicio de sesión. No se envía nada a menos que toques ✨ Calcular desde la foto: entonces esa única foto se envía al servicio de cálculo de MealSnap, que pide una estimación a Google Gemini.',
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
  renderToday();
  renderTrends();
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
    return '<div class="meal-card">' +
      '<img class="meal-thumb hidden" data-thumb="' + m.id + '" alt="' + esc(fill(t('photoAlt'), { name: m.name })) + '">' +
      '<div class="meal-body">' +
      '<div class="meal-top"><span class="meal-name">' + esc(m.name) + '</span>' +
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

/* ---------- AI photo calculation (server version — NO key in the app) ----------
   When the user taps "✨ Calculate from photo", the photo is POSTed to
   MealSnap's own calculation service — a Google Apps Script web app that
   holds the Google Gemini key server-side and forwards the photo to
   Gemini (the estimator prompt lives in the proxy too). The app contains
   no API key and the user needs none. Nothing is sent anywhere until she
   taps Calculate, and only that one photo goes. The estimated numbers
   fill the form, always editable, and if anything goes wrong she can
   still type the numbers in as before.
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
/* Ask the calculation service for an estimate of the photo (base64 JPEG)
   and resolve with its parsed JSON: either the estimate object
   {name, calories, carbs_g, protein_g, fat_g, fiber_g, sugar_g},
   {error: 'not_food'}, or another {error: ...} object.
   The Content-Type is text/plain on purpose: Apps Script web apps don't
   answer CORS preflights, and a "simple" request avoids the preflight;
   Apps Script replies with a redirect that fetch follows to the JSON. */
function proxyEstimate(base64) {
  return fetch(ESTIMATE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ image: base64, mimeType: 'image/jpeg' })
  }).then(function (res) {
    if (!res.ok) throw new Error('Estimate service failed (' + res.status + ')');
    return res.json();
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
    return proxyEstimate(b64);
  }).then(function (data) {
    if (data && data.error === 'not_food') {
      alert(t('alertNotFood'));
      return;
    }
    if (!data || data.error || typeof data.calories === 'undefined') throw new Error('Bad estimate');
    if (data.name) $('f-name').value = data.name;
    setFormValues({
      cal: data.calories || 0, carbs: data.carbs_g || 0, protein: data.protein_g || 0,
      fat: data.fat_g || 0, fiber: data.fiber_g || 0, sugar: data.sugar_g || 0
    });
    showEstimateNote();
  }).catch(function () {
    alert(t('alertEstimateFail'));
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
  var values = {
    name: name, type: $('f-type').value,
    cal: num($('f-cal')), carbs: num($('f-carbs')), protein: num($('f-protein')),
    fat: num($('f-fat')), fiber: num($('f-fiber')), sugar: num($('f-sugar'))
  };
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
  }
  saveJSON(MEALS_KEY, meals);
  if (pendingPhotoBlob) photoPut(savedId, pendingPhotoBlob);
  else if (pendingPhotoRemoved) photoDelete(savedId);
  clearPhotoState();
  editingId = null;
  showView('today');
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
function renderGoals() {
  $('g-carbs').value = goals.carbGoal;
  $('g-cal').value = goals.calGoal;
  if (profile.sex) $('c-sex').value = profile.sex;
  if (profile.age) $('c-age').value = profile.age;
  if (profile.height) $('c-height').value = profile.height;
  if (profile.weight) $('c-weight').value = profile.weight;
  if (profile.activity) $('c-activity').value = profile.activity;
  if (profile.aim) $('c-aim').value = profile.aim;
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
  var age = num($('c-age')), h = num($('c-height')), w = num($('c-weight'));
  var act = parseFloat($('c-activity').value), aim = parseFloat($('c-aim').value);
  if (!age || !h || !w) {
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
  photoClear();
  meals = []; goals = { carbGoal: 180, calGoal: 1800 }; profile = {};
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
