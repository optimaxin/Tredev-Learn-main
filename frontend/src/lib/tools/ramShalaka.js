/*
 * Śrī Rāma Śalākā Prashnāvalī — traditional 15×15 letter-grid divination.
 *
 * IMPORTANT — content note: the 9 devotional lines below are composed for
 * this interactive demonstration (genuine Rāma-bhakti vocabulary and, where
 * noted, well-known verses), not a letter-perfect transcription of one
 * specific printed Ramcharitmanas Śalāka table. The MECHANISM is authentic
 * and correctly implemented: 9 lines of 25 letters are woven into a 225-cell
 * grid such that starting at any cell and stepping every 9th cell (wrapping
 * around) always traces exactly one full line. Treat this as a study object;
 * consult a Ramcharitmanas pandit for ritual use.
 */

export const GRID_SIZE = 15; // 15 x 15 = 225 cells
export const LINES_PER_GRID = 9;
export const CELLS_PER_LINE = 25;

export const CHAUPAI_LINES = [
  {
    cells: ["जय", "श्री", "राम", "जय", "जय", "राम", "जय", "सिया", "राम", "जय", "जय", "सिया", "राम", "जय", "हनुमान", "जय", "जय", "हनुमान", "जय", "राम", "जय", "श्री", "राम", "सिया", "राम"],
    text: "जय श्री राम, जय जय राम, जय सिया राम — जय जय हनुमान।",
    meaning: "An invocation of Rāma and Hanumān together — the question is met with grace and devoted support.",
    auspiciousness: "Ati Shubh (अति शुभ)",
  },
  {
    cells: ["मंगल", "भवन", "अमंगल", "हारी", "द्रवहु", "सो", "दशरथ", "अजिर", "बिहारी", "राम", "कृपालु", "दीनबंधु", "सुखधाम", "जय", "रघुनाथ", "करुणा", "सिंधु", "भक्त", "हित", "कारी", "जय", "सीताराम", "जय", "जय", "राम"],
    text: "मंगल भवन अमंगल हारी, द्रवहु सो दशरथ अजिर बिहारी।",
    meaning: "Rāma, the abode of auspiciousness and remover of misfortune, is invoked directly — a swift and gracious response.",
    auspiciousness: "Shubh (शुभ)",
  },
  {
    cells: ["राम", "लखन", "जानकी", "जय", "बोलो", "हनुमान", "की", "जय", "बोलो", "हनुमान", "की", "जय", "जय", "जय", "हनुमान", "की", "सीता", "राम", "लखन", "सहित", "हनुमान", "जय", "जय", "जय", "राम"],
    text: "राम लखन जानकी, जय बोलो हनुमान की — सीता राम लखन सहित हनुमान की जय।",
    meaning: "The whole household of Ayodhya is named together — the matter is settled and accomplished (siddha).",
    auspiciousness: "Siddha (सिद्ध)",
  },
  {
    cells: ["धैर्य", "धरो", "मन", "राम", "भरोसे", "सत्य", "धर्म", "की", "राह", "चलो", "विघ्न", "सभी", "मिट", "जाएंगे", "शुभ", "काल", "शीघ्र", "ही", "आएगा", "राम", "कृपा", "सदा", "संग", "रहे", "सदा"],
    text: "धैर्य धरो मन, राम भरोसे सत्य धर्म की राह चलो — विघ्न सभी मिट जाएंगे।",
    meaning: "A mixed result — hold patience and stay on the true path; obstacles clear with steady effort, not instantly.",
    auspiciousness: "Madhyam (मध्यम)",
  },
  {
    cells: ["विलंब", "होगा", "किंतु", "कार्य", "सिद्ध", "अवश्य", "होगा", "धैर्य", "रखो", "मन", "राम", "नाम", "जपो", "सदा", "संकट", "टलेगा", "शुभ", "घड़ी", "शीघ्र", "आएगी", "जय", "राम", "जय", "सिया", "राम"],
    text: "विलंब होगा, किंतु कार्य सिद्ध अवश्य होगा — धैर्य रखो, मन राम नाम जपो सदा।",
    meaning: "There will be delay, but the outcome is not denied — continued devotion brings it to pass in due time.",
    auspiciousness: "Vilambit Shubh (विलम्बित शुभ)",
  },
  {
    cells: ["शुभंकर", "राम", "नाम", "जपत", "ही", "मंगल", "होत", "सदा", "सुख", "शांति", "मिलत", "है", "सरल", "हृदय", "से", "राम", "भजो", "निष्काम", "भाव", "से", "जय", "राम", "जय", "जय", "राम"],
    text: "शुभंकर राम नाम जपत ही मंगल होत सदा — सरल हृदय से राम भजो, निष्काम भाव से।",
    meaning: "Quiet auspiciousness — the good comes through simple, sincere devotion, not through demanding conditions.",
    auspiciousness: "Shubhankar (शुभंकर)",
  },
  {
    cells: ["संकट", "कटे", "मिटे", "सब", "पीरा", "जो", "सुमिरे", "हनुमत", "बलबीरा", "राम", "दूत", "अतुलित", "बल", "धामा", "अंजनि", "पुत्र", "पवनसुत", "नामा", "जय", "हनुमान", "जय", "जय", "राम", "सिया", "राम"],
    text: "संकट कटे मिटे सब पीरा, जो सुमिरे हनुमत बलबीरा — राम दूत अतुलित बल धामा।",
    meaning: "Invoking Hanumān's strength — obstacles and suffering are removed for the sincere seeker.",
    auspiciousness: "Sankata-nashak (संकटनाशक)",
  },
  {
    cells: ["चिंता", "मत", "करो", "राम", "भरोसे", "सब", "शुभ", "होगा", "मन", "शांत", "रखो", "राम", "नाम", "ही", "सच्चा", "सहारा", "भक्ति", "भाव", "से", "पार", "उतारा", "जय", "राम", "जय", "राम"],
    text: "चिंता मत करो, राम भरोसे सब शुभ होगा — मन शांत रखो, राम नाम ही सच्चा सहारा।",
    meaning: "A reassuring result — set the worry down; steady faith and a calm mind carry the matter through.",
    auspiciousness: "Chintamukt (चिंतामुक्त)",
  },
  {
    cells: ["साध्य", "है", "यह", "कार्य", "निरंतर", "प्रयास", "से", "सफलता", "मिलेगी", "अवश्य", "राम", "नाम", "का", "जाप", "करो", "निष्ठा", "सहित", "पूर्ण", "विश्वास", "रखो", "जय", "सिया", "राम", "जय", "राम"],
    text: "साध्य है यह कार्य, निरंतर प्रयास से सफलता मिलेगी अवश्य — निष्ठा सहित पूर्ण विश्वास रखो।",
    meaning: "The goal is attainable, but through sustained effort — full faith and consistency are what complete it.",
    auspiciousness: "Sadhya (साध्य)",
  },
];

if (process.env.NODE_ENV !== "production") {
  console.assert(CHAUPAI_LINES.length === LINES_PER_GRID, "expected 9 lines");
  CHAUPAI_LINES.forEach((l, i) => console.assert(l.cells.length === CELLS_PER_LINE, `line ${i} must have 25 cells`));
}

export function buildFlatGrid() {
  const flat = new Array(GRID_SIZE * GRID_SIZE);
  CHAUPAI_LINES.forEach((line, j) => {
    line.cells.forEach((cell, i) => {
      flat[LINES_PER_GRID * i + j] = cell;
    });
  });
  return flat;
}

export function traverseFromCell(cellIndex) {
  const total = GRID_SIZE * GRID_SIZE;
  const flat = buildFlatGrid();
  const lineIndex = cellIndex % LINES_PER_GRID;
  const path = [];
  for (let t = 0; t < CELLS_PER_LINE; t++) {
    path.push((cellIndex + LINES_PER_GRID * t) % total);
  }
  const line = CHAUPAI_LINES[lineIndex];
  return {
    cellIndex,
    lineIndex,
    path,
    traversedCells: path.map((idx) => flat[idx]),
    ...line,
  };
}

if (process.env.NODE_ENV !== "production") {
  const flat = buildFlatGrid();
  console.assert(flat.length === 225 && flat.every(Boolean), "flat grid must be fully populated with 225 cells");
  const r = traverseFromCell(37);
  console.assert(r.path.length === 25 && new Set(r.path).size === 25, "traversal visits 25 unique cells");
}
