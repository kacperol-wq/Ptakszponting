const statsList = document.getElementById('statsList');
const overallCounter = document.getElementById('overallCounter');
const profileSelect = document.getElementById('profileSelect');
const STORAGE_CURRENT_PROFILE = 'pokedexCurrentProfile';
const STORAGE_FOUND = 'pokedexFoundState';

let currentProfile = 'profile1';

function getProfileKey(baseKey) {
  return `${baseKey}_${currentProfile}`;
}

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

const rarityInfo = {
  'R1': 'R1 – gatunki masowo pospolite (krzyżówka, wróbel, bogatka...)',
  'R2': 'R2 – gatunki pospolite lęgowe (bocian biały, żuraw, śmieszka...)',
  'R3': 'R3 – gatunki lęgowe nieliczne lub regularnie przelotne/zimujące (L z niską liczebnością, regularny P)',
  'R4': 'R4 – gatunki rzadko lęgowe lub nieregularnie przelotne (l P, (l) P)',
  'R5': 'R5 – gatunki zalatujące regularnie (Z duże, ok. kilkudziesięciu stwierdzeń rocznie)',
  'R6': 'R6 – gatunki zalatujące rzadko (Z, kilka–kilkanaście stwierdzeń)',
  'R7': 'R7 – gatunki bardzo rzadko zalatujące (z małe, pojedyncze stwierdzenia)',
  'R8': 'R8 – gatunki skrajnie rzadkie, jednorazowe stwierdzenia lub historyczne (z + B/kategoria wątpliwa)'
};

function getTypeClass(type) {
  if (!type) return 'type-default';
  const normalized = type.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const stripped = normalized.replace(/ł/g, 'l').replace(/[^a-z0-9]/g, '');
  return typeClassMap[stripped] || Object.entries(typeClassMap).find(([key]) => stripped.includes(key))?.[1] || 'type-default';
}

async function loadBirdData() {
  try {
    const response = await fetch('birds.json');
    if (!response.ok) {
      throw new Error('Nie udało się pobrać danych ptaków');
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    if (overallCounter) overallCounter.textContent = 'Nie udało się załadować danych.';
    return [];
  }
}

async function loadFoundState() {
  try {
    const storedFound = await loadObjectFromDB('siteData', getProfileKey(STORAGE_FOUND));
    if (storedFound) {
      return storedFound;
    }

    const localStoredFound = localStorage.getItem(getProfileKey(STORAGE_FOUND));
    if (localStoredFound) {
      try {
        return JSON.parse(localStoredFound) || {};
      } catch (e) {
        console.warn('Nie udało się sparsować lokalnego stanu znalezionych ptaków dla profilu:', e);
      }
    }

    const legacyStoredFound = localStorage.getItem(STORAGE_FOUND);
    if (legacyStoredFound) {
      try {
        return JSON.parse(legacyStoredFound) || {};
      } catch (e) {
        console.warn('Nie udało się sparsować legacy stanu znalezionych ptaków:', e);
      }
    }

    return {};
  } catch (e) {
    console.warn('Nie udało się załadować stanu znalezionych ptaków:', e);
    return {};
  }
}

function buildTypeStatistics(birds, foundState) {
  const stats = {};

  birds.forEach(bird => {
    const types = [bird.type1, bird.type2, bird.type3].filter(Boolean);
    const uniqueTypes = Array.from(new Set(types.map(type => type.trim())));
    const isFound = Boolean(foundState[bird.id]);

    uniqueTypes.forEach(type => {
      if (!stats[type]) {
        stats[type] = { total: 0, found: 0 };
      }
      stats[type].total += 1;
      if (isFound) {
        stats[type].found += 1;
      }
    });
  });

  return stats;
}

function renderStatistics(stats) {
  if (!statsList) return;
  const entries = Object.entries(stats).sort(([a], [b]) => a.localeCompare(b, 'pl'));

  if (!entries.length) {
    statsList.innerHTML = '<p>Brak danych o typach ptaków.</p>';
    return;
  }

  statsList.innerHTML = '';
  entries.forEach(([type, values]) => {
    const percentage = values.total ? Math.round((values.found / values.total) * 100) : 0;
    const fillClass = getTypeClass(type);
    const card = document.createElement('article');
    card.className = 'stat-card';
    card.innerHTML = `
      <h2>${type}</h2>
      <p class="stat-value">${values.found} / ${values.total} znalezionych</p>
      <p class="stat-percentage">${percentage}%</p>
      <div class="stat-bar">
        <div class="stat-bar-fill ${fillClass}" style="width: ${percentage}%"></div>
      </div>
    `;
    statsList.append(card);
  });
}

function buildRarityStatistics(birds, foundState) {
  const stats = {};
  birds.forEach(bird => {
    const r = bird.rarity || 'R?';
    if (!stats[r]) stats[r] = { total: 0, found: 0 };
    stats[r].total += 1;
    if (foundState[bird.id]) stats[r].found += 1;
  });
  return stats;
}

function renderRarityStatistics(rarityStats) {
  const container = document.getElementById('rarityStats');
  if (!container) return;
  const order = Object.keys(rarityStats).sort((a,b)=>{
    // sort R1..R8 in numeric order when possible
    const na = parseInt(a.replace(/[^0-9]/g,''))||0;
    const nb = parseInt(b.replace(/[^0-9]/g,''))||0;
    return na - nb || a.localeCompare(b);
  });
  container.innerHTML = '';
  order.forEach(r => {
    const v = rarityStats[r];
    const pct = v.total ? Math.round((v.found / v.total) * 100) : 0;
    const card = document.createElement('article');
    card.className = 'stat-card rarity-card';
    const infoText = rarityInfo[r] || '';
    card.innerHTML = `
      <div class="stat-card-header">
        <h2>${r}</h2>
        <button class="rarity-info-button" type="button" data-rarity="${r}">Info</button>
      </div>
      <p class="stat-value">${v.found} / ${v.total} znalezionych</p>
      <p class="stat-percentage">${pct}%</p>
      <div class="stat-bar">
        <div class="stat-bar-fill rarity-${r.toLowerCase()}" style="width: ${pct}%"></div>
      </div>
      <div class="rarity-info" data-rarity="${r}" hidden>${infoText}</div>
    `;
    container.append(card);
    const btn = card.querySelector('.rarity-info-button');
    const infoDiv = card.querySelector('.rarity-info');
    if (btn && infoDiv) {
      btn.addEventListener('click', () => {
        const isHidden = infoDiv.hasAttribute('hidden');
        if (isHidden) {
          infoDiv.removeAttribute('hidden');
          btn.textContent = 'Zamknij';
        } else {
          infoDiv.setAttribute('hidden', '');
          btn.textContent = 'Info';
        }
      });
    }
  });
}

function updateOverallCounter(birds, foundState) {
  if (!overallCounter) return;
  const total = birds.length;
  const found = birds.filter(bird => Boolean(foundState[bird.id])).length;
  overallCounter.textContent = `Znaleziono ${found} z ${total} ptaków w bazie`; 
}

async function reloadStatsPage() {
  const birds = await loadBirdData();
  const foundState = await loadFoundState();
  const stats = buildTypeStatistics(birds, foundState);
  updateOverallCounter(birds, foundState);
  renderStatistics(stats);
  const rarityStats = buildRarityStatistics(birds, foundState);
  renderRarityStatistics(rarityStats);
}

async function initializeStatsPage() {
  // Load current profile
  currentProfile = localStorage.getItem(STORAGE_CURRENT_PROFILE) || 'profile1';
  
  // Set profile selector value
  if (profileSelect) {
    profileSelect.value = currentProfile;
    profileSelect.addEventListener('change', async (e) => {
      currentProfile = e.target.value;
      localStorage.setItem(STORAGE_CURRENT_PROFILE, currentProfile);
      await reloadStatsPage();
    });
  }

  await reloadStatsPage();
}

initializeStatsPage();
