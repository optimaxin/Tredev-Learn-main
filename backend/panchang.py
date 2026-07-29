"""
Vedic panchang engine (Swiss Ephemeris, Lahiri ayanamsa).

Computes tithi-based Hindu festival dates for any year — no external API needed.
Festivals are defined by their lunar month (amanta system, Chaitra=0), paksha and
tithi; the date is the civil day (IST) on which that tithi prevails at sunrise at
Ujjain (the traditional prime meridian for Indian panchang).
"""
import swisseph as swe
from datetime import datetime, timedelta, timezone, date

swe.set_sid_mode(swe.SIDM_LAHIRI)

UJJAIN_LAT, UJJAIN_LON = 23.1765, 75.7885
IST = timezone(timedelta(hours=5, minutes=30))

# Amanta month index → name (Chaitra = 0)
MONTHS = ["Chaitra", "Vaisakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
          "Ashwina", "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna"]


def _jd(dt_utc):
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day,
                      dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600)


def _dt_from_jd(jd):
    y, m, d, h = swe.revjul(jd)
    return datetime(y, m, d, tzinfo=timezone.utc) + timedelta(hours=h)


def _sun_moon(jd):
    sun = swe.calc_ut(jd, swe.SUN)[0][0]
    moon = swe.calc_ut(jd, swe.MOON)[0][0]
    return sun, moon


def _elong(jd):
    sun, moon = _sun_moon(jd)
    return (moon - sun) % 360.0


def tithi_at(jd):
    """1..30 (1..15 shukla, 16..30 krishna; 30 = amavasya)."""
    return int(_elong(jd) // 12) + 1


def _sun_rashi(jd):
    lon = swe.calc_ut(jd, swe.SUN, swe.FLG_SIDEREAL)[0][0] % 360.0
    return int(lon // 30)  # 0 = Mesha .. 11 = Meena


def _new_moon_after(jd):
    """First new moon (elongation = 0) strictly after jd."""
    def g(x):
        return ((_elong(x) + 180) % 360) - 180  # continuous, zero at new moon
    step = 0.5
    x0 = jd + 0.05
    v0 = g(x0)
    x1 = x0
    for _ in range(120):
        x1 = x0 + step
        v1 = g(x1)
        if v0 <= 0 < v1 or (v0 < 0 and v1 >= 0):
            break
        x0, v0 = x1, v1
    # bisect
    a, b = x0, x1
    for _ in range(60):
        m = (a + b) / 2
        if g(m) < 0:
            a = m
        else:
            b = m
    return (a + b) / 2


def _sunrise(d):
    """Sunrise JD (UT) at Ujjain for civil date d (a datetime.date)."""
    jd0 = swe.julday(d.year, d.month, d.day, 0.0)
    try:
        res = swe.rise_trans(jd0 - 0.5, swe.SUN,
                             swe.CALC_RISE | swe.BIT_DISC_CENTER,
                             (UJJAIN_LON, UJJAIN_LAT, 0))
        return res[1][0]
    except Exception:
        # ~06:00 IST fallback
        return swe.julday(d.year, d.month, d.day, 0.5)


def _amanta_month_index(nm_jd):
    """Amanta month that BEGINS at new moon nm_jd (Chaitra=0)."""
    return (_sun_rashi(nm_jd) + 1) % 12


def _cross_elong(lo, hi, deg):
    """JD in [lo, hi] where elongation == deg (elongation is monotonic 0→360 within a lunar month)."""
    a, b = lo, hi
    for _ in range(60):
        m = (a + b) / 2
        if _elong(m) < deg:
            a = m
        else:
            b = m
    return (a + b) / 2


_MUHURTA_HOUR = {"madhyahna": 12.0, "pradosh": 18.5, "nishita": 24.0}


def _ref_jd(d, muhurta):
    """Reference instant (JD-UT) for evaluating the prevailing tithi on civil day d."""
    if muhurta == "sunrise":
        return _sunrise(d)
    ist_dt = datetime(d.year, d.month, d.day, tzinfo=IST) + timedelta(hours=_MUHURTA_HOUR[muhurta])
    return _jd(ist_dt.astimezone(timezone.utc))


def _find_festival(year, month_idx, paksha, tithi_num, muhurta="sunrise"):
    """Civil IST date for (amanta month, paksha, tithi) in the given year, by the
    prevailing-tithi rule at the festival's muhurta (sunrise / midday / evening / midnight)."""
    target = tithi_num if paksha == "shukla" else 15 + tithi_num
    scan = _jd(datetime(year - 1, 11, 1, tzinfo=timezone.utc))
    nm = _new_moon_after(scan)
    for _ in range(16):
        nm_next = _new_moon_after(nm)
        if _amanta_month_index(nm) == month_idx:
            # Locate the tithi-begin instant within THIS lunar month (nm → nm_next).
            if target == 1:
                t_start = nm
            else:
                t_start = _cross_elong(nm + 0.02, nm_next - 0.02, (target - 1) * 12)
            d0 = _dt_from_jd(t_start).astimezone(IST).date()
            # Festival day = the civil day whose muhurta instant carries the target tithi.
            result = d0
            for dd in (d0 - timedelta(days=1), d0, d0 + timedelta(days=1)):
                if tithi_at(_ref_jd(dd, muhurta)) == target:
                    result = dd
                    break
            if result.year == year:
                return result
        nm = nm_next
    return None


def _solar_ingress(year, target_deg):
    """Civil IST date the sidereal sun reaches target_deg (e.g. Makara = 270)."""
    def f(jd):
        lon = swe.calc_ut(jd, swe.SUN, swe.FLG_SIDEREAL)[0][0] % 360.0
        return ((lon - target_deg + 180) % 360) - 180
    a = _jd(datetime(year, 1, 1, tzinfo=timezone.utc))
    va = f(a)
    b = a
    for _ in range(400):
        b = a + 1
        vb = f(b)
        if va <= 0 < vb:
            break
        a, va = b, vb
    lo, hi = a, b
    for _ in range(60):
        m = (lo + hi) / 2
        if f(m) < 0:
            lo = m
        else:
            hi = m
    return _dt_from_jd(hi).astimezone(IST).date()


# name, (month_idx, paksha, tithi) OR ("solar", degrees), significance, deity, related
FESTIVALS = [
    ("Makar Sankranti", ("solar", 270), "Sun enters Makara — the turn towards light", "Surya", "Mantras"),
    ("Vasant Panchami", (10, "shukla", 5), "Saraswati puja — the launch of study", "Saraswati", "Sanskrit"),
    ("Maha Shivaratri", (10, "krishna", 14, "nishita"), "The great night of Shiva — ideal for Rudram sadhana", "Shiva", "Mantras"),
    ("Holi", (11, "shukla", 15), "Phalguna Purnima — the festival of colour", "Krishna", "Mantras"),
    ("Rama Navami", (0, "shukla", 9), "Birth of Sri Rama", "Rama", "Ramayana"),
    ("Guru Purnima", (3, "shukla", 15), "Full moon of the teacher", "Guru", "Vedas"),
    ("Krishna Janmashtami", (4, "krishna", 8), "Birth of Sri Krishna", "Krishna", "Bhagavad Gita"),
    ("Ganesh Chaturthi", (5, "shukla", 4, "madhyahna"), "Advent of Ganesha", "Ganesha", "Mantras"),
    ("Navratri", (6, "shukla", 1), "Nine nights of the Devi", "Durga", "Mantras"),
    ("Diwali", (6, "krishna", 15, "pradosh"), "Lakshmi puja — the festival of lights", "Lakshmi", "Mantras"),
    ("Gita Jayanti", (8, "shukla", 11), "Advent of the Bhagavad Gita (Mokshada Ekadashi)", "Krishna", "Bhagavad Gita"),
]


def festival_date(rule, year):
    if rule[0] == "solar":
        return _solar_ingress(year, rule[1])
    muhurta = rule[3] if len(rule) > 3 else "sunrise"
    return _find_festival(year, rule[0], rule[1], rule[2], muhurta)


def upcoming_festivals(from_date=None, count=12):
    """Next `count` festival occurrences on/after from_date, soonest first."""
    if from_date is None:
        from_date = datetime.now(IST).date()
    out = []
    for name, rule, sig, deity, related in FESTIVALS:
        for y in (from_date.year, from_date.year + 1, from_date.year + 2):
            try:
                d = festival_date(rule, y)
            except Exception:
                d = None
            if d and d >= from_date:
                out.append({"name": name, "date": d.isoformat(), "significance": sig,
                            "deity": deity, "related_offering_subject": related})
                break
    out.sort(key=lambda x: x["date"])
    return out[:count]
