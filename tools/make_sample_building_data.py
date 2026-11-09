"""Generate `sample_building_data.csv`, the synthetic demonstration dataset of ChartMate.

The file is SYNTHETIC. It does not describe a real building. It is built from a small,
documented physical model so that every view of the program shows a plausible pattern and the
expected results are known by construction (for example the bias of the "simulated" series).

Run (standard library only, Python >= 3.9):
    python tools/make_sample_building_data.py                 # writes ./sample_building_data.csv
    python tools/make_sample_building_data.py --out other.csv --seed 7

Model (one naturally ventilated room, no heating or cooling; Milan, 1-14 September 2026)
---------------------------------------------------------------------------------------------
The model runs in 10-min steps; every output column is the mean of the six steps of an hour,
stamped at the start of the hour (336 hourly records).

* Outdoor air temperature: daily mean falling linearly from 23 to 18 degC over the period, plus a
  synoptic oscillation (amplitude 1.5 K, period 5 days), a daily cosine with a 5 K amplitude
  and minimum at 05:00, and AR(1) noise (sigma 0.4 K, lag-1 coefficient 0.95 per step).
* Occupancy: weekdays only. 08:30-12:30 and 13:30-17:30 with N people, 12:30-13:30 with N/2;
  N is drawn once per day from 18-26. Weekends unoccupied. 1 September 2026 is a Tuesday.
* Ventilation: 0.8 air changes per hour (ACH) when unoccupied (infiltration), 3.0-4.0 ACH when
  occupied (drawn per day, windows/mechanical). Room volume 180 m3.
* CO2: single-zone mass balance with outdoor concentration 420 ppm and a generation rate of
  0.0052 L/s per person (sedentary adult), solved exactly over each step.
* Indoor air temperature: one-node RC model. Capacity 1.2e7 J/K; conductance 180 W/K through the
  envelope plus 0.34 W/(K m3/h) times the ventilation flow. Gains: 75 W per person, equipment
  500 W occupied / 100 W unoccupied, solar gain up to 600 W (half-sine 07:00-19:00) scaled by a
  daily clearness index in 0.4-1.0.
* Relative humidity: outdoor humidity ratio around 9 g/kg (daily random walk); indoor humidity
  ratio = outdoor + moisture from occupants (55 g/h per person) diluted by the ventilation flow;
  RH from the Magnus saturation pressure at 101 325 Pa.
* Electrical power: 0.6 kW base + 0.10 kW per person + lighting 1.2 kW x (1 - clearness) while
  occupied; Gaussian metering noise (sigma 0.05 kW).
* "Measured" series = model output + sensor noise (0.10 K, 1.5 % RH, 15 ppm; CO2 not below 400 ppm).
* "Simulated" series, which stand in for an energy model used in calibration:
    - sim_indoor_temp: the same RC model with capacity -25 % and solar gain -20 %, run on the same
      weather and the actual schedule (no sensor noise);
    - sim_power_kw: the same power model with a fixed design occupancy of 22 people on every
      weekday and a constant clearness of 0.7 (no noise). Its error is therefore systematic and
      known: it does not see the day-to-day occupancy and cloud cover.
* Location: fixed coordinates of a building in Milan (45.4785 N, 9.2272 E); zone label "Room_A".
"""
from __future__ import annotations

import argparse
import csv
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

START = datetime(2026, 9, 1)
DAYS = 14
STEPS_PER_HOUR = 6
DT_S = 3600 / STEPS_PER_HOUR
DT_H = 1 / STEPS_PER_HOUR

VOLUME = 180.0               # m3
C_OUT = 420.0                # ppm
CO2_GEN = 0.0052e-3 * 3600   # m3/h per person
ACH_UNOCC = 0.8
CAPACITY = 1.2e7             # J/K
H_ENV = 180.0                # W/K
Q_PERSON = 75.0              # W
Q_EQUIP_OCC, Q_EQUIP_UNOCC = 500.0, 100.0
Q_SOLAR_PEAK = 600.0         # W
MOIST_PERSON = 55.0          # g/h
RHO_AIR = 1.2                # kg/m3
P_ATM = 101325.0
LAT, LON = 45.4785, 9.2272


def occupancy_fraction(t: datetime) -> float:
    if t.weekday() >= 5:
        return 0.0
    m = t.hour * 60 + t.minute
    if 8 * 60 + 30 <= m < 12 * 60 + 30 or 13 * 60 + 30 <= m < 17 * 60 + 30:
        return 1.0
    if 12 * 60 + 30 <= m < 13 * 60 + 30:
        return 0.5
    return 0.0


def solar_shape(t: datetime) -> float:
    h = t.hour + t.minute / 60
    return math.sin(math.pi * (h - 7) / 12) if 7 <= h <= 19 else 0.0


def p_sat(t_c: float) -> float:
    return 610.94 * math.exp(17.625 * t_c / (t_c + 243.04))


def rh_from_w(t_c: float, w_g_kg: float) -> float:
    w = w_g_kg / 1000
    pw = w * P_ATM / (0.622 + w)
    return 100 * pw / p_sat(t_c)


def rc_step(ti: float, to: float, ach: float, gains: float, capacity: float) -> float:
    h_tot = H_ENV + 0.34 * ach * VOLUME
    t_eq = to + gains / h_tot
    tau = capacity / h_tot
    return t_eq + (ti - t_eq) * math.exp(-DT_S / tau)


def generate(seed: int) -> list[dict]:
    rng = random.Random(seed)
    n_steps = DAYS * 24 * STEPS_PER_HOUR

    day_people = [rng.randint(18, 26) for _ in range(DAYS)]
    day_ach = [rng.uniform(3.0, 4.0) for _ in range(DAYS)]
    day_clear = [rng.uniform(0.4, 1.0) for _ in range(DAYS)]
    w_out_day, w = [], 9.0
    for _ in range(DAYS):
        w = min(11.5, max(6.5, w + rng.gauss(0, 0.8)))
        w_out_day.append(w)

    noise = 0.0
    ti_meas = ti_sim = 21.0
    co2 = C_OUT
    steps = []
    for k in range(n_steps):
        t = START + timedelta(seconds=k * DT_S)
        d = k // (24 * STEPS_PER_HOUR)
        frac_day = k / (24 * STEPS_PER_HOUR)
        h = t.hour + t.minute / 60

        # outdoor temperature
        mean = 23 - 5 * frac_day / DAYS + 1.5 * math.sin(2 * math.pi * frac_day / 5)
        noise = 0.95 * noise + rng.gauss(0, 0.4 * math.sqrt(1 - 0.95 ** 2))
        to = mean - 5 * math.cos(2 * math.pi * (h - 5) / 24) + noise

        occ = occupancy_fraction(t)
        people = occ * day_people[d]
        ach = day_ach[d] if occ > 0 else ACH_UNOCC
        flow = ach * VOLUME  # m3/h

        # CO2 mass balance, exact over the step
        c_ss = C_OUT + people * CO2_GEN / flow * 1e6
        co2 = c_ss + (co2 - c_ss) * math.exp(-ach * DT_H)

        # indoor temperature: "measured" and "simulated" models
        solar = Q_SOLAR_PEAK * solar_shape(t)
        equip = Q_EQUIP_OCC if occ > 0 else Q_EQUIP_UNOCC
        gains = people * Q_PERSON + equip
        ti_meas = rc_step(ti_meas, to, ach, gains + solar * day_clear[d], CAPACITY)
        ti_sim = rc_step(ti_sim, to, ach, gains + 0.8 * solar * day_clear[d], 0.75 * CAPACITY)

        # humidity
        w_out = w_out_day[d]
        w_in = w_out + people * MOIST_PERSON / (RHO_AIR * flow)
        rh = rh_from_w(ti_meas, w_in)

        # electrical power
        lighting = 1.2 * (1 - day_clear[d]) if occ > 0 else 0.0
        power = 0.6 + 0.10 * people + lighting
        sim_people = 22 * occupancy_fraction(t)
        sim_lighting = 1.2 * (1 - 0.7) if occ > 0 else 0.0
        sim_power = 0.6 + 0.10 * sim_people + sim_lighting

        steps.append((t, to, ti_meas, ti_sim, rh, co2, power, sim_power))

    rows = []
    for i in range(0, n_steps, STEPS_PER_HOUR):
        block = steps[i:i + STEPS_PER_HOUR]
        avg = [sum(s[j] for s in block) / STEPS_PER_HOUR for j in range(1, 8)]
        to, ti, ti_sim, rh, co2_h, p, p_sim = avg
        rows.append({
            "timestamp": block[0][0].strftime("%Y-%m-%d %H:%M:%S"),
            "indoor_temp": round(ti + rng.gauss(0, 0.10), 2),
            "outdoor_temp": round(to, 2),
            "sim_indoor_temp": round(ti_sim, 2),
            "rh": round(min(100.0, max(0.0, rh + rng.gauss(0, 1.5))), 1),
            "co2_ppm": round(max(C_OUT - 20, co2_h + rng.gauss(0, 15))),
            "power_kw": round(max(0.0, p + rng.gauss(0, 0.05)), 2),
            "sim_power_kw": round(p_sim, 2),
            "latitude": LAT,
            "longitude": LON,
            "building_zone": "Room_A",
        })
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, default=Path("sample_building_data.csv"))
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()
    rows = generate(args.seed)
    with args.out.open("w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=list(rows[0]))
        wr.writeheader()
        wr.writerows(rows)
    print(f"wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
