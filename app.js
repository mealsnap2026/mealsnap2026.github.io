/* MealSnap — standalone, local-only meal macro counter.
   No sign-in, no server: meals live in this phone's localStorage. */
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
   Nothing is ever uploaded. If IndexedDB is unavailable, every photo function
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
  $('today-date').textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  var t = totalsFor(todayKey());
  $('carb-total').textContent = round(t.carbs);
  $('carb-goal-label').textContent = goals.carbGoal;
  $('cal-goal-label').textContent = goals.calGoal;
  $('cal-total').textContent = round(t.cal);
  $('protein-total').textContent = round(t.protein) + 'g';
  $('fat-total').textContent = round(t.fat) + 'g';
  var pct = goals.carbGoal > 0 ? Math.min(100, (t.carbs / goals.carbGoal) * 100) : 0;
  var fill = $('carb-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', t.carbs > goals.carbGoal);
  var left = goals.carbGoal - t.carbs;
  $('carb-left').textContent = left >= 0
    ? left.toFixed(0) + 'g left today'
    : Math.abs(left).toFixed(0) + 'g over today — it happens, tomorrow is a new day';

  var list = $('meal-list');
  var todays = mealsOn(todayKey());
  $('meal-empty').style.display = todays.length ? 'none' : 'block';
  list.innerHTML = todays.map(function (m) {
    return '<div class="meal-card">' +
      '<img class="meal-thumb hidden" data-thumb="' + m.id + '" alt="Photo of ' + esc(m.name) + '">' +
      '<div class="meal-body">' +
      '<div class="meal-top"><span class="meal-name">' + esc(m.name) + '</span>' +
      '<span class="meal-type">' + esc(m.type) + '</span></div>' +
      '<div class="meal-macros"><strong>' + round(m.carbs) + 'g carbs</strong> · ' +
      round(m.cal) + ' cal · ' + round(m.protein) + 'g protein · ' + round(m.fat) + 'g fat' +
      (m.fiber ? ' · ' + round(m.fiber) + 'g fiber' : '') +
      (m.sugar ? ' · ' + round(m.sugar) + 'g sugar' : '') +
      (m.time ? ' · ' + esc(m.time) : '') + '</div>' +
      '<div class="meal-actions">' +
      '<button class="small-btn" data-edit="' + m.id + '">Edit</button>' +
      '<button class="small-btn danger" data-del="' + m.id + '">Delete</button>' +
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
    $('photo-add-label').textContent = '🖼️ Change photo';
  $('photo-cam-label').textContent = '📷 Change photo';
  } else {
    img.removeAttribute('src');
    img.classList.add('hidden');
    $('photo-remove').classList.add('hidden');
    $('photo-add-label').textContent = '🖼️ Pick from gallery';
  $('photo-cam-label').textContent = '📷 Take a photo';
  }
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
    alert('Sorry, that photo could not be added. Please try another one.');
  });
}
$('f-photo').addEventListener('change', handlePhotoPick);
$('f-photo-cam').addEventListener('change', handlePhotoPick);
$('photo-remove').addEventListener('click', function () {   pendingPhotoBlob = null;   pendingPhotoRemoved = true;   $('f-photo').value = '';   $('f-photo-cam').value = '';   setPhotoPreview(null); });  /* ---------- AI photo calculation (Google Gemini — user's own key, on this phone only) ----------    The user pastes her own free Gemini API key in Goals; it lives ONLY in    localStorage on this phone, never in the app code. Nothing is sent anywhere    until she taps "✨ Calculate from photo" — then that one photo goes to    Google Gemini and the estimated numbers fill the form, always editable.    If anything goes wrong she can still type the numbers in as before. */ var GEMINI_KEY_STORE = 'mealsnap-gemini-key'; var ESTIMATE_PROMPT = 'You are a nutrition estimator for a meal-tracking app. Look at this meal photo and estimate the nutrition for the pictured portion, treated as one serving. Reply with JSON only, no other text: {"name": "short meal name", "calories": number, "carbs_g": number, "protein_g": number, "fat_g": number, "fiber_g": number, "sugar_g": number}. Use plain numbers (grams for macros). If the photo does not show food or a drink, reply {"error": "not_food"}.';  function getGeminiKey() {   try { return localStorage.getItem(GEMINI_KEY_STORE) || ''; } catch (e) { return ''; } } function showEstimateNote() {   var n = $('estimate-note');   n.textContent = '✨ AI estimate — please check the numbers before saving.';   n.classList.remove('hidden'); } function hideEstimateNote() {   $('estimate-note').classList.add('hidden'); } function blobToBase64(blob) {   return new Promise(function (resolve, reject) {     var reader = new FileReader();     reader.onload = function () {       var s = String(reader.result || '');       resolve(s.slice(s.indexOf(',') + 1));     };     reader.onerror = function () { reject(new Error('Could not read photo')); }     
   reader.readAsDataURL(blob);   }); } /* Parse Gemini's reply text as JSON; tolerate stray prose around the object. */ function parseEstimate(text) {   try { return JSON.parse(text); } catch (e) { /* fall through */ }   var m = String(text).match(/\{[\s\S]*\}/);   if (m) { try { return JSON.parse(m[0]); } catch (e) { /* fall through */ } }   return null; } function geminiEstimate(key, base64, model) {   return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {     method: 'POST',     headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },     body: JSON.stringify({       contents: [{ parts: [         { text: ESTIMATE_PROMPT },         { inlineData: { mimeType: 'image/jpeg', data: base64 } }       ] }],       generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }     })   }).then(function (res) {     if (res.status === 404 && model === 'gemini-2.5-flash') {       return geminiEstimate(key, base64, 'gemini-3-flash-preview');     }     if (!res.ok) throw new Error('Gemini request failed (' + res.status + ')');     return res.json();   }).then(function (json) {     var parts = json && json.candidates && json.candidates[0] &&       json.candidates[0].content && json.candidates[0].content.parts;     var text = '';     if (parts) parts.forEach(function (p) { if (p.text) text += p.text; });     if (!text) throw new Error('Empty estimate');     return parseEstimate(text);   }); } $('photo-estimate').addEventListener('click', function () {   var key = getGeminiKey();   if (!key) {     alert('To calculate from a photo, first add your free Google Gemini key — you will find it in the Goals section, under "AI photo calculation".');     showView('goals');     return;   }   if (!currentPhotoBlob) return;   var btn = $('photo-estimate');   var oldText = btn.textContent;   btn.disabled = true;   btn.textContent = 'Looking at your meal…';   hideEstimateNote();   blobToBase64(currentPhotoBlob).then(function (b64) {     return geminiEstimate(key, b64, 'gemini-2.5-flash');   }).then(function (data) {     if (data && data.error === 'not_food') {       alert("That photo doesn't look like food — try a photo of your meal, or type the numbers in.");       return;     }     if (!data || typeof data.calories === 'undefined') throw new Error('Bad estimate');     if (data.name) $('f-name').value = data.name;     setFormValues({       cal: data.calories || 0, carbs: data.carbs_g || 0, protein: data.protein_g || 0,       fat: data.fat_g || 0, fiber: data.fiber_g || 0, sugar: data.sugar_g || 0     });     showEstimateNote();   }).catch(function () {     alert("The estimate didn't work (check your connection and key) — you can still type the numbers in.");   }).then(function () {     btn.disabled = false;     btn.textContent = oldText;   }); });  /* Gemini key settings (Goals view) */ function renderKeyState() {   var has = !!getGeminiKey();   $('key-state').textContent = has ? 'Key saved ✓' : '';   $('key-clear').classList.toggle('hidden', !has);   $('g-key').placeholder = has ? 'Key saved — paste a new key to replace it' : 'Paste your key here'; } $('key-save').addEventListener('click', function () {   var v = $('g-key').value.trim();   if (!v) { alert('Paste your Gemini key first, then tap Save key.'); return; }   try { localStorage.setItem(GEMINI_KEY_STORE, v); } catch (e) {}   $('g-key').value = '';   renderKeyState();   $('key-save').textContent = 'Saved ✓';   setTimeout(function () { $('key-save').textContent = 'Save key'; }, 1500); }); $('key-clear').addEventListener('click', function () {   try { localStorage.removeItem(GEMINI_KEY_STORE); } catch (e) {}   $('g-key').value = '';   renderKeyState(); });  function setFormValues(v) {
  $('f-cal').value = round(v.cal); $('f-carbs').value = round(v.carbs);
  $('f-protein').value = round(v.protein); $('f-fat').value = round(v.fat);
  $('f-fiber').value = round(v.fiber); $('f-sugar').value = round(v.sugar);
  updateReview();
}
function updateReview() {
  var name = $('f-name').value.trim() || 'This meal';
  $('review-line').textContent = 'Is this right? ' + name + ': ' +
    round(num($('f-carbs'))) + 'g carbs · ' + round(num($('f-cal'))) + ' cal — check the numbers, then save.';
}
function resetForm() {
  editingId = null;
  selectedFood = null;
  clearPhotoState();
  $('add-title').textContent = 'Add a meal';
  $('save-btn').textContent = 'Looks right — save meal';
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
  $('add-title').textContent = 'Edit meal';
  $('save-btn').textContent = 'Save changes';
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
    values.time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
    var t = totalsFor(key);
    days.push({ date: d, key: key, carbs: t.carbs, cal: t.cal, count: mealsOn(key).length });
  }
  var maxCarbs = Math.max.apply(null, days.map(function (x) { return x.carbs; }).concat([goals.carbGoal, 1]));
  var chart = $('chart-carbs');
  var bars = days.map(function (x, idx) {
    var h = Math.max(2, (x.carbs / maxCarbs) * 100);
    var label = trendDays === 7
      ? 'SMTWTFS'[x.date.getDay()]
      : (idx % 5 === 0 || idx === days.length - 1 ? String(x.date.getDate()) : '');
    return '<div class="bar-wrap"><div class="bar' + (x.carbs > goals.carbGoal ? ' over' : '') +
      '" style="height:' + h + '%" title="' + round(x.carbs) + 'g"></div>' +
      '<div class="bar-label">' + label + '</div></div>';
  }).join('');
  var goalPct = (goals.carbGoal / maxCarbs) * 100;
  chart.innerHTML = bars +
    '<div class="goal-line" style="bottom:' + (16 + goalPct * 0.82) + '%"></div>' +
    '<div class="goal-tag" style="bottom:' + (19 + goalPct * 0.82) + '%">goal ' + goals.carbGoal + 'g</div>';
  var logged = days.filter(function (x) { return x.count > 0; }).length;
  var avgCarbs = days.reduce(function (s, x) { return s + x.carbs; }, 0) / trendDays;
  var avgCal = days.reduce(function (s, x) { return s + x.cal; }, 0) / trendDays;
  $('chart-stats').textContent = 'Average over the last ' + trendDays + ' days: ' +
    round(avgCarbs) + 'g carbs · ' + round(avgCal) + ' cal per day · ' + logged + ' day' +
    (logged === 1 ? '' : 's') + ' logged.';
  var withMeals = days.filter(function (x) { return x.count > 0; }).reverse();
  $('day-list').innerHTML = withMeals.length ? withMeals.map(function (x) {
    return '<div class="day-row"><span>' + x.date.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    }) + '</span><span><span class="d-carbs">' + round(x.carbs) + 'g carbs</span> · ' +
      round(x.cal) + ' cal</span></div>';
  }).join('') : '<p class="empty-note">Nothing logged in this period yet.</p>';
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
     renderKeyState();
}
$('goals-save').addEventListener('click', function () {
  var c = num($('g-carbs')), k = num($('g-cal'));
  if (c > 0) goals.carbGoal = c;
  if (k > 0) goals.calGoal = k;
  saveJSON(GOALS_KEY, goals);
  $('goals-save').textContent = 'Saved ✓';
  setTimeout(function () { $('goals-save').textContent = 'Save goals'; }, 1500);
});
var lastSuggestion = null;
$('calc-btn').addEventListener('click', function () {
  var sex = $('c-sex').value;
  var age = num($('c-age')), h = num($('c-height')), w = num($('c-weight'));
  var act = parseFloat($('c-activity').value), aim = parseFloat($('c-aim').value);
  if (!age || !h || !w) {
    $('calc-result').textContent = 'Please fill in age, height, and weight to get a suggestion.';
    $('calc-use').classList.add('hidden');
    return;
  }
  /* Mifflin–St Jeor */
  var bmr = (10 * w) + (6.25 * h) - (5 * age) + (sex === 'male' ? 5 : -161);
  lastSuggestion = Math.round((bmr * act * aim) / 10) * 10;
  profile = { sex: sex, age: age, height: h, weight: w, activity: $('c-activity').value, aim: $('c-aim').value };
  saveJSON(PROFILE_KEY, profile);
  $('calc-result').textContent = 'Suggested daily calories for you: about ' + lastSuggestion +
    ' cal. This is an estimate — your doctor or care team can fine-tune it.';
  $('calc-use').classList.remove('hidden');
});
$('calc-use').addEventListener('click', function () {
  if (!lastSuggestion) return;
  goals.calGoal = lastSuggestion;
  saveJSON(GOALS_KEY, goals);
  $('g-cal').value = lastSuggestion;
  $('calc-result').textContent = 'Saved — your calorie goal is now ' + lastSuggestion + ' cal per day.';
  $('calc-use').classList.add('hidden');
});
$('wipe-btn').addEventListener('click', function () {
  if (!confirm('Delete ALL your MealSnap data on this phone? This cannot be undone.')) return;
  localStorage.removeItem(MEALS_KEY);
  localStorage.removeItem(GOALS_KEY);
  localStorage.removeItem(PROFILE_KEY);
     localStorage.removeItem(GEMINI_KEY_STORE);
  photoClear();
  meals = []; goals = { carbGoal: 180, calGoal: 1800 }; profile = {};
  resetForm(); renderGoals();
  alert('All MealSnap data on this phone has been deleted.');
  showView('today');
});

/* ---------- Init ---------- */
resetForm();
renderToday();
