export const CITY_PRESETS = [
  { name: "New Delhi", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Varanasi", lat: 25.3176, lon: 82.9739 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Ujjain", lat: 23.1793, lon: 75.7849 },
  { name: "Ayodhya", lat: 26.7922, lon: 82.1998 },
];

export const PANCHANG_LABELS_HI = {
  vara: "वार", tithi: "तिथि", nakshatra: "नक्षत्र", yoga: "योग", karana: "करण",
  sunrise: "सूर्योदय", sunset: "सूर्यास्त", moonrise: "चंद्रोदय", moonset: "चंद्रास्त",
  rahuKalam: "राहु काल", abhijitMuhurta: "अभिजित मुहूर्त",
};

const VARA_HI = {
  Ravivar: "रविवार", Somavar: "सोमवार", Mangalvar: "मंगलवार", Budhavar: "बुधवार",
  Guruvar: "गुरुवार", Shukravar: "शुक्रवार", Shanivar: "शनिवार",
};

const PAKSHA_HI = { Shukla: "शुक्ल पक्ष", Krishna: "कृष्ण पक्ष" };

const TITHI_HI = {
  Pratipada: "प्रतिपदा", Dwitiya: "द्वितीया", Tritiya: "तृतीया", Chaturthi: "चतुर्थी",
  Panchami: "पंचमी", Shashthi: "षष्ठी", Saptami: "सप्तमी", Ashtami: "अष्टमी",
  Navami: "नवमी", Dashami: "दशमी", Ekadashi: "एकादशी", Dwadashi: "द्वादशी",
  Trayodashi: "त्रयोदशी", Chaturdashi: "चतुर्दशी", Purnima: "पूर्णिमा", Amavasya: "अमावस्या",
};

const NAKSHATRA_HI = {
  Ashwini: "अश्विनी", Bharani: "भरणी", Krittika: "कृत्तिका", Rohini: "रोहिणी",
  Mrigashira: "मृगशिरा", Ardra: "आर्द्रा", Punarvasu: "पुनर्वसु", Pushya: "पुष्य",
  Ashlesha: "आश्लेषा", Magha: "मघा", "Purva Phalguni": "पूर्वा फाल्गुनी",
  "Uttara Phalguni": "उत्तरा फाल्गुनी", Hasta: "हस्त", Chitra: "चित्रा", Swati: "स्वाती",
  Vishakha: "विशाखा", Anuradha: "अनुराधा", Jyeshtha: "ज्येष्ठा", Mula: "मूल",
  "Purva Ashadha": "पूर्वाषाढ़ा", "Uttara Ashadha": "उत्तराषाढ़ा", Shravana: "श्रवण",
  Dhanishta: "धनिष्ठा", Shatabhisha: "शतभिषा", "Purva Bhadrapada": "पूर्वाभाद्रपद",
  "Uttara Bhadrapada": "उत्तराभाद्रपद", Revati: "रेवती",
};

const YOGA_HI = {
  Vishkambha: "विष्कम्भ", Priti: "प्रीति", Ayushman: "आयुष्मान", Saubhagya: "सौभाग्य",
  Shobhana: "शोभन", Atiganda: "अतिगंड", Sukarma: "सुकर्मा", Dhriti: "धृति",
  Shula: "शूल", Ganda: "गंड", Vriddhi: "वृद्धि", Dhruva: "ध्रुव", Vyaghata: "व्याघात",
  Harshana: "हर्षण", Vajra: "वज्र", Siddhi: "सिद्धि", Vyatipata: "व्यतीपात",
  Variyana: "वरीयान", Parigha: "परिघ", Shiva: "शिव", Siddha: "सिद्ध", Sadhya: "साध्य",
  Shubha: "शुभ", Shukla: "शुक्ल", Brahma: "ब्रह्म", Indra: "इंद्र", Vaidhriti: "वैधृति",
};

const KARANA_HI = {
  Bava: "बव", Balava: "बालव", Kaulava: "कौलव", Taitila: "तैतिल", Gara: "गर",
  Vanija: "वणिज", Vishti: "विष्टि", Shakuni: "शकुनि", Chatushpada: "चतुष्पद",
  Naga: "नाग", Kimstughna: "किंस्तुघ्न",
};

const PANCHANG_NOTE_HI =
  "स्विस एफेमेरिस और लाहिड़ी अयनांश के आधार पर सूर्योदय के समय गणना की गई है — " +
  "यह मानक पंचांग स्रोतों की पद्धति से मेल खाती है।";

/** Translates a daily_panchang() API result into Hindi/Devanagari. Values not
 * found in the lookup tables (unexpected API data) pass through unchanged. */
export function translatePanchangToHindi(result) {
  return {
    ...result,
    vara: VARA_HI[result.vara] || result.vara,
    paksha: PAKSHA_HI[result.paksha] || result.paksha,
    tithi: TITHI_HI[result.tithi] || result.tithi,
    nakshatra: NAKSHATRA_HI[result.nakshatra] || result.nakshatra,
    yoga: YOGA_HI[result.yoga] || result.yoga,
    karana: KARANA_HI[result.karana] || result.karana,
    note: PANCHANG_NOTE_HI,
  };
}
