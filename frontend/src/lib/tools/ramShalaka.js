/*
 * Śrī Rāma Śalākā Prashnāvalī — traditional 15×15 letter-grid divination.
 *
 * Content provenance (re-researched — an earlier pass's 9 chaupai/answer
 * lines were invented, not sourced, and has been replaced):
 *
 * - GRID: the 225-cell `REAL_GRID_ROWS` matches the published reference tool
 *   (occultgurukul.com/ramshalaka-calculator), verified previously in-browser.
 * - MECHANISM: confirmed authentic against multiple independent sources
 *   (shriramshalaka.com, ramshalaka.com, rppandey.com, astrosage.com,
 *   bhaktitak.com) — a seeker picks one cell, and every 9th cell from it
 *   (wrapping mod 225) traces one of 9 woven chaupai lines. Decoding the
 *   actual grid this way (stepping by 9 from each of the 9 starting offsets)
 *   closely tracks the 9 real verses below, in this order — but it is NOT an
 *   exact letter-for-letter cipher: a handful of grid cells are literal "।"
 *   danda placeholders (present in the published reference grid itself, not
 *   an artifact introduced here) and some cells use simplified spellings
 *   that drop anusvara/visarga marks and consonant conjuncts found in the
 *   full scriptural text below. This is consistent with how these grids are
 *   normally built — decorative/approximate per-cell syllables tied to a
 *   real verse, not a strict cryptogram — so it's presented as-is rather
 *   than "corrected" to force an exact match that the reference tool itself
 *   doesn't have either.
 * - VERSES (Devanagari `text`): the real, public-domain Ramcharitmanas
 *   couplets used by traditional Ram Shalaka tools, cross-checked across
 *   shriramshalaka.com's per-verse pages, rppandey.com's full list, and
 *   primary Ramcharitmanas text sources (ramcharit.in, wikisource). All 9
 *   sources agree on the same 9 verses, same order, and the same 5
 *   shubh / 3 ashubh / 1 "leave to Ram's will" breakdown.
 * - `reference` cites the Kanda only (Balakand / Sundarkand / Lankakand),
 *   which was consistently corroborated; specific Doha/Chaupai numbers
 *   varied across editions in sources checked, so they're deliberately
 *   omitted rather than guessed.
 * - `answer`/`guidance` (English and Hindi) are original interpretive text
 *   written for this app from the verified traditional meaning of each
 *   verse — not copied from any single site's commentary.
 */

export const GRID_SIZE = 15; // 15 x 15 = 225 cells
export const LINES_PER_GRID = 9;
export const CELLS_PER_LINE = 25;

export const CHAUPAI_LINES = [
  {
    // Balakand — Gauri's blessing to Sita in her temple.
    text: "सुनु सिय सत्य असीस हमारी। पूजिहि मन कामना तुम्हारी॥",
    textEn: "Sunu Siya satya asees hamaari, poojihi man kaamana tumhaari.",
    reference: "Balakand",
    answer: "This is a wish-fulfilling sign — approach the matter with a sincere heart, and what you long for is within reach.",
    answerHi: "यह इच्छा-पूर्ति का शुभ संकेत है — सच्चे मन से आगे बढ़ें, आपकी अभिलाषा पूर्ण होने के निकट है।",
    guidance: "A blessing given in faith is received in faith. Hold your intention clearly and let devotion, not doubt, lead your next step.",
    guidanceHi: "श्रद्धा से दिया गया आशीर्वाद श्रद्धा से ही फलता है। अपने संकल्प को स्पष्ट रखें और संदेह नहीं, भक्ति को अपना मार्गदर्शक बनाएं।",
    auspiciousness: "Shubh (शुभ)",
  },
  {
    // Sundarkand — blessing as Hanuman enters Lanka (first half of the couplet).
    text: "प्रबिसि नगर कीजे सब काजा। हृदयँ राखि कोसलपुर राजा॥",
    textEn: "Prabisi nagar keeje sab kaaja, hriday raakhi Kosalpur raaja.",
    reference: "Sundarkand",
    answer: "Begin — the timing is right. Carry your purpose in your heart the way one carries a cherished name, and the work will move forward.",
    answerHi: "आरंभ करें — समय अनुकूल है। अपने उद्देश्य को हृदय में उसी तरह धारण करें जैसे कोई प्रिय नाम धारण किया जाता है, कार्य आगे बढ़ेगा।",
    guidance: "Courage that carries devotion does not need to announce itself — it simply proceeds, and doors open along the way.",
    guidanceHi: "भक्ति सहित साहस को स्वयं को सिद्ध करने की आवश्यकता नहीं होती — वह बस आगे बढ़ता है, और मार्ग स्वयं खुलते जाते हैं।",
    auspiciousness: "Shubh (शुभ)",
  },
  {
    // Balakand — on deceptive appearances (Kalnemi, Ravana, Rahu) being exposed in time.
    text: "उघरहिं अंत न होइ निबाहू। कालनेमि जिमि रावन राहू॥",
    textEn: "Ugharahin ant na hoi nibaahu, Kaalnemi jimi Raavan Raahu.",
    reference: "Balakand",
    answer: "Look twice before trusting this — something here may not be quite what it appears, and time alone will reveal the truth of it.",
    answerHi: "इस पर विश्वास करने से पहले दो बार देखें — यहां कुछ वैसा नहीं हो सकता जैसा दिख रहा है, समय ही इसकी सच्चाई प्रकट करेगा।",
    guidance: "A borrowed appearance cannot hold forever. Do not rush a decision built on surface impressions — let what is real declare itself first.",
    guidanceHi: "उधार लिया हुआ रूप सदा नहीं टिकता। ऊपरी प्रभाव पर आधारित निर्णय में जल्दबाज़ी न करें — पहले वास्तविकता को प्रकट होने दें।",
    auspiciousness: "Ashubh (अशुभ)",
  },
  {
    // Balakand — on keeping good company; a jewel on a serpent's hood still shines.
    text: "बिधि बस सुजन कुसंगत परहीं। फनि मनि सम निज गुन अनुसरहीं॥",
    textEn: "Bidhi bas sujan kusangat parahin, phani mani sam nij gun anusarahin.",
    reference: "Balakand",
    answer: "The company around this matter is not fully trustworthy right now — success is possible, but only after stepping back from poor influences.",
    answerHi: "इस विषय के आस-पास का साथ अभी पूरी तरह भरोसेमंद नहीं है — सफलता संभव है, परंतु गलत संगति से दूर होने के बाद ही।",
    guidance: "Even something precious loses its shine in the wrong setting. Choose your company as carefully as you choose your path.",
    guidanceHi: "अनमोल वस्तु भी गलत परिवेश में अपनी चमक खो देती है। मार्ग जितनी सावधानी से चुनते हैं, संगति भी उतनी ही सावधानी से चुनें।",
    auspiciousness: "Ashubh (अशुभ)",
  },
  {
    // Balakand — Shiv to Parvati, on surrendering to Ram's ordained will.
    text: "होइहि सोइ जो राम रचि राखा। को करि तर्क बढ़ावै साखा॥",
    textEn: "Hoihi soi jo Ram rachi raakha, ko kari tark badhaavai saakha.",
    reference: "Balakand",
    answer: "This outcome is not fully yours to decide — what Shri Ram has already written will come to pass in its own time, arguing will not move it.",
    answerHi: "यह परिणाम पूर्ण रूप से आपके हाथ में नहीं है — जो श्री राम ने पहले ही रच दिया है, वह अपने समय पर घटित होगा, तर्क से नहीं बदलेगा।",
    guidance: "Do your part fully, then release your grip on the result. Surrender here is not defeat — it is trust placed where it belongs.",
    guidanceHi: "अपना कर्तव्य पूर्ण करें, फिर परिणाम की पकड़ छोड़ दें। यहां समर्पण हार नहीं है — यह विश्वास है, जहां उसे होना चाहिए।",
    auspiciousness: "Prabhu-Ichha (प्रभु इच्छा)",
  },
  {
    // Balakand — the company of saints likened to a moving Prayag (tirtha-raj).
    text: "मुद मंगलमय संत समाजू। जो जग जंगम तीरथराजू॥",
    textEn: "Mud mangalmay sant samaaju, jo jag jangam teerath-raaju.",
    reference: "Balakand",
    answer: "The people around you are a genuine strength right now — this matter prospers through good company and shared faith, not through going it alone.",
    answerHi: "अभी आपके आस-पास के लोग वास्तविक शक्ति हैं — यह विषय अच्छी संगति और साझा श्रद्धा से फलेगा, अकेले प्रयास से नहीं।",
    guidance: "Seek out those whose presence steadies you. The right gathering can carry a person further than solitary effort ever could.",
    guidanceHi: "ऐसे लोगों को खोजें जिनकी उपस्थिति आपको स्थिर करे। सही संगति व्यक्ति को अकेले प्रयास से कहीं आगे ले जा सकती है।",
    auspiciousness: "Shubh (शुभ)",
  },
  {
    // Sundarkand — blessing as Hanuman enters Lanka (second half of the couplet).
    text: "गरल सुधा रिपु करहिं मिताई। गोपद सिंधु अनल सितलाई॥",
    textEn: "Garal sudha ripu karahin mitaai, gopad sindhu anal seetalaai.",
    reference: "Sundarkand",
    answer: "What looks like poison here can turn to nectar — with sincere remembrance, even hostile circumstances soften and turn in your favor.",
    answerHi: "यहां जो विष जैसा प्रतीत होता है वह अमृत बन सकता है — सच्ची भक्ति से प्रतिकूल परिस्थितियां भी अनुकूल हो जाती हैं।",
    guidance: "Difficulty is not always what it first appears. Stay devoted through the hard part, and watch it change character.",
    guidanceHi: "कठिनाई सदा वैसी नहीं रहती जैसी पहली नज़र में लगती है। कठिन समय में भी भक्ति बनाए रखें, वह अपना स्वरूप बदल देगी।",
    auspiciousness: "Shubh (शुभ)",
  },
  {
    // Lankakand — Mandodari's lament: might and status without righteousness could not save Ravana.
    text: "बरुन कुबेर सुरेस समीरा। रन सन्मुख धरि काहुँ न धीरा॥",
    textEn: "Barun Kuber Sures sameera, ran sanmukh dhari kaahu na dheera.",
    reference: "Lankakand",
    answer: "Strength and status alone will not carry this through — without humility and righteousness on your side, the outcome stays in doubt.",
    answerHi: "अकेला बल और प्रतिष्ठा इसे पूर्ण नहीं करेगी — विनम्रता और धर्म का साथ न हो तो परिणाम संदेहपूर्ण रहेगा।",
    guidance: "Power without humility eventually stands alone. Let righteousness walk beside your effort, not behind it.",
    guidanceHi: "विनम्रता के बिना शक्ति अंततः अकेली रह जाती है। धर्म को अपने प्रयास के पीछे नहीं, साथ में रखें।",
    auspiciousness: "Ashubh (अशुभ)",
  },
  {
    // Balakand — Vishwamitra's blessing to Ram and Lakshman after they brought flowers for his worship.
    text: "सुफल मनोरथ होहुँ तुम्हारे। रामु लखनु सुनि भए सुखारे॥",
    textEn: "Sufal manorath hohun tumhaare, Ramu Lakhanu suni bhaye sukhaare.",
    reference: "Balakand",
    answer: "A guru's blessing rests on this question — approached with sincerity, your desire is well set to be fulfilled.",
    answerHi: "इस प्रश्न पर गुरु का आशीर्वाद है — सच्चे भाव से आगे बढ़ने पर आपकी इच्छा पूर्ण होने की पूरी संभावना है।",
    guidance: "A blessing received with an open, joyful heart carries its own momentum — receive this one the same way and proceed.",
    guidanceHi: "खुले और प्रसन्न हृदय से प्राप्त आशीर्वाद अपनी गति स्वयं बनाता है — इसे उसी भाव से ग्रहण करें और आगे बढ़ें।",
    auspiciousness: "Shubh (शुभ)",
  },
];

if (process.env.NODE_ENV !== "production") {
  console.assert(CHAUPAI_LINES.length === LINES_PER_GRID, "expected 9 lines");
  CHAUPAI_LINES.forEach((l, i) => {
    ["text", "textEn", "reference", "answer", "answerHi", "guidance", "guidanceHi"].forEach((key) =>
      console.assert(!!l[key], `line ${i} missing "${key}"`)
    );
  });
}

const KANDA_HI = {
  Balakand: "बालकाण्ड",
  Ayodhyakand: "अयोध्याकाण्ड",
  Aranyakand: "अरण्यकाण्ड",
  Kishkindhakand: "किष्किन्धाकाण्ड",
  Sundarkand: "सुन्दरकाण्ड",
  Lankakand: "लंकाकाण्ड",
};
// `reference` is just a Kanda name (e.g. "Balakand") — exact Doha/Chaupai
// numbers vary across published editions, so only the Kanda is cited.
export function toHindiReference(reference) {
  return KANDA_HI[reference] || reference;
}

export const REAL_GRID_ROWS = [
  ["सु", "प्र", "उ", "बि", "हो", "मु", "ग", "ब", "सु", "नु", "वि", "घ", "धि", "इ", "द"],
  ["र", "रु", "फ", "सि", "सि", "रें", "बस", "है", "मं", "ल", "न", "ल", "य", "न", "अं"],
  ["सुज", "सी", "ग", "सु", "कु", "म", "स", "ग", "त", "न", "ई", "ल", "धा", "बे", "नो"],
  ["त्य", "र", "न", "कु", "जो", "म", "रि", "र", "र", "अ", "की", "हो", "सं", "रा", "य"],
  ["पु", "सु", "थ", "सी", "जे", "इ", "ग", "म*", "सं", "क", "रे", "हो", "स", "स", "नि"],
  ["त", "र", "त", "र", "स", "इ", "ह", "ब", "ब", "प", "चि", "स", "य", "स", "तु"],
  ["म", "का", "।", "र", "र", "मा", "मि", "मी", "म्हा", "।", "जा", "हू", "हीं", "।", "जू"],
  ["ता", "रा", "रे", "री", "हृ", "का", "फ", "खा", "जि", "ई", "र", "रा", "पू", "द", "ल"],
  ["नि", "को", "मि", "गो", "न", "म", "ज", "य", "ने", "मनि", "क", "ज", "प", "स", "ल"],
  ["हि", "रा", "म", "स", "रि", "ग", "द", "न", "ष", "म", "खि", "जि", "मनि", "त", "जं"],
  ["सिं", "मु", "न", "न", "कौ", "मि", "ज", "र", "ग", "धु", "ख", "सु", "का", "स", "र"],
  ["गु", "क", "म", "अ", "ध", "नि", "म", "ल", "।", "न", "ब", "ती", "न", "रि", "भ"],
  ["ना", "पु", "व", "अ", "ढा", "र", "ल", "का", "ए", "तु", "र", "न", "नु", "ब", "थ"],
  ["सि", "ह", "सु", "म्हा", "रा", "र", "स", "हिं", "र", "त", "न", "ष", "।", "ज", "।"],
  ["र", "सा", "।", "ला", "धी", "।", "री", "जा", "हू", "हीं", "षा", "जू", "ई", "रा", "रे"],
];

export function buildFlatGrid() {
  return REAL_GRID_ROWS.flat();
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
    selectedLetter: flat[cellIndex],
    ...line,
  };
}

if (process.env.NODE_ENV !== "production") {
  const flat = buildFlatGrid();
  console.assert(flat.length === 225 && flat.every(Boolean), "flat grid must be fully populated with 225 cells");
  const r = traverseFromCell(37);
  console.assert(r.path.length === 25 && new Set(r.path).size === 25, "traversal visits 25 unique cells");
}
