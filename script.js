const birdList = document.getElementById('birdList');
const sortPrimary = document.getElementById('sortPrimary');
const sortSecondary = document.getElementById('sortSecondary');
const filterFamily = document.getElementById('filterFamily');
const filterType = document.getElementById('filterType');
const searchInput = document.getElementById('searchInput');
const resetButton = document.getElementById('resetButton');
const birdCounter = document.getElementById('birdCounter');

const STORAGE_FOUND = 'pokedexFoundState';
const STORAGE_IMAGES = 'pokedexCustomImages';
const STORAGE_SORT = 'pokedexSortState';
const STORAGE_FILTER = 'pokedexFilterState';
const STORAGE_PAGINATION = 'pokedexPagination';

const rarityOrder = {
  'bardzo rzadki': 0,
  'rzadki': 1,
  'regularny przelotny': 2,
  'średnio rzadki': 3,
  'pospolity': 4
};

const typeClassMap = {
  woda: 'type-water',
  morze: 'type-sea',
  bagno: 'type-bog',
  pole: 'type-field',
  las: 'type-forest',
  gory: 'type-mountain',
  gor: 'type-mountain',
  grzebiajacy: 'type-wading',
  rybozerny: 'type-fish',
  drapieznik: 'type-predator'
};

function getTypeClass(type) {
  if (!type) return 'type-default';
  const normalized = type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const stripped = normalized.replace(/ł/g, 'l')
    .replace(/[^a-z0-9]/g, '');
  return typeClassMap[stripped] || Object.entries(typeClassMap).find(([key]) => stripped.includes(key))?.[1] || 'type-default';
}

let birds = [];
let baseBirds = [];
let foundState = {};
let customImages = {};
let savedFilterState = {};
let currentPage = 1;
let perPage = 25;
let fuse = null;
let useFuse = true;

function initFuse() {
  if (typeof Fuse === 'undefined') {
    useFuse = false;
    return;
  }
  try {
    const options = {
      keys: ['polishName', 'latinName', 'family'],
      threshold: 0.35,
      ignoreLocation: true
    };
    fuse = new Fuse(baseBirds, options);
  } catch (e) {
    console.warn('Fuse init failed:', e);
    useFuse = false;
  }
}

function openImagesDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return resolve(null);
    }
    const request = indexedDB.open('pokedexDB', 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('birdImages')) {
        db.createObjectStore('birdImages');
      }
    };
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadImagesFromDB() {
  const db = await openImagesDB();
  if (!db) return {};
  return new Promise((resolve, reject) => {
    const tx = db.transaction('birdImages', 'readonly');
    const store = tx.objectStore('birdImages');
    const result = {};
    const request = store.openCursor();
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        result[cursor.key] = cursor.value;
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function saveImageToDB(birdId, dataUrl) {
  const db = await openImagesDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('birdImages', 'readwrite');
    const store = tx.objectStore('birdImages');
    const request = store.put(dataUrl, birdId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const fallbackBirds = [
  {
    id: 'jerzyk',
    polishName: 'Jerzyk zwyczajny',
    latinName: 'Apus apus',
    family: 'Jerzykowate',
    rarity: 'pospolity',
    description: 'Szybki ptak powietrzny, często obserwowany nad miastami i wsiami.',
    image: '',
    found: false
  },
  {
    id: 'kowalik',
    polishName: 'Kowalik zwyczajny',
    latinName: 'Sitta europaea',
    family: 'Sikorkowate',
    rarity: 'pospolity',
    description: 'Mały ptak z ostrym dziobem, często wspina się po pniach drzew.',
    image: '',
    found: false
  },
  {
    id: 'puszczyk',
    polishName: 'Puszczyk zwyczajny',
    latinName: 'Strix aluco',
    family: 'Sówowate',
    rarity: 'średnio rzadki',
    description: 'Nocny ptak drapieżny, charakterystyczny głos można usłyszeć w parkach i lasach.',
    image: '',
    found: false
  },
  {
    id: 'zuraw',
    polishName: 'Żuraw zwyczajny',
    latinName: 'Grus grus',
    family: 'Żurawiowate',
    rarity: 'rzadki',
    description: 'Duży ptak wędrowny, zamieszkuje mokradła i łąki.',
    image: '',
    found: false
  },
  {
    id: 'sikora',
    polishName: 'Sikora bogatka',
    latinName: 'Parus major',
    family: 'Sikorkowate',
    rarity: 'pospolity',
    description: 'Kolorowa sikora z czarną głową, często odwiedza karmniki zimą.',
    image: '',
    found: false
  },
  {
    id: 'dzieciol',
    polishName: 'Dzięcioł duży',
    latinName: 'Dendrocopos major',
    family: 'Dzięciołowate',
    rarity: 'średnio rzadki',
    description: 'Ptak leśny z bębnieniem w korze drzew i charakterystycznym czerwonym spodem.',
    image: '',
    found: false
  },
  {
    id: 'puchacz',
    polishName: 'Puchacz zwyczajny',
    latinName: 'Bubo bubo',
    family: 'Sówowate',
    rarity: 'bardzo rzadki',
    description: 'Jeden z największych europejskich sów, występuje w starych lasach i na klifach.',
    image: '',
    found: false
  },
  {
    id: 'jaskolka',
    polishName: 'Jaskółka dymówka',
    latinName: 'Hirundo rustica',
    family: 'Jaskółkowate',
    rarity: 'pospolity',
    description: 'Ptak wędrowny, buduje gniazda z błota pod okapami budynków.',
    image: '',
    found: false
  },
  {
    id: 'kruk',
    polishName: 'Kruk zwyczajny',
    latinName: 'Corvus corax',
    family: 'Krukowate',
    rarity: 'średnio rzadki',
    description: 'Duży, czarny ptak o inteligentnym zachowaniu, często w górach i lasach.',
    image: '',
    found: false
  },
  {
    id: 'kwiczol',
    polishName: 'Kwiczoł zwyczajny',
    latinName: 'Turdus pilaris',
    family: 'Drozdowate',
    rarity: 'średnio rzadki',
    description: 'Ptak wędrowny, w zimie odwiedza sady i ogrody.',
    image: '',
    found: false
  }
];

function loadBirdData() {
  fetch('birds.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Nie udało się pobrać danych ptaków');
      }
      return response.json();
    })
    .then(data => {
      baseBirds = data;
      initFuse();
      assembleBirdList();
      initializeApp();
    })
    .catch(() => {
      baseBirds = fallbackBirds;
      initFuse();
      assembleBirdList();
      initializeApp();
    });
}

async function initializeApp() {
  await loadState();
  populateFamilyFilter();
  populateTypeFilter();
  applySavedControls();
  renderBirds();
  addEventListeners();
}

async function loadState() {
  const storedFound = localStorage.getItem(STORAGE_FOUND);
  const storedImages = localStorage.getItem(STORAGE_IMAGES);
  const storedSort = localStorage.getItem(STORAGE_SORT);
  const storedFilter = localStorage.getItem(STORAGE_FILTER);
  const storedPagination = localStorage.getItem(STORAGE_PAGINATION);

  foundState = storedFound ? JSON.parse(storedFound) : {};
  try {
    customImages = storedImages ? JSON.parse(storedImages) : {};
  } catch (e) {
    customImages = {};
    console.warn('Nieprawidłowy format obrazów w localStorage:', e);
  }
  const dbImages = await loadImagesFromDB().catch(error => {
    console.warn('Nie udało się załadować obrazów z IndexedDB:', error);
    return {};
  });
  customImages = { ...customImages, ...dbImages };
  assembleBirdList();

  if (storedSort) {
    const sortState = JSON.parse(storedSort);
    sortPrimary.value = sortState.primary || 'polishName';
    sortSecondary.value = sortState.secondary || 'none';
  }

  if (storedFilter) {
    savedFilterState = JSON.parse(storedFilter);
  }
  if (storedPagination) {
    try {
      const p = JSON.parse(storedPagination);
      currentPage = p.page || currentPage;
      perPage = p.perPage || perPage;
    } catch (e) {
      // ignore
    }
  }
}

async function saveState() {
  try {
    localStorage.setItem(STORAGE_FOUND, JSON.stringify(foundState));
  } catch (error) {
    console.warn('Nie udało się zapisać stanu znalezionych ptaków:', error);
  }

  try {
    localStorage.setItem(STORAGE_IMAGES, JSON.stringify(customImages));
  } catch (error) {
    console.warn('Nie udało się zapisać obrazów w localStorage:', error);
  }

  try {
    for (const [birdId, dataUrl] of Object.entries(customImages)) {
      await saveImageToDB(birdId, dataUrl).catch(error => {
        console.warn(`Nie udało się zapisać obrazu ${birdId} w IndexedDB:`, error);
      });
    }
  } catch (e) {
    console.warn('Nie udało się zapisać obrazów w IndexedDB:', e);
  }

  try {
    localStorage.setItem(STORAGE_SORT, JSON.stringify({
      primary: sortPrimary.value,
      secondary: sortSecondary.value
    }));
  } catch (error) {
    console.warn('Nie udało się zapisać ustawień sortowania:', error);
  }

  try {
    localStorage.setItem(STORAGE_FILTER, JSON.stringify({
      family: filterFamily.value,
      type: filterType.value,
      search: searchInput.value.trim().toLowerCase()
    }));
  } catch (error) {
    console.warn('Nie udało się zapisać filtrów:', error);
  }
  try {
    localStorage.setItem(STORAGE_PAGINATION, JSON.stringify({ page: currentPage, perPage }));
  } catch (e) {
    console.warn('Nie udało się zapisać paginacji:', e);
  }
}

function populateFamilyFilter() {
  filterFamily.innerHTML = '<option value="all">Wszystkie</option>';
  const families = Array.from(new Set(birds.map(bird => bird.family))).sort((a, b) => a.localeCompare(b, 'pl'));
  families.forEach(family => {
    const option = document.createElement('option');
    option.value = family;
    option.textContent = family;
    filterFamily.append(option);
  });
}

function populateTypeFilter() {
  filterType.innerHTML = '<option value="all">Wszystkie</option>';
  const types = Array.from(new Set(birds.flatMap(bird => [bird.type1, bird.type2, bird.type3].filter(Boolean)))).sort((a, b) => a.localeCompare(b, 'pl'));
  types.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    filterType.append(option);
  });
}

function applySavedControls() {
  if (!sortPrimary.value) sortPrimary.value = 'polishName';
  if (!sortSecondary.value) sortSecondary.value = 'none';
  filterFamily.value = savedFilterState.family || 'all';
  filterType.value = savedFilterState.type || 'all';
  searchInput.value = savedFilterState.search || '';
}

function addEventListeners() {
  sortPrimary.addEventListener('change', onControlChange);
  sortSecondary.addEventListener('change', onControlChange);
  filterFamily.addEventListener('change', onControlChange);
  filterType.addEventListener('change', onControlChange);
  const debounced = debounce(() => { currentPage = 1; onControlChange(); }, 200);
  searchInput.addEventListener('input', debounced);
  const perPageSelect = document.getElementById('perPageSelect');
  if (perPageSelect) {
    perPageSelect.value = String(perPage);
    perPageSelect.addEventListener('change', () => {
      perPage = parseInt(perPageSelect.value, 10) || 25;
      currentPage = 1;
      saveState();
      renderBirds();
    });
  }
  resetButton.addEventListener('click', resetFoundState);
}

function assembleBirdList() {
  birds = baseBirds;
}

function onControlChange() {
  saveState();
  renderBirds();
}

function resetFoundState() {
  foundState = {};
  saveState();
  renderBirds();
}

function getFilteredAndSortedBirds() {
  const searchText = searchInput.value.trim();
  const familyFilter = filterFamily.value;
  const typeFilter = filterType.value;
  const primaryField = sortPrimary.value || 'polishName';
  const secondaryField = sortSecondary.value || 'none';

  let list = birds.slice();

  // Apply family filter
  list = list.filter(bird => (familyFilter === 'all' || bird.family === familyFilter));

  // Apply type filter
  list = list.filter(bird => {
    if (typeFilter === 'all') return true;
    return [bird.type1, bird.type2, bird.type3].includes(typeFilter);
  });

  // Apply search (fuzzy if Fuse available)
  if (searchText) {
    if (useFuse && fuse) {
      const results = fuse.search(searchText);
      const ids = new Set(results.map(r => r.item.id));
      list = list.filter(b => ids.has(b.id));
    } else {
      const s = searchText.toLowerCase();
      list = list.filter(b => b.polishName.toLowerCase().includes(s) || b.latinName.toLowerCase().includes(s));
    }
  }

  // Stable sort copy
  list = list.map(b => ({ ...b }));
  list.sort((a, b) => {
    const comparePrimary = compareBirds(a, b, primaryField);
    if (comparePrimary !== 0 || secondaryField === 'none') {
      return comparePrimary;
    }
    const compareSecondary = compareBirds(a, b, secondaryField);
    if (compareSecondary !== 0) return compareSecondary;
    return compareBirds(a, b, 'polishName');
  });

  return list;
}

function getPagedBirds(page = 1, per = perPage) {
  const all = getFilteredAndSortedBirds();
  const total = all.length;
  const start = (page - 1) * per;
  const end = Math.min(start + per, total);
  const pageItems = all.slice(start, end);
  return { pageItems, total, start, end };
}

function compareBirds(a, b, field) {
  if (!field || field === 'none') {
    return 0;
  }

  if (field === 'rarity') {
    const aValue = rarityOrder[a.rarity] ?? 0;
    const bValue = rarityOrder[b.rarity] ?? 0;
    return aValue - bValue;
  }

  return String(a[field]).localeCompare(String(b[field]), 'pl', { sensitivity: 'base' });
}

function renderBirds() {
  birdList.innerHTML = '';
  const { pageItems, total } = getPagedBirds(currentPage, perPage);
  updateBirdCounter(total);

  if (!total) {
    const empty = document.createElement('p');
    empty.textContent = 'Brak ptaków dla wybranych filtrów.';
    birdList.append(empty);
    renderPagination(total);
    return;
  }

  pageItems.forEach(bird => {
    const isFound = Boolean(foundState[bird.id]);
    const currentImage = customImages[bird.id] || bird.image || '';
    const imageBlock = currentImage
      ? `<img loading="lazy" src="${currentImage}" alt="Zdjęcie ${bird.polishName}" />`
      : `<div class="image-placeholder" aria-label="Brak zdjęcia"><span>?</span></div>`;

    const typeBadges = [bird.type1, bird.type2, bird.type3]
      .filter(Boolean)
      .map(type => `<span class="type-tag ${getTypeClass(type)}">${type}</span>`)
      .join('');

    const card = document.createElement('article');
    card.className = `bird-card${isFound ? ' found' : ''}`;
    card.innerHTML = `
      <div class="image-frame">
        ${imageBlock}
      </div>
      <div class="card-body">
        <div>
          <h2>${bird.polishName}</h2>
          <h3>${bird.latinName}</h3>
          ${typeBadges ? `<div class="type-row">${typeBadges}</div>` : ''}
        </div>
        <div class="tag-row">
          <span class="tag">Rodzina: ${bird.family}</span>
          <span class="tag rarity">Rzadkość: ${bird.rarity}</span>
        </div>
        <div class="card-actions">
          <label class="file-upload">
            Dodaj własne zdjęcie:
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/*" data-bird-id="${bird.id}" />
          </label>
          <button class="found-button" type="button" data-bird-id="${bird.id}" ${isFound ? 'disabled' : ''}>
            ${isFound ? 'ZNALAZIONE' : 'ZNALAZŁEM'}
          </button>
        </div>
      </div>
    `;

    const fileInput = card.querySelector('input[type="file"]');
    const foundButton = card.querySelector('button.found-button');

    if (fileInput) fileInput.addEventListener('change', event => handleImageUpload(event, bird.id));
    if (foundButton) foundButton.addEventListener('click', () => handleFoundButton(bird.id));

    birdList.append(card);
  });

  renderPagination(total);
}

function handleImageUpload(event, birdId) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const file = input.files?.[0];
  if (!file || !file.type.startsWith('image/')) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    customImages[birdId] = reader.result;
    renderBirds();
    try {
      await saveState();
    } catch (error) {
      console.warn('Nie udało się zapisać obrazu po przesłaniu:', error);
    }
    input.value = '';
  };
  reader.onerror = () => {
    console.error('Błąd przy wczytywaniu obrazu:', reader.error);
  };
  reader.readAsDataURL(file);
}

function handleFoundButton(birdId) {
  if (foundState[birdId]) {
    return;
  }
  foundState[birdId] = true;
  saveState();
  renderBirds();
}

function updateBirdCounter(filteredTotal) {
  const totalBirds = birds.length;
  const foundBirds = Object.keys(foundState).filter(id => birds.some(bird => bird.id === id)).length;
  const percentage = totalBirds ? Math.round((foundBirds / totalBirds) * 100) : 0;
  if (birdCounter) {
    const text = `${foundBirds} / ${totalBirds} znalezionych (${percentage}%)`;
    birdCounter.textContent = text;
  }
}

function renderPagination(totalItems) {
  const container = document.getElementById('pagination');
  if (!container) return;
  container.innerHTML = '';
  const pages = Math.max(1, Math.ceil(totalItems / perPage));
  if (currentPage > pages) currentPage = pages;

  const prev = document.createElement('button');
  prev.textContent = '« Prev';
  prev.disabled = currentPage <= 1;
  prev.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); saveState(); renderBirds(); });
  container.append(prev);

  // show a few pages around current
  const range = 3;
  const startPage = Math.max(1, currentPage - range);
  const endPage = Math.min(pages, currentPage + range);
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.textContent = String(i);
    if (i === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => { currentPage = i; saveState(); renderBirds(); });
    container.append(btn);
  }

  const next = document.createElement('button');
  next.textContent = 'Next »';
  next.disabled = currentPage >= pages;
  next.addEventListener('click', () => { currentPage = Math.min(pages, currentPage + 1); saveState(); renderBirds(); });
  container.append(next);
}

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

loadBirdData();
