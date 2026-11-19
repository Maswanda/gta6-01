// Radio: three procedural stations, always on, switchable with R... no,
// with the 1/2/3 keys and the HUD cycle key. The station name is part of
// the diegetic HUD in every frame.
import { STATIONS } from './tuning.js';

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.on = true;
    this.stationIndex = 0;
    this.stations = STATIONS;
  }

  get station() {
    return this.stations[this.stationIndex].name;
  }

  current() {
    return this.stations[this.stationIndex];
  }

  setStation(i) {
    const n = this.stations.length;
    this.stationIndex = ((i % n) + n) % n;
    if (this.on) this.audio.startRadio(this.current());
    return this.station;
  }

  cycle() {
    return this.setStation(this.stationIndex + 1);
  }

  toggle() {
    this.on = !this.on;
    if (this.on) this.audio.startRadio(this.current());
    else this.audio.stopRadio();
    return this.on;
  }

  start() {
    if (this.on) this.audio.startRadio(this.current());
  }

  state() {
    return { on: this.on, station: this.station };
  }
}
