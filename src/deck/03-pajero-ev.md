## electrify a 1999 Pajero Mini

A Kei-class EV swap. The 660cc gas lump is tiny and light, so the build is
within hobbyist scope. The donor sets the constraints:

| item | value |
|---|---|
| stock engine | 4A30 660cc, ~52–64 hp |
| curb weight | ~900–1000 kg |
| drivetrain | RWD / part-time 4WD, 5MT or 4AT |
| target motor | ~30–50 kW continuous |

The whole job is: pull the engine, bolt a motor to the gearbox, hang a battery,
wire the high-voltage loop. The next frames walk each block.

## two architectures

Pick how the motor meets the wheels.

```d2 arch
motor.class: hub
motor -> gearbox: adapter plate
gearbox -> transfer: keep 4WD
transfer -> wheels
motor -> diff: direct drive {style.stroke-dash: 4}
diff -> wheels
gearbox.class: type
transfer.class: module
diff.class: dead
```

- **A — keep the transmission** (solid edge): adapter plate couples the motor to
  the existing clutch/input shaft. Keep 4WD + transfer case. Cheapest, fastest.
- **B — direct drive** (dashed): delete the gearbox, drive a diff. Lighter, more
  fab, you lose easy 4WD.

Go **A** for a first conversion.

## the system, end to end

graph: arch

Everything bolts around architecture A. Same picture, now read it as the parts
list:

- **motor** — Hyper9 / HPEVS AC-9, or a salvage Leaf EM57
- **gearbox / transfer** — stock, untouched
- the missing pieces are electrical, covered next: battery, inverter, the HV loop

## the adapter plate — the only unbuyable part

This plate sandwiches between the gearbox bellhousing and the motor face; a
**coupler** links the motor shaft to the clutch/input shaft. The one spec that
matters:

> Motor output centerline must align with the gearbox input centerline within
> **~0.1 mm**. Misalignment chews the input bearing and vibrates.

```text
        motor face            gearbox bellhousing
        ┌────────┐    plate    ┌────────┐
        │   ●────┼──[ hub ]────┼────●   │
        └────────┘  |register| └────────┘
                    └ centers off the dowel pins
```

Material: 6061-T6, 12–19 mm. Method: bolt-pattern transfer off the bellhousing,
indexed on the existing dowel pins via a machined register boss.

## coupler — two routes

```d2 coupler
shaft: motor shaft
shaft.class: hub
shaft -> hubA: keep clutch
hubA -> flywheel
flywheel -> disc
shaft -> hubB: clutchless {style.stroke-dash: 4}
hubB -> disc
disc -> input: gearbox input
flywheel.class: ghost
```

| route | what | trade |
|---|---|---|
| keep clutch | hub carries lightened flywheel + clutch | shift normally, more parts |
| clutchless | hub keys onto a cut-down clutch disc | simpler; pick one gear, rev-match |

For a daily Kei: **clutchless, single gear, transfer case still live.** Electric
torque is flat from 0 rpm, so the gearbox ratios the 660cc needed are optional.
Don't cut your own spline — buy a disc that fits the 4A30 input, machine the hub
to it.

## battery — size for a Kei, not a Tesla

A ~950 kg Kei uses ~130–160 Wh/km. Don't chase range; every kWh is ~5–6 kg of
cells plus box, and overloading a short-wheelbase 4WD wrecks handling + brakes.

```text
  usable kWh   real range      pack mass
  ───────────  ──────────────  ─────────
  20 kWh       ~125–150 km     ~120 kg
  30 kWh       ~190–230 km     ~170 kg
```

**Target: 20–30 kWh, LFP, ~150–180 kg.** 96–144V series string of 280Ah
prismatics ≈ 14 kWh each; two strings parallel ≈ 28 kWh.

## battery — where it goes

Keep CoG low and weight ~50/50. Corner-weigh empty first, then place modules.

```d2 packing
chassis: Pajero Mini {
  front: engine bay {
    boxA: box A — where 4A30 was
  }
  rear: under cargo floor {
    boxB: box B — old tank spot
  }
}
boxA.class: relation
boxB.class: relation
boxA -> bus: HV
boxB -> bus: HV
bus: HV junction
bus.class: hub
```

- Two low boxes, front + rear, not one tall box in the cargo area (CoG rise =
  rollover risk).
- Sealed steel, gasketed, vented outside, crash-rated hold-downs. Loose cells are
  the failure mode.

## the HV loop — series order matters

This is the safety-critical chain. Read it top to bottom; each block exists to
stop the next one from killing you or welding shut.

```d2 hvloop
pack: battery pack
pack.class: hub
pack -> msd: service disconnect
msd -> fuse: main HV fuse
fuse -> contactor: main contactor
precharge -> contactor: closes first
contactor -> inverter
inverter -> motor: 3φ
bms -> contactor: opens on fault
imd -> bms: isolation fault
bms.class: type
imd.class: type
precharge.class: fn
```

- **MSD** — physically breaks the pack to work dead. Pull it first.
- **precharge** — resistor + small contactor charges the inverter caps *before*
  the main closes. Skip it and you weld contactors.
- **BMS owns the contactor coil** — opens on over/under-volt, over-temp, imbalance.
- **IMD** — watches for HV leaking to chassis.

## the low-voltage side keeps the car a car

The dead engine used to supply things. Restore them:

```d2 lvside
hv: HV pack
hv.class: hub
hv -> dcdc: DC-DC 350→13.8V
dcdc -> bus12: stock 12V bus
bus12.class: relation
bus12 -> lights
bus12 -> wipers
bus12 -> ecu: gauges
vac: e-vacuum pump
vac -> brakes: booster
eps: electric PS
ptc: PTC heater
hv -> ptc: cabin heat
bus12 -> vac
bus12 -> eps
ptc.class: sink
```

- DC-DC feeds the **stock fusebox** — lights, wipers, gauges keep working.
- Brake vacuum → electric pump. Steering → e-PS or manual rack.
- Heat → PTC core (no coolant heat). Real winter draw on the pack.
- Throttle → Hall pedal (0–5V) into the controller. Toss the cable.

## voltage decision drives everything

```d2 voltage
lv: 96–144V
hv: 300–400V
lv -> learn: forgiving, heavier copper, slower
hv -> fast: efficient, cheap fast-charge, lethal
learn.class: fn
fast.class: dead
```

For a 660-class car doing city duty: **96–144V is the sane learning build.**
Step up to Tesla/Leaf-class HV once you've done one.

## fab skills — moderately master these four

The build depends on these most; they are also the cheapest to learn.

```d2 skills
metrology -> everything: highest leverage
mig -> boxes: load-bearing
mig -> mounts
wiring -> hvloop: biggest safety surface
machining -> coupler
machining -> plate
metrology.class: hub
wiring.class: hub
everything: every downstream step
```

| skill | where it bites | bar |
|---|---|---|
| **metrology** | 0.1 mm plate concentricity, corner-weighing | dial indicator + calipers + tolerance stacks |
| **MIG (steel)** | battery boxes, motor mounts | structural fillets that pass a bend test |
| **DC wiring** | the whole HV/LV harness | crimp lugs, size wire, read a schematic, DMM |
| **bench machining** | coupler hub, register boss | face, bore, turn to a dimension, cut a keyway |

## fab skills — outsource or stay novice

```d2 skills2
cad -> waterjet: send DXF
tig -> boxes_al: pretty aluminum
plumbing -> cooling: only if liquid-cooled
grinder -> stripout
cad.class: ghost
tig.class: dead
plumbing.class: dead
grinder.class: fn
```

- **CAD** — enough 2D to send the plate + boxes to a waterjet shop.
- **TIG / coolant plumbing** — drop both by going **air-cooled LFP at 96–144V**.
- Job out the adapter plate and your machining need collapses to "spec + inspect"
  — but you still need metrology to verify what the shop hands back.

## learning order — each gates the next

```d2 order
metrology -> wiring: bench mock-up first
wiring -> mig
mig -> machining: first part = coupler hub
metrology.class: hub
```

1. **Metrology** — a weekend with calipers + a dial indicator.
2. **DC wiring + DMM** — mock up the relay + precharge on a bench, no cells yet.
3. **MIG** — ~20 hrs of coupons, bend-test them.
4. **Lathe/mill** — maker-space intro; first real part is the coupler hub.

The two that kill you half-learned: **wiring** (HV fault, fire) and **welding**
(box/mount failure in a crash). Spend the practice budget there. See
[[electrify a 1999 Pajero Mini]] for the donor specs.

## the build as type signatures

Read the whole conversion as one function. Its argument is the donor; its return
is a road-legal EV. The body is a sequence of sub-builds, each with its own
signature and its own invariant (the `where` clause is the spec that bites).

```rust
fn convert(donor: PajeroMini) -> Ev {
    let driveline = mate(donor.gearbox, motor());
    let pack       = battery();
    let hv         = hv_loop(pack, inverter());
    let lv         = lv_side(hv);
    restore(donor, lv);          // brakes, steering, heat
    Ev { driveline, hv, lv }
}
```

Each call below is a frame: the signature names the inputs, the `where` names the
thing that fails if you get it wrong.

## the build as type signatures — expanded

The sub-builds, with the invariant that kills each one:

```rust
fn convert(donor: PajeroMini) -> Ev {
    let driveline = mate(donor.gearbox, motor());
    let pack       = battery();
    let hv         = hv_loop(pack, inverter());
    let lv         = lv_side(hv);
    restore(donor, lv);
    Ev { driveline, hv, lv }
}

fn mate(g: Gearbox, m: Motor) -> Driveline
    where AdapterPlate: concentric_within(0.1mm);   // metrology + machining

fn battery() -> Pack
    where Pack: kwh(20..30) + mass(<180kg) + balance(~50/50);  // welding boxes

fn hv_loop(p: Pack, inv: Inverter) -> Hv
    where Order: [msd, fuse, contactor, precharge_first];  // wiring, or you weld it

fn lv_side(hv: Hv) -> Lv;          // DC-DC feeds the stock 12V bus
fn restore(c: &mut PajeroMini, lv: Lv);  // vacuum brakes, e-PS, PTC heat
```

The next frame is the same set of names as a graph: each `fn` becomes a build
node, wired to the parts it consumes and the skill it demands.

## semantic graph — everything, and where it lives

One model of the whole task: **build steps** (functions), the **skills** they
demand, the **parts** they consume, and the **invariant** each must hold. Click a
node for its cone — what it reaches. The side panels stream each node's address:
its signature (`code`) and its physical home in the car (`fs`).

```atlas pajero
build: build steps {
  convert
  mate
  battery
  hv_loop
  lv_side
  restore
}
skill: fab skills {
  metrology
  mig
  wiring
  machining
}
part: parts {
  plate
  coupler
  pack
  inverter
  dcdc
}

convert -> mate
convert -> battery
convert -> hv_loop
convert -> lv_side
convert -> restore

mate -> plate
mate -> coupler
mate -> machining
mate -> metrology
battery -> pack
battery -> mig
hv_loop -> inverter
hv_loop -> wiring
hv_loop -> pack
lv_side -> dcdc
restore -> wiring

# @ build.convert : convert(donor: PajeroMini) -> Ev — the whole job
# @ build.mate : the only unbuyable step; concentricity is the spec
# @ build.battery : size for a Kei, not a Tesla; 20–30 kWh
# @ build.hv_loop : series order is the safety contract
# @ skill.metrology : highest leverage, cheapest to learn — everything measures
# @ skill.wiring : biggest safety surface; HV fault = fire
# @ part.plate : 6061-T6, indexed off the bellhousing dowels
# @ part.pack : LFP, two low boxes, crash-rated hold-downs

# src build.convert = signatures.rs:1
# src build.mate = signatures.rs:9
# src build.battery = signatures.rs:12
# src build.hv_loop = signatures.rs:15
# src build.lv_side = signatures.rs:18
# src build.restore = signatures.rs:19
# ref fs part.plate = engine-bay/adapter-plate
# ref fs part.coupler = engine-bay/motor-shaft
# ref fs part.pack = front-box + rear-box
# ref fs part.inverter = engine-bay/inverter
# ref fs part.dcdc = engine-bay/dcdc

# tag build.convert : hub
# tag skill.metrology : hub
# tag skill.wiring : hub
# tag part.pack : sink

# tour build 0 = build.convert : start at the top-level function
# tour build 1 = build.mate+part.plate+skill.machining : mate() = plate + coupler, machined to 0.1mm
# tour build 2 = build.battery+part.pack+skill.mig : battery() = welded boxes, 20–30 kWh LFP
# tour build 3 = build.hv_loop+part.inverter+skill.wiring : hv_loop() = the series safety chain
# tour build 4 = build.restore+skill.wiring : restore brakes, steering, heat the dead engine used to give

# view focus=build.convert mode=downstream dir=LR
```

Press ▶ on the **build** tour to walk `convert()` call by call: each step lights
its function, the parts it consumes, and the skill it demands together.

## Japan / import gotchas

The wrenching is the easy part. The paperwork is the wall.

- **Shaken (車検)**: a conversion in Japan changes the registered powertrain —
  re-inspection + 改造申請 at the 陸運局.
- **US import**: must be 25+ years old to be federally road-legal. A 1999 cleared
  that in **2024**, so it's importable now; the gas engine is gone, so EPA/most
  FMVSS stop mattering.
- **RHD**: mirror the left/right of US conversion writeups.

Budget: salvage low-voltage build **$8–15k** / ~200–400 hrs. Tesla/Leaf HV build
**$15–30k**, more fab + HV safety gear.
