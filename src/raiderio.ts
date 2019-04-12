import {from, Observable} from 'rxjs';
import {log} from './main';

export class MythicPlusScore {
    dps: string;
    healer: string;
    tank: string;

    constructor(dps: string, healer: string, tank: string) {
        this.dps = dps;
        this.healer = healer;
        this.tank = tank;
    }

    public toString(): string {
        let output: string[] = [];
        if (this.dps) {
            output.push(`DPS: ${this.dps}`);
        }
        if (this.healer) {
            output.push(`Heal: ${this.healer}`)
        }
        if (this.tank) {
            output.push(`Tank: ${this.tank}`)
        }
        return output.join('\n');
    }
}

export class RaiderIORank {

    className: string;
    race: string;
    faction: string;
    mythicPlusScore: MythicPlusScore;

    constructor(className: string, race: string, faction: string, mythic_plus_scores: MythicPlusScore) {
        this.className = className;
        this.race = race;
        this.faction = faction;
        this.mythicPlusScore = mythic_plus_scores;
    }
}

export function fetchRaiderio(region: string, realm: string, name: string): Observable<RaiderIORank> {
    log.info(`https://raider.io/api/v1/characters/profile?region=${region}&realm=${realm}&name=${name}&fields=mythic_plus_scores`);
    const data$ = from(
        fetch(`https://raider.io/api/v1/characters/profile?region=${region}&realm=${realm}&name=${name}&fields=mythic_plus_scores`)
            .then(resp => resp.ok ? resp.json() : Promise.reject(`Error in raiderio: ${resp.statusText} ${resp.status}`))
    );
    return new Observable(
        obs => {
            data$.subscribe(
                (d: any) => {
                    if (d && d.mythic_plus_scores) {
                        const mythicPlusScore = new MythicPlusScore(d.mythic_plus_scores.dps, d.mythic_plus_scores.healer, d.mythic_plus_scores.tank);
                        const raiderIO = new RaiderIORank(d.class, d.race, d.faction, mythicPlusScore);
                        obs.next(raiderIO);
                    }
                },
                err => {
                    obs.error(err);
                });
        }
    );
}
